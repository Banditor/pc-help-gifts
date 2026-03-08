(function () {
  const SUPABASE_URL = "https://vjllsgtranpbhqqvtfms.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqbGxzZ3RyYW5wYmhxcXZ0Zm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzY5NDMsImV4cCI6MjA4ODU1Mjk0M30.uoKT4TJ3tod82O3WywVaCV-N4Gl_c0pLPvI_Z8L60xo";

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function normalizeId(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function toAppError(kind, original) {
    const err = new Error(kind);
    err.kind = kind;
    err.original = original || null;
    return err;
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

  function isMissingColumnError(error) {
    if (!error) return false;
    return error.code === "42703" || String(error.message || "").includes("employee_id");
  }

  async function listGifts() {
    const { data, error } = await supabaseClient
      .from("gifts")
      .select("id,name,description,image_url,quantity,active,created_at")
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function listSelections() {
    const { data, error } = await supabaseClient
      .from("gift_selections")
      .select("id,employee_name,employee_id,phone,work_site,department,gift_id,created_at,gifts(name)")
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingColumnError(error)) {
        throw toAppError("MIGRATION_REQUIRED", error);
      }
      throw error;
    }

    return data || [];
  }

  async function listGiftAvailability() {
    const [gifts, selections] = await Promise.all([listGifts(), listSelections().catch((err) => {
      if (err.kind === "MIGRATION_REQUIRED") return [];
      throw err;
    })]);

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

  async function submitSelection(payload) {
    const employeeId = normalizeId(payload.employeeId);
    const phone = normalizePhone(payload.phone);

    if (employeeId.length < 5) throw toAppError("INVALID_ID");
    if (phone.length < 8) throw toAppError("INVALID_PHONE");

    const { data: exists, error: checkError } = await supabaseClient
      .from("gift_selections")
      .select("id")
      .eq("employee_id", employeeId)
      .limit(1);

    if (checkError) {
      if (isMissingColumnError(checkError)) {
        throw toAppError("MIGRATION_REQUIRED", checkError);
      }
      throw checkError;
    }

    if (exists && exists.length > 0) {
      throw toAppError("DUPLICATE_EMPLOYEE");
    }

    const { data: gift, error: giftError } = await supabaseClient
      .from("gifts")
      .select("id,quantity,active")
      .eq("id", payload.giftId)
      .eq("active", true)
      .single();

    if (giftError || !gift) throw toAppError("GIFT_NOT_FOUND", giftError);

    const { count, error: countError } = await supabaseClient
      .from("gift_selections")
      .select("id", { head: true, count: "exact" })
      .eq("gift_id", payload.giftId);

    if (countError) throw countError;

    if ((count || 0) >= Number(gift.quantity || 0)) {
      throw toAppError("OUT_OF_STOCK");
    }

    const insertPayload = {
      employee_name: payload.employeeName,
      employee_id: employeeId,
      phone,
      work_site: payload.workSite,
      department: payload.department,
      gift_id: payload.giftId,
    };

    const { error: insertError } = await supabaseClient
      .from("gift_selections")
      .insert(insertPayload);

    if (insertError) {
      if (insertError.code === "23505") throw toAppError("DUPLICATE_EMPLOYEE", insertError);
      if (isMissingColumnError(insertError)) throw toAppError("MIGRATION_REQUIRED", insertError);
      throw insertError;
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

    const { error } = await supabaseClient.from("gifts").insert({
      name: payload.name,
      description: payload.description || null,
      quantity: Number(payload.quantity || 0),
      image_url: imageUrl,
      active: true,
    });

    if (error) throw error;
  }

  async function deleteGift(id) {
    const { error } = await supabaseClient.from("gifts").delete().eq("id", id);
    if (error) throw error;
  }

  async function clearSelections() {
    const { error } = await supabaseClient.from("gift_selections").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
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
    listSelections,
    listGiftAvailability,
    submitSelection,
    addGift,
    deleteGift,
    clearSelections,
    downloadCsv,
  };
})();
