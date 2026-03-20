# 🎓 Premium English Nazorat Bot

Node.js + Supabase asosida qurilgan to'liq funksional Telegram bot.

## 📋 Panellar

| Panel | Funksiyalar |
|-------|-------------|
| **Admin** | O'qituvchi/Admin qo'shish, Guruh yaratish, Ro'yxat, Statistika |
| **Teacher** | Guruh/O'quvchi boshqarish, Coin berish, Vazifa berish/tekshirish, Statistika |
| **Student** | Vazifa yuborish, Tekshirilgan vazifalar, Profil, Reyting |

---

## ⚙️ O'rnatish

### 1. Loyihani yuklab olish
```bash
git clone <repo-url>
cd premium-english-bot
npm install
```

### 2. .env fayl yaratish
```bash
cp .env.example .env
```

`.env` faylini tahrirlang:
```env
BOT_TOKEN=your_bot_token_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
INITIAL_ADMIN_ID=your_telegram_id
```

### 3. Supabase sozlash

1. [supabase.com](https://supabase.com) ga o'ting
2. Yangi project yarating
3. **SQL Editor** ga o'ting
4. `src/database/schema.sql` faylidagi kodni nusxalab bajaring
5. Project URL va Service Role Key ni `.env` ga yozing

### 4. Botni ishga tushirish
```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```

---

## 🔑 Birinchi Admin

`.env` fayldagi `INITIAL_ADMIN_ID` ga o'z Telegram ID ingizni yozing.

Telegram ID topish:
- [@userinfobot](https://t.me/userinfobot) ga yozing

---

## 📁 Loyiha strukturasi

```
premium-english-bot/
├── src/
│   ├── index.js              # Asosiy kirish nuqtasi
│   ├── supabase.js           # Database funksiyalari
│   ├── keyboards.js          # Klaviatura tugmalari
│   ├── handlers/
│   │   ├── common.js         # Umumiy handlerlari
│   │   ├── admin.js          # Admin panel
│   │   ├── teacher.js        # Teacher panel
│   │   └── student.js        # Student panel
│   └── database/
│       └── schema.sql        # Database sxemasi
├── package.json
├── .env.example
└── README.md
```

---

## 🗄️ Database jadvallari

| Jadval | Tavsif |
|--------|--------|
| `users` | Barcha foydalanuvchilar (admin/teacher/student) |
| `groups` | Guruhlar |
| `students` | O'quvchilar |
| `homeworks` | Vazifalar |
| `homework_submissions` | Topshirilgan vazifalar |
| `coins` | Coin tarixi |

---

## 🚀 Deployment (Server)

### PM2 bilan (tavsiya etiladi)
```bash
npm install -g pm2
pm2 start src/index.js --name "english-bot"
pm2 save
pm2 startup
```

### Docker bilan
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node", "src/index.js"]
```

---

## 📞 Yordam

Xatolik yuz bersa, `console.log` chiqishini ko'ring yoki Supabase dashboard da jadvallarni tekshiring.
