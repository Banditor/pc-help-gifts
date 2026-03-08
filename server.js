require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Rn123456';
const ADMIN_SESSION_TOKEN = process.env.ADMIN_SESSION_TOKEN || 'gift-admin-session';
const DB_PATH = path.join(__dirname, 'data.db');
const upload = multer({ storage: multer.memoryStorage() });

const localUploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(localUploadsDir)) {
  fs.mkdirSync(localUploadsDir, { recursive: true });
}

const hasSupabase = !!(
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.SUPABASE_BUCKET
);

const supabase = hasSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS gifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      image_url TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS gift_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name TEXT NOT NULL,
      work_site TEXT NOT NULL,
      center_name TEXT NOT NULL,
      gift_id INTEGER NOT NULL,
      selected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_name, work_site, center_name),
      FOREIGN KEY (gift_id) REFERENCES gifts(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function adminAuth(req, res, next) {
  if (req.cookies.admin_auth === ADMIN_SESSION_TOKEN) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

async function uploadGiftImage(file) {
  const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

  if (supabase) {
    const storagePath = `gifts/${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  const localPath = path.join(localUploadsDir, safeName);
  fs.writeFileSync(localPath, file.buffer);
  return `/uploads/${safeName}`;
}

async function buildWorkbook() {
  const rows = await all(
    `SELECT
      s.employee_name AS employeeName,
      s.work_site AS workSite,
      s.center_name AS centerName,
      g.name AS giftName,
      s.selected_at AS selectedAt
    FROM gift_selections s
    INNER JOIN gifts g ON g.id = s.gift_id
    ORDER BY s.selected_at DESC`
  );

  const normalized = rows.map((r) => ({
    'שם עובד': r.employeeName,
    'אתר עבודה': r.workSite,
    'מוקד': r.centerName,
    'סוג מתנה שנבחרה': r.giftName,
    'תאריך בחירה': r.selectedAt,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(normalized);
  XLSX.utils.book_append_sheet(wb, ws, 'GiftSelections');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function getConfiguredEmail() {
  const setting = await get('SELECT value FROM settings WHERE key = ?', ['report_email']);
  return setting ? setting.value : '';
}

function createMailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(localUploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/gifts', async (req, res) => {
  try {
    const gifts = await all(
      `SELECT
        g.id,
        g.name,
        g.description,
        g.image_url AS imageUrl,
        g.quantity,
        (
          SELECT COUNT(*)
          FROM gift_selections s
          WHERE s.gift_id = g.id
        ) AS selectedCount
      FROM gifts g
      WHERE g.active = 1
      ORDER BY g.created_at DESC`
    );

    const withAvailability = gifts
      .map((g) => ({
        ...g,
        remaining: Math.max(g.quantity - g.selectedCount, 0),
        soldOut: g.quantity > 0 ? g.selectedCount >= g.quantity : false,
      }))
      .filter((g) => !g.soldOut);

    res.json(withAvailability);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/select', async (req, res) => {
  const { employeeName, workSite, centerName, giftId } = req.body;

  if (!employeeName || !workSite || !centerName || !giftId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existing = await get(
      'SELECT id FROM gift_selections WHERE employee_name = ? AND work_site = ? AND center_name = ?',
      [employeeName.trim(), workSite.trim(), centerName.trim()]
    );

    if (existing) {
      return res.status(400).json({ error: 'בחירה כבר קיימת לעובד זה.' });
    }

    const gift = await get('SELECT id, quantity, active FROM gifts WHERE id = ?', [giftId]);
    if (!gift || gift.active !== 1) {
      return res.status(404).json({ error: 'המתנה לא קיימת או לא פעילה.' });
    }

    const selectedCountRow = await get('SELECT COUNT(*) AS count FROM gift_selections WHERE gift_id = ?', [giftId]);
    const selectedCount = selectedCountRow ? selectedCountRow.count : 0;

    if (gift.quantity > 0 && selectedCount >= gift.quantity) {
      return res.status(400).json({ error: 'המתנה אזלה מהמלאי.' });
    }

    await run(
      `INSERT INTO gift_selections (employee_name, work_site, center_name, gift_id)
       VALUES (?, ?, ?, ?)`,
      [employeeName.trim(), workSite.trim(), centerName.trim(), giftId]
    );

    res.json({ success: true, message: 'הבחירה נשמרה בהצלחה.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'סיסמה שגויה' });
  }

  res.cookie('admin_auth', ADMIN_SESSION_TOKEN, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 12,
  });

  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_auth');
  res.json({ success: true });
});

app.get('/api/admin/me', adminAuth, (req, res) => {
  res.json({ ok: true });
});

app.get('/api/admin/gifts', adminAuth, async (req, res) => {
  try {
    const gifts = await all(
      `SELECT
        g.id,
        g.name,
        g.description,
        g.image_url AS imageUrl,
        g.quantity,
        g.active,
        g.created_at AS createdAt,
        (
          SELECT COUNT(*)
          FROM gift_selections s
          WHERE s.gift_id = g.id
        ) AS selectedCount
      FROM gifts g
      ORDER BY g.created_at DESC`
    );

    res.json(gifts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/gifts', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, quantity } = req.body;
    const qty = Number(quantity || 0);

    if (!name || !req.file) {
      return res.status(400).json({ error: 'Name and image are required' });
    }

    if (!Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({ error: 'Quantity must be 0 or a positive number' });
    }

    const imageUrl = await uploadGiftImage(req.file);

    const result = await run(
      `INSERT INTO gifts (name, description, image_url, quantity, active)
       VALUES (?, ?, ?, ?, 1)`,
      [name.trim(), (description || '').trim(), imageUrl, qty]
    );

    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/gifts/:id', adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid gift id' });
    }

    const usage = await get('SELECT COUNT(*) AS count FROM gift_selections WHERE gift_id = ?', [id]);
    if (usage && usage.count > 0) {
      await run('UPDATE gifts SET active = 0 WHERE id = ?', [id]);
      return res.json({ success: true, mode: 'deactivated' });
    }

    await run('DELETE FROM gifts WHERE id = ?', [id]);
    res.json({ success: true, mode: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/selections', adminAuth, async (req, res) => {
  try {
    const rows = await all(
      `SELECT
        s.id,
        s.employee_name AS employeeName,
        s.work_site AS workSite,
        s.center_name AS centerName,
        g.name AS giftName,
        s.selected_at AS selectedAt
      FROM gift_selections s
      INNER JOIN gifts g ON g.id = s.gift_id
      ORDER BY s.selected_at DESC`
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const reportEmail = await getConfiguredEmail();
    res.json({ reportEmail });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/settings/email', adminAuth, async (req, res) => {
  try {
    const { reportEmail } = req.body;
    if (!reportEmail || !/^\S+@\S+\.\S+$/.test(reportEmail)) {
      return res.status(400).json({ error: 'כתובת מייל לא תקינה' });
    }

    await run(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ('report_email', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key)
       DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [reportEmail.trim()]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/export', adminAuth, async (req, res) => {
  try {
    const fileBuffer = await buildWorkbook();
    const fileName = `gift-selections-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(fileBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/send-report', adminAuth, async (req, res) => {
  try {
    const email = await getConfiguredEmail();
    if (!email) {
      return res.status(400).json({ error: 'לא הוגדר מייל לשליחה' });
    }

    const mailer = createMailer();
    if (!mailer) {
      return res.status(500).json({ error: 'SMTP לא מוגדר בשרת' });
    }

    const fileBuffer = await buildWorkbook();
    const fileName = `gift-selections-${new Date().toISOString().slice(0, 10)}.xlsx`;

    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'דוח בחירות מתנות עובדים',
      text: 'מצורף קובץ האקסל המעודכן של בחירות העובדים.',
      attachments: [
        {
          filename: fileName,
          content: fileBuffer,
        },
      ],
    });

    res.json({ success: true, sentTo: email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Gift selection app running on http://localhost:${PORT}`);
      if (!hasSupabase) {
        console.log('Supabase is not configured. Image uploads are stored locally in /uploads.');
      }
    });
  })
  .catch((err) => {
    console.error('Failed to initialize DB:', err);
    process.exit(1);
  });
