require('dotenv').config();
const { Telegraf } = require('telegraf');

const { handleStart, showPanel } = require('./handlers/common');
const { handleAdminText, handleAdminActions, clearState: clearAdminState } = require('./handlers/admin');
const { handleTeacherText, handleTeacherActions, clearState: clearTeacherState } = require('./handlers/teacher');
const { handleStudentText, handleStudentActions, clearState: clearStudentState } = require('./handlers/student');
const { getUserRole, getUserByTelegramId, createUser } = require('./supabase');

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN topilmadi! .env faylini tekshiring.');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL yoki SUPABASE_SERVICE_KEY topilmadi!');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// =============================================
// HEALTH CHECK & SELF-PING (for Render)
// =============================================

const http = require('http');
const https = require('https');
const port = process.env.PORT || 3000;

// Health check server (Render uchun kerak)
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running\n');
}).listen(port, () => {
  console.log(`📡 Health check server listening on port ${port}`);
});

// Self-ping mechanism (Keep-alive)
function keepAlive() {
  const url = process.env.RENDER_URL;
  if (!url) {
    console.warn('⚠️ RENDER_URL topilmadi. Avtomatik uyg\'otish ishlamaydi.');
    return;
  }

  const pingInterval = parseInt(process.env.PING_INTERVAL) || 600000; // Har 10 daqiqada
  const client = url.startsWith('https') ? https : http;

  setInterval(() => {
    client.get(url, (res) => {
      console.log(`[${new Date().toISOString()}] 🚀 Keep-alive ping: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error('❌ Keep-alive error:', err.message);
    });
  }, pingInterval);
}

keepAlive();

// =============================================
// MIDDLEWARE
// =============================================

// Logging middleware
bot.use(async (ctx, next) => {
  const from = ctx.from;
  if (from) {
    const type = ctx.updateType;
    const text = ctx.message?.text || ctx.callbackQuery?.data || '';
    console.log(`[${new Date().toISOString()}] ${type} from ${from.id} (${from.first_name}): ${text.slice(0, 50)}`);
  }
  return next();
});

// Command helpers
function clearAllStates(userId) {
  clearAdminState(userId);
  clearTeacherState(userId);
  clearStudentState(userId);
}

// =============================================
// COMMANDS
// =============================================

bot.command('start', async (ctx) => {
  clearAllStates(ctx.from.id);
  await handleStart(ctx);
});

// Admin panel refresh
bot.command(['panel', 'menu'], async (ctx) => {
  clearAllStates(ctx.from.id);
  const user = await getUserByTelegramId(ctx.from.id);
  if (!user) return await ctx.reply('Siz ro\'yxatdan o\'tmadingiz. /start bosing.');
  const name = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim();
  await showPanel(ctx, user.role, name);
});

bot.command('cancel', async (ctx) => {
  clearAllStates(ctx.from.id);
  await ctx.reply('❌ Amal bekor qilindi.', {
    reply_markup: { remove_keyboard: true }
  });
  // Qayta panelni ko'rsatish
  const user = await getUserByTelegramId(ctx.from.id);
  if (user) {
    const name = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim();
    await showPanel(ctx, user.role, name);
  }
});

// =============================================
// TEXT MESSAGE HANDLER
// =============================================

bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;

  const userId = ctx.from.id;

  try {
    const user = await getUserByTelegramId(userId);

    if (!user) return; // Begona foydalanuvchini ignore qilish

    switch (user.role) {
      case 'admin':
        await handleAdminText(ctx);
        break;
      case 'teacher':
        await handleTeacherText(ctx);
        break;
      case 'student':
        await handleStudentText(ctx);
        break;
      default:
        await ctx.reply('Sizning rolingiz aniqlanmadi. /start bosing.');
    }
  } catch (error) {
    console.error('Text handler error:', error);
    await ctx.reply('⚠️ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
  }
});

// =============================================
// MEDIA MESSAGE HANDLER
// =============================================

const mediaTypes = ['photo', 'video', 'audio', 'document', 'voice', 'video_note', 'sticker'];

bot.on(mediaTypes, async (ctx) => {
  const userId = ctx.from.id;

  try {
    const user = await getUserByTelegramId(userId);
    if (!user) return;

    switch (user.role) {
      case 'teacher':
        await handleTeacherText(ctx);
        break;
      case 'student':
        await handleStudentText(ctx);
        break;
    }
  } catch (error) {
    console.error('Media handler error:', error);
  }
});

// =============================================
// CALLBACK QUERY HANDLER (Inline buttons)
// =============================================

bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;

  try {
    const user = await getUserByTelegramId(userId);

    if (!user) {
      await ctx.answerCbQuery(); // Faqat xabarni yopamiz
      return;
    }

    switch (user.role) {
      case 'admin':
        await handleAdminActions(ctx);
        break;
      case 'teacher':
        await handleTeacherActions(ctx);
        break;
      case 'student':
        await handleStudentActions(ctx);
        break;
    }
  } catch (error) {
    console.error('Callback handler error:', error);
    try {
      await ctx.answerCbQuery('⚠️ Xatolik yuz berdi.');
    } catch (e) {}
  }
});

// =============================================
// ERROR HANDLER
// =============================================

bot.catch((err, ctx) => {
  console.error('Global bot error:', err);
  try {
    ctx.reply('⚠️ Kutilmagan xatolik yuz berdi. /start bosib qaytadan urinib ko\'ring.');
  } catch (e) {}
});

// =============================================
// LAUNCH
// =============================================

bot.launch().then(() => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   🚀 Premium English Bot ishga tushdi  ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
  console.log(`📅 ${new Date().toLocaleString('uz-UZ')}`);
  console.log(`🤖 Bot: @${process.env.BOT_USERNAME || 'Premium_English_Bot'}`);
  console.log('');
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n⛔ Bot to\'xtatildi (SIGINT)');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('\n⛔ Bot to\'xtatildi (SIGTERM)');
  bot.stop('SIGTERM');
});
