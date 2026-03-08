# אתר בחירת מתנות לעובדים

אפליקציית Node.js מלאה הכוללת:
- דף עובד לבחירת מתנה אחת בלבד
- ממשק ניהול מוגן בסיסמה (`Rn123456` כברירת מחדל)
- ניהול מתנות (שם/תיאור/כמות/תמונה)
- טבלת בחירות עובדים
- ייצוא Excel
- שמירת מייל ניהולי ושליחת דוח אקסל במייל

## הפעלה מקומית
```bash
npm install
copy .env.example .env
npm start
```

האפליקציה תעלה בכתובת: `http://localhost:3000`

## משתני סביבה חשובים
קובץ `.env`:
- `ADMIN_PASSWORD` סיסמת כניסה לניהול
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=gift-images` לחיבור אחסון תמונות בענן
- `SMTP_*` עבור שליחת קובץ האקסל למייל

אם Supabase לא מוגדר, תמונות ישמרו מקומית ב-`/uploads`.

## פריסה ב-Render דרך GitHub
1. העלה את הפרויקט ל-GitHub.
2. ב-Render: `New +` -> `Web Service` -> בחר את ה-repo.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. הגדר Environment Variables לפי `.env.example`.
6. לחץ Deploy.

לאחר הפריסה תקבל URL ציבורי שאפשר לשתף לעובדים.
