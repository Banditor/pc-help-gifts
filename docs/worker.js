const form = document.getElementById("worker-form");
const giftsGrid = document.getElementById("giftsGrid");
const msg = document.getElementById("workerMsg");

function setMsg(text, isError) {
  msg.textContent = text;
  msg.className = `message ${text ? (isError ? "error" : "success") : ""}`;
}

function appErrorMessage(err) {
  if (!err) return "אירעה שגיאה. נסו שוב.";
  if (err.kind === "DUPLICATE_EMPLOYEE") return "עובד עם תעודת זהות זו כבר נרשם.";
  if (err.kind === "OUT_OF_STOCK") return "המתנה אזלה מהמלאי, בחרו מתנה אחרת.";
  if (err.kind === "INVALID_ID") return "מספר תעודת הזהות לא תקין.";
  if (err.kind === "INVALID_PHONE") return "מספר הטלפון לא תקין.";
  if (err.kind === "MIGRATION_REQUIRED") return "חסרה הגדרת DB לתעודת זהות/טלפון. יש להריץ את המיגרציה.";
  return "אירעה שגיאה בשמירה. נסו שוב.";
}

async function renderGifts() {
  try {
    const list = await GPP.listGiftAvailability();
    if (!list.length) {
      giftsGrid.innerHTML = '<div class="card">אין מתנות כרגע. פנו למנהל.</div>';
      return;
    }

    giftsGrid.innerHTML = list
      .map((g) => {
        const disabled = g.remaining <= 0;
        return `
          <label class="gift-card" style="opacity:${disabled ? "0.65" : "1"};">
            <img class="gift-image" src="${g.image_url || "https://placehold.co/600x400/e9eef5/5f6d7a?text=Gift"}" alt="${g.name}" />
            <div class="gift-content">
              <input type="radio" name="giftId" value="${g.id}" ${disabled ? "disabled" : ""} />
              <h4 class="gift-title">${g.name}</h4>
              <div class="muted">${g.description || ""}</div>
              <div class="badge">נותר: ${g.remaining}</div>
            </div>
          </label>`;
      })
      .join("");
  } catch (err) {
    setMsg(appErrorMessage(err), true);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("", false);

  const employeeName = document.getElementById("employeeName").value.trim();
  const workSite = document.getElementById("workSite").value.trim();
  const department = document.getElementById("department").value.trim();
  const employeeId = document.getElementById("employeeId").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const selected = form.querySelector('input[name="giftId"]:checked');

  if (!employeeName || !workSite || !department || !employeeId || !phone || !selected) {
    setMsg("יש למלא את כל השדות ולבחור מתנה.", true);
    return;
  }

  try {
    await GPP.submitSelection({
      employeeName,
      workSite,
      department,
      employeeId,
      phone,
      giftId: selected.value,
    });

    form.reset();
    await renderGifts();
    setMsg("הבחירה נשמרה בהצלחה.", false);
  } catch (err) {
    await renderGifts();
    setMsg(appErrorMessage(err), true);
  }
});

renderGifts();
