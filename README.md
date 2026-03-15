# 🎓 EduFlow Bot

Premium ta'lim Telegram boti — **Node.js + Supabase (PostgreSQL)**

---

## ⚡ Tezkor Ishga Tushirish

### 1. O'rnating
```bash
npm install
```

### 2. `.env` faylini sozlang
```bash
cp .env.example .env
```
`.env` ichida to'ldiring:
```
BOT_TOKEN=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPER_ADMIN_ID=SIZNING_TELEGRAM_ID
TIMEZONE=Asia/Tashkent
```

### 3. Ma'lumotlar bazasini yarating
Supabase → SQL Editor → `src/database/schema.sql` ni ishga tushiring.

Keyin o'zingizni admin sifatida qo'shing:
```sql
INSERT INTO users (id, first_name, role)
VALUES (SIZNING_TELEGRAM_ID, 'Admin', 'admin');
```

### 4. Ishga tushiring
```bash
npm run dev    # Rivojlantirish
npm start      # Ishlab chiqarish
```

---

## 📁 Fayl Tuzilmasi

```
src/
├── bot.js                   ← Asosiy fayl (barcha handlerlarni bog'laydi)
├── database/
│   ├── supabase.js          ← Supabase ulanishi
│   └── schema.sql           ← Jadvallar yaratish SQL
├── handlers/
│   ├── admin.js             ← Super Admin paneli
│   ├── teacher.js           ← O'qituvchi paneli
│   └── student.js           ← O'quvchi paneli
├── middleware/
│   └── auth.js              ← Rol asosida kirish tekshiruvi
├── services/
│   └── reminder.js          ← Avtomatik eslatmalar (cron job)
└── utils/
    ├── keyboards.js         ← Barcha tugmalar
    ├── helpers.js           ← Yordamchi funksiyalar
    └── state.js             ← Suhbat holati boshqaruvi
```

---

## 👥 Rollar

| Rol | Imkoniyatlar |
|-----|-------------|
| 👑 Admin | O'qituvchi/o'quvchi qo'shish, guruh yaratish, o'quvchilarni guruhlarga biriktirish, statistika |
| 👨‍🏫 Teacher | Vazifa berish, guruhga vazifa berish, topshirilganlarni ko'rish |
| 🎓 Student | Vazifa olish, topshirish, natijalar |

---

## 🏷 Guruhlar Sistemi

Admin guruhlarni yaratishi va o'qituvchilarni biriktirishi mumkin:

1. **Guruh yaratish**: Admin guruh nomi, tavsifi va o'qituvchisini belgilaydi
2. **O'quvchilarni biriktirish**: Admin o'quvchilarni guruhlarga biriktiradi
3. **Guruhga vazifa berish**: O'qituvchi guruhga vazifa bersa, barcha o'quvchilar oladi
4. **Avtomatik yuborish**: Guruh vazifasi avtomatik ravishda guruhdagi barcha o'quvchilarga yuboriladi

---

## 🔔 Eslatmalar

| Vaqt | Kimga | Xabar |
|------|-------|-------|
| 6 soat qoldi | O'quvchi | ⚠️ Eslatma + Topshirish tugmasi |
| 1 soat qoldi | O'quvchi | 🚨 Shoshilinch ogohlantirish |
| Muddat o'tdi | O'quvchi + O'qituvchi | 🔴 Muddat o'tdi bildirishnomasi |

---

## 🚀 Production (PM2)

```bash
npm install -g pm2
pm2 start src/bot.js --name eduflow-bot
pm2 save && pm2 startup
pm2 logs eduflow-bot
```
# premiumenglishhomework
