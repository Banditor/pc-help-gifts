const ADMIN_PASSWORD = "E123123";
const AUTH_KEY = "gpp_admin_auth";

const loginShell = document.getElementById("loginShell");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const giftForm = document.getElementById("giftForm");
const giftsTable = document.getElementById("giftsTable");
const selectionsTable = document.getElementById("selectionsTable");

function setMsg(el, text, isError) {
  el.textContent = text;
  el.className = `message ${text ? (isError ? "error" : "success") : ""}`;
}

function setAuth(v) {
  localStorage.setItem(AUTH_KEY, v ? "1" : "0");
}

function isAuth() {
  return localStorage.getItem(AUTH_KEY) === "1";
}

function appErrorMessage(err) {
  if (!err) return "אירעה שגיאה. נסו שוב.";
  if (err.kind === "IMAGE_PROCESS_FAILED") return "שגיאה בעיבוד התמונה. נסה תמונה קטנה יותר או בפורמט JPG/PNG.";
  if (err.message) return `שגיאה: ${err.message}`;
  return "אירעה שגיאה בפעולה.";
}

async function renderGifts() {
  const list = await GPP.listGiftAvailability();
  giftsTable.innerHTML =
    list
      .map(
        (g) => `
        <tr>
          <td><img class="thumb" data-gift-image="${g.id}" src="https://placehold.co/120x120/e9eef5/5f6d7a?text=Gift" alt="${g.name}" /></td>
          <td>${g.name}</td>
          <td>${g.description || ""}</td>
          <td>${g.quantity || 0}</td>
          <td>${g.selected}</td>
          <td>${g.remaining}</td>
          <td><button class="btn btn-danger" data-del="${g.id}">מחיקה</button></td>
        </tr>
      `
      )
      .join("") || '<tr><td colspan="7">אין מתנות.</td></tr>';

  list.forEach(async (gift) => {
    try {
      const url = await GPP.getGiftImageUrl(gift.id);
      if (!url) return;
      const img = giftsTable.querySelector(`[data-gift-image="${gift.id}"]`);
      if (img) img.src = url;
    } catch (_) {
      // keep placeholder
    }
  });

  giftsTable.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("למחוק מתנה זו?")) return;
      await GPP.deleteGift(btn.getAttribute("data-del"));
      await renderAll();
    });
  });
}

async function renderSelections() {
  const list = await GPP.listSelections();
  selectionsTable.innerHTML =
    list
      .map(
        (s) => `
        <tr>
          <td>${s.employee_name || ""}</td>
          <td>${s.employee_id || ""}</td>
          <td>${s.phone || ""}</td>
          <td>${s.work_site || ""}</td>
          <td>${s.department || ""}</td>
          <td>${(s.gifts && s.gifts.name) || ""}</td>
          <td>${new Date(s.created_at).toLocaleString("he-IL")}</td>
        </tr>
      `
      )
      .join("") || '<tr><td colspan="7">אין בחירות.</td></tr>';
}

async function renderAll() {
  try {
    await Promise.all([renderGifts(), renderSelections()]);
  } catch (err) {
    setMsg(loginMsg, appErrorMessage(err), true);
  }
}

function applyAuthView() {
  const ok = isAuth();
  loginShell.style.display = ok ? "none" : "grid";
  adminPanel.style.display = ok ? "block" : "none";
  if (ok) renderAll();
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = document.getElementById("adminPassword").value;
  if (val === ADMIN_PASSWORD) {
    setAuth(true);
    setMsg(loginMsg, "כניסה הצליחה.", false);
    applyAuthView();
  } else {
    setMsg(loginMsg, "סיסמה שגויה.", true);
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  setAuth(false);
  applyAuthView();
});

document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn[data-tab]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.getAttribute("data-tab");
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.getAttribute("data-panel") === tab);
    });
  });
});

giftForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("giftName").value.trim();
  const description = document.getElementById("giftDescription").value.trim();
  const quantity = Number(document.getElementById("giftQty").value || 0);
  const file = document.getElementById("giftImage").files[0] || null;

  if (!name) {
    setMsg(document.getElementById("giftMsg"), "שם מתנה הוא שדה חובה.", true);
    return;
  }

  try {
    setMsg(document.getElementById("giftMsg"), "מעלה ושומר מתנה, המתן...", false);
    await GPP.addGift({ name, description, quantity, file });
    giftForm.reset();
    document.getElementById("giftQty").value = "0";
    setMsg(document.getElementById("giftMsg"), "המתנה נוספה.", false);
    await renderAll();
  } catch (err) {
    setMsg(document.getElementById("giftMsg"), appErrorMessage(err), true);
  }
});

document.getElementById("exportBtn").addEventListener("click", async () => {
  try {
    const list = await GPP.listSelections();
    const rows = [["שם עובד", "תעודת זהות", "טלפון", "אתר עבודה", "מוקד", "מתנה", "תאריך"]];
    list.forEach((s) => {
      rows.push([
        s.employee_name || "",
        s.employee_id || "",
        s.phone || "",
        s.work_site || "",
        s.department || "",
        (s.gifts && s.gifts.name) || "",
        new Date(s.created_at).toLocaleString("he-IL"),
      ]);
    });
    GPP.downloadCsv("gift-selections.csv", rows);
  } catch (err) {
    setMsg(loginMsg, appErrorMessage(err), true);
  }
});

document.getElementById("clearSelectionsBtn").addEventListener("click", async () => {
  if (!confirm("למחוק את כל הבחירות?")) return;
  try {
    await GPP.clearSelections();
    await renderAll();
  } catch (err) {
    setMsg(loginMsg, appErrorMessage(err), true);
  }
});

applyAuthView();
