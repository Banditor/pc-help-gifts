const loginCard = document.getElementById('login-card');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const loginMsg = document.getElementById('login-msg');

const giftsTableBody = document.getElementById('gifts-table-body');
const selectionsTableBody = document.getElementById('selections-table-body');
const addGiftForm = document.getElementById('add-gift-form');
const refreshSelectionsBtn = document.getElementById('refresh-selections');
const logoutBtn = document.getElementById('logout-btn');
const emailForm = document.getElementById('email-form');
const reportEmailInput = document.getElementById('report-email');
const sendReportBtn = document.getElementById('send-report-btn');
const settingsMsg = document.getElementById('settings-msg');

function setText(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function activateTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-content').forEach((tab) => {
    tab.classList.toggle('active', tab.id === `tab-${tabName}`);
  });
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

async function checkAuth() {
  const res = await fetch('/api/admin/me');
  return res.ok;
}

async function login(password) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res;
}

async function fetchAdminGifts() {
  const res = await fetch('/api/admin/gifts');
  if (!res.ok) return [];
  return res.json();
}

async function fetchSelections() {
  const res = await fetch('/api/admin/selections');
  if (!res.ok) return [];
  return res.json();
}

async function renderGiftsTable() {
  const gifts = await fetchAdminGifts();

  giftsTableBody.innerHTML = gifts
    .map(
      (g) => `
      <tr>
        <td><img class="thumb" src="${g.imageUrl}" alt="${g.name}" /></td>
        <td>${g.name}</td>
        <td>${g.description || ''}</td>
        <td>${g.quantity}</td>
        <td>${g.selectedCount}</td>
        <td>${g.active ? 'פעיל' : 'לא פעיל'}</td>
        <td><button class="btn btn-danger" data-delete="${g.id}">מחיקה</button></td>
      </tr>
    `
    )
    .join('');

  document.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('למחוק את המתנה?')) return;
      const res = await fetch(`/api/admin/gifts/${btn.dataset.delete}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'שגיאה במחיקה');
        return;
      }
      await renderGiftsTable();
    });
  });
}

async function renderSelectionsTable() {
  const rows = await fetchSelections();
  selectionsTableBody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${r.employeeName}</td>
        <td>${r.workSite}</td>
        <td>${r.centerName}</td>
        <td>${r.giftName}</td>
        <td>${r.selectedAt}</td>
      </tr>
    `
    )
    .join('');
}

async function loadSettings() {
  const res = await fetch('/api/admin/settings');
  if (!res.ok) return;
  const data = await res.json();
  reportEmailInput.value = data.reportEmail || '';
}

async function openPanel() {
  loginCard.classList.add('hidden');
  adminPanel.classList.remove('hidden');
  await Promise.all([renderGiftsTable(), renderSelectionsTable(), loadSettings()]);
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('admin-password').value;
  const res = await login(password);
  if (!res.ok) {
    setText(loginMsg, 'סיסמה שגויה', true);
    return;
  }
  setText(loginMsg, '');
  await openPanel();
});

addGiftForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(addGiftForm);
  const res = await fetch('/api/admin/gifts', { method: 'POST', body: fd });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || 'שגיאה בהוספת מתנה');
    return;
  }

  addGiftForm.reset();
  await renderGiftsTable();
});

refreshSelectionsBtn.addEventListener('click', renderSelectionsTable);

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  location.reload();
});

emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const reportEmail = reportEmailInput.value.trim();

  const res = await fetch('/api/admin/settings/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportEmail }),
  });

  const data = await res.json();
  if (!res.ok) {
    setText(settingsMsg, data.error || 'שגיאה בשמירה', true);
    return;
  }

  setText(settingsMsg, 'המייל נשמר בהצלחה');
});

sendReportBtn.addEventListener('click', async () => {
  const res = await fetch('/api/admin/send-report', { method: 'POST' });
  const data = await res.json();

  if (!res.ok) {
    setText(settingsMsg, data.error || 'שגיאה בשליחה', true);
    return;
  }

  setText(settingsMsg, `הקובץ נשלח ל: ${data.sentTo}`);
});

(async () => {
  if (await checkAuth()) {
    await openPanel();
  }
})();
