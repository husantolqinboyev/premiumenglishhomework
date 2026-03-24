require('dotenv').config();
const {
  getUserByTelegramId,
  createUser,
  updateUserRole
} = require('../supabase');
const { adminMainMenu, teacherMainMenu, studentMainMenu } = require('../keyboards');

// /start komandasi
async function handleStart(ctx) {
  const telegramId = ctx.from.id;
  const userName = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim();

  try {
    let user = await getUserByTelegramId(telegramId);

    // Agar user yo'q bo'lsa
    if (!user) {
      const initialAdminId = parseInt(process.env.INITIAL_ADMIN_ID);
      
      // Faqat initial admin'ni bazaga qo'shamiz
      if (telegramId === initialAdminId) {
        user = await createUser(telegramId, userName, 'admin');
        await showPanel(ctx, user.role, userName);
      } else {
        // Begona userlar uchun
        await ctx.reply('🚫 *Sizga kirish mumkin emas!*\n\nIltimos, botdan foydalanish uchun o\'qituvchi bilan bog\'laning.', { parse_mode: 'Markdown' });
      }
      return;
    }

    await showPanel(ctx, user.role, userName);
  } catch (error) {
    console.error('Start error:', error);
    await ctx.reply('⚠️ Xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.');
  }
}

// Panel ko'rsatish
async function showPanel(ctx, role, name = '') {
  if (role === 'admin') {
    await ctx.reply(
      `🔐 *ADMIN PANEL*\n\nXush kelibsiz, ${escapeMarkdown(name)}!`,
      { parse_mode: 'Markdown', ...adminMainMenu() }
    );
  } else if (role === 'teacher') {
    await ctx.reply(
      `👨‍🏫 *TEACHER PANEL*\n\nXush kelibsiz, ${escapeMarkdown(name)}!`,
      { parse_mode: 'Markdown', ...teacherMainMenu() }
    );
  } else if (role === 'student') {
    await ctx.reply(
      `🎓 *STUDENT PANEL*\n\nXush kelibsiz, ${escapeMarkdown(name)}!`,
      { parse_mode: 'Markdown', ...studentMainMenu() }
    );
  } else {
    await ctx.reply(
      '👋 Siz hali hech qaysi guruhga qo\'shilmagansiz.\n\nO\'qituvchingizga murojaat qiling.'
    );
  }
}

// Fayl turini aniqlash
function getFileInfo(message) {
  if (message.photo) {
    const photo = message.photo[message.photo.length - 1];
    return { type: 'photo', file_id: photo.file_id };
  }
  if (message.video) return { type: 'video', file_id: message.video.file_id };
  if (message.audio) return { type: 'audio', file_id: message.audio.file_id };
  if (message.voice) return { type: 'voice', file_id: message.voice.file_id };
  if (message.document) return { type: 'document', file_id: message.document.file_id };
  if (message.video_note) return { type: 'video_note', file_id: message.video_note.file_id };
  return null;
}

// Faylni foydalanuvchiga yuborish
async function sendFile(ctx, fileInfo, caption = '') {
  try {
    if (fileInfo.type === 'photo') {
      await ctx.replyWithPhoto(fileInfo.file_id, { caption });
    } else if (fileInfo.type === 'video') {
      await ctx.replyWithVideo(fileInfo.file_id, { caption });
    } else if (fileInfo.type === 'audio') {
      await ctx.replyWithAudio(fileInfo.file_id, { caption });
    } else if (fileInfo.type === 'voice') {
      await ctx.replyWithVoice(fileInfo.file_id, { caption });
    } else if (fileInfo.type === 'document') {
      await ctx.replyWithDocument(fileInfo.file_id, { caption });
    } else if (fileInfo.type === 'video_note') {
      await ctx.replyWithVideoNote(fileInfo.file_id);
    }
  } catch (error) {
    console.error('Send file error:', error);
  }
}

// Faylni boshqa chatga yuborish
async function forwardFile(bot, chatId, fileInfo, caption = '') {
  try {
    if (fileInfo.type === 'photo') {
      await bot.telegram.sendPhoto(chatId, fileInfo.file_id, { caption });
    } else if (fileInfo.type === 'video') {
      await bot.telegram.sendVideo(chatId, fileInfo.file_id, { caption });
    } else if (fileInfo.type === 'audio') {
      await bot.telegram.sendAudio(chatId, fileInfo.file_id, { caption });
    } else if (fileInfo.type === 'voice') {
      await bot.telegram.sendVoice(chatId, fileInfo.file_id, { caption });
    } else if (fileInfo.type === 'document') {
      await bot.telegram.sendDocument(chatId, fileInfo.file_id, { caption });
    } else if (fileInfo.type === 'video_note') {
      await bot.telegram.sendVideoNote(chatId, fileInfo.file_id);
    } else if (fileInfo.type === 'text') {
      await bot.telegram.sendMessage(chatId, caption || fileInfo.text);
    }
  } catch (error) {
    console.error('Forward file error:', error);
  }
}

function escapeMarkdown(text) {
  if (!text) return '';
  // Markdown (Legacy) special characters: _, *, [, `
  return text.toString().replace(/([_*\[`])/g, '\\$1');
}

module.exports = { handleStart, showPanel, getFileInfo, sendFile, forwardFile, escapeMarkdown };
