const giftsGrid = document.getElementById('gifts-grid');
const form = document.getElementById('selection-form');
const msg = document.getElementById('message');

let gifts = [];
let selectedGiftId = null;

function setMessage(text, isError = false) {
  msg.textContent = text;
  msg.classList.toggle('error', isError);
}

function renderGifts() {
  if (!gifts.length) {
    giftsGrid.innerHTML = '<p class="muted">אין מתנות זמינות כרגע.</p>';
    return;
  }

  giftsGrid.innerHTML = gifts
    .map(
      (gift) => `
        <article class="gift-card ${selectedGiftId === gift.id ? 'selected' : ''}" data-id="${gift.id}">
          <img src="${gift.imageUrl}" alt="${gift.name}" />
          <div class="gift-card-content">
            <strong>${gift.name}</strong>
            <p class="muted">${gift.description || ''}</p>
            <small>נותרו: ${gift.remaining}</small>
          </div>
        </article>
      `
    )
    .join('');

  document.querySelectorAll('.gift-card').forEach((card) => {
    card.addEventListener('click', () => {
      selectedGiftId = Number(card.dataset.id);
      renderGifts();
    });
  });
}

async function loadGifts() {
  const res = await fetch('/api/gifts');
  if (!res.ok) {
    setMessage('שגיאה בטעינת המתנות', true);
    return;
  }

  gifts = await res.json();
  renderGifts();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const employeeName = document.getElementById('employeeName').value.trim();
  const workSite = document.getElementById('workSite').value.trim();
  const centerName = document.getElementById('centerName').value.trim();

  if (!selectedGiftId) {
    setMessage('יש לבחור מתנה לפני אישור.', true);
    return;
  }

  const res = await fetch('/api/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeName, workSite, centerName, giftId: selectedGiftId }),
  });

  const data = await res.json();
  if (!res.ok) {
    setMessage(data.error || 'אירעה שגיאה בשמירה', true);
    return;
  }

  form.reset();
  selectedGiftId = null;
  setMessage('הבחירה נשמרה בהצלחה. תודה!');
  await loadGifts();
});

loadGifts();
