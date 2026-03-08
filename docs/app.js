(function () {
  const SUPABASE_URL = "https://vjllsgtranpbhqqvtfms.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqbGxzZ3RyYW5wYmhxcXZ0Zm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzY5NDMsImV4cCI6MjA4ODU1Mjk0M30.uoKT4TJ3tod82O3WywVaCV-N4Gl_c0pLPvI_Z8L60xo";
  const REST_BASE = `${SUPABASE_URL}/rest/v1`;

  const defaultHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  async function safeUnregisterServiceWorkers() {
    try {
      if (!("serviceWorker" in navigator)) return;
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (_) {
      // ignore
    }
  }

  safeUnregisterServiceWorkers();

  function toAppError(kind, original) {
    const err = new Error(kind);
    err.kind = kind;
    err.original = original || null;
    return err;
  }

  function normalizeId(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  async function rest(path, options = {}) {
    const method = options.method || "GET";
    const headers = { ...defaultHeaders, ...(options.headers || {}) };
    const init = { method, headers, cache: "no-store" };

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
      init.headers["Content-Type"] = "application/json";
    }

    const timeoutMs = options.timeoutMs || 10000;
    const retries = options.retries ?? 1;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${REST_BASE}${path}`, { ...init, signal: controller.signal });
        clearTimeout(timer);

        if (!res.ok) {
          let payload = null;
          try {
            payload = await res.json();
          } catch (_) {
            payload = { message: await res.text() };
          }
          const e = new Error(payload?.message || payload?.hint || `HTTP ${res.status}`);
          e.status = res.status;
          e.payload = payload;
          throw e;
        }

        if (method === "HEAD") return null;
        const text = await res.text();
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        if (attempt === retries) break;
      }
    }

    throw lastError || new Error("Network request failed");
  }

  function isMissingColumnError(error) {
    if (!error) return false;
    const msg = String(error.message || error.payload?.message || "");
    const code = String(error.payload?.code || "");
    return code === "42703" || msg.includes("employee_id") || msg.includes("phone");
  }

  async function listGifts() {
    const data = await rest(
      `/gifts?select=id,name,description,quantity,active,created_at&active=eq.true&order=created_at.asc`
    );
    return Array.isArray(data) ? data : [];
  }

  async function getGiftImageUrl(giftId) {
    const rows = await rest(`/gifts?select=image_url&id=eq.${encodeURIComponent(giftId)}&limit=1`, {
      timeoutMs: 12000,
      retries: 0,
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0].image_url || null;
  }

  async function listSelections() {
    try {
      const data = await rest(
        `/gift_selections?select=id,employee_name,employee_id,phone,work_site,department,gift_id,created_at,gifts(name)&order=created_at.desc`
      );
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (isMissingColumnError(error)) throw toAppError("MIGRATION_REQUIRED", error);
      throw error;
    }
  }

  async function listGiftAvailability() {
    const [gifts, selections] = await Promise.all([
      listGifts(),
      listSelections().catch((err) => {
        if (err.kind === "MIGRATION_REQUIRED") return [];
        throw err;
      }),
    ]);

    const counts = {};
    for (const row of selections) {
      counts[row.gift_id] = (counts[row.gift_id] || 0) + 1;
    }

    return gifts.map((gift) => {
      const selected = counts[gift.id] || 0;
      const quantity = Number(gift.quantity || 0);
      return {
        ...gift,
        selected,
        remaining: Math.max(0, quantity - selected),
      };
    });
  }

  function fileToOptimizedDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const maxSide = 1280;
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Cannot process image"));
              return;
            }
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = reject;
        img.src = String(reader.result || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function submitSelection(payload) {
    const employeeId = normalizeId(payload.employeeId);
    const phone = normalizePhone(payload.phone);

    if (employeeId.length < 5) throw toAppError("INVALID_ID");
    if (phone.length < 8) throw toAppError("INVALID_PHONE");

    try {
      const exists = await rest(`/gift_selections?select=id&employee_id=eq.${encodeURIComponent(employeeId)}&limit=1`);
      if (Array.isArray(exists) && exists.length > 0) {
        throw toAppError("DUPLICATE_EMPLOYEE");
      }
    } catch (error) {
      if (error.kind) throw error;
      if (isMissingColumnError(error)) throw toAppError("MIGRATION_REQUIRED", error);
      throw error;
    }

    const giftRows = await rest(`/gifts?select=id,quantity,active&id=eq.${encodeURIComponent(payload.giftId)}&active=eq.true&limit=1`);
    const gift = Array.isArray(giftRows) ? giftRows[0] : null;
    if (!gift) throw toAppError("GIFT_NOT_FOUND");

    const selectedRows = await rest(`/gift_selections?select=id&gift_id=eq.${encodeURIComponent(payload.giftId)}`);
    const selectedCount = Array.isArray(selectedRows) ? selectedRows.length : 0;

    if (selectedCount >= Number(gift.quantity || 0)) {
      throw toAppError("OUT_OF_STOCK");
    }

    try {
      await rest(`/gift_selections`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: {
          employee_name: payload.employeeName,
          employee_id: employeeId,
          phone,
          work_site: payload.workSite,
          department: payload.department,
          gift_id: payload.giftId,
        },
      });
    } catch (error) {
      const code = String(error.payload?.code || "");
      if (code === "23505") throw toAppError("DUPLICATE_EMPLOYEE", error);
      if (isMissingColumnError(error)) throw toAppError("MIGRATION_REQUIRED", error);
      throw error;
    }
  }

  async function addGift(payload) {
    let imageUrl = null;

    if (payload.file) {
      try {
        imageUrl = await fileToOptimizedDataUrl(payload.file);
      } catch (e) {
        throw toAppError("IMAGE_PROCESS_FAILED", e);
      }
    }

    await rest(`/gifts`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: {
        name: payload.name,
        description: payload.description || null,
        quantity: Number(payload.quantity || 0),
        image_url: imageUrl,
        active: true,
      },
    });
  }

  async function deleteGift(id) {
    await rest(`/gifts?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  }

  async function clearSelections() {
    await rest(`/gift_selections?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  }

  function downloadCsv(filename, rows) {
    const esc = (val) => {
      const s = String(val ?? "");
      return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  window.GPP = {
    listGifts,
    getGiftImageUrl,
    listSelections,
    listGiftAvailability,
    submitSelection,
    addGift,
    deleteGift,
    clearSelections,
    downloadCsv,
  };
})();
