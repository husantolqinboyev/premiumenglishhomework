const dayjs = require('dayjs');
const {
  getStudentByTelegramId,
  getStudentById,
  getHomeworksByGroup,
  submitHomework,
  getCheckedSubmissions,
  getSubmissionsByStudent,
  getStudentTotalCoins,
  getStudentMonthlyCoins,
  getStudentsByGroup
} = require('../supabase');

const {
  studentMainMenu,
  studentHomeworkDoneKeyboard,
  studentHomeworkSendKeyboard,
  cancelKeyboard
} = require('../keyboards');

const { getFileInfo } = require('./common');
const { Markup } = require('telegraf');

// State management
const studentStates = new Map();

function getState(userId) {
  return studentStates.get(userId) || { step: 'idle', data: {} };
}

function setState(userId, step, data = {}) {
  studentStates.set(userId, { step, data });
}

function clearState(userId) {
  studentStates.delete(userId);
}

// =============================================
// MAIN HANDLER
// =============================================

async function handleStudentText(ctx) {
  const userId = ctx.from.id;
  const text = ctx.message?.text || '';
  const state = getState(userId);
  const fileInfo = ctx.message ? getFileInfo(ctx.message) : null;

  if (state.step === 'idle') {
    switch (text) {
      case '📤 Vazifa yuborish': return await startSubmitHomework(ctx);
      case '✅ Tekshirilgan vazifalar': return await showCheckedHomeworks(ctx);
      case '👤 Profil': return await showProfile(ctx);
      case '🏆 Statistika': return await showStatistics(ctx);
    }
    return;
  }

  // File uploading
  if (fileInfo && state.step === 'homework_sending') {
    return await processHomeworkFile(ctx, fileInfo);
  }

  // Comment
  if (state.step === 'homework_comment') {
    return await processHomeworkComment(ctx, text);
  }
}

// =============================================
// VAZIFA YUBORISH
// =============================================

async function startSubmitHomework(ctx) {
  const userId = ctx.from.id;

  const student = await getStudentByTelegramId(userId);
  if (!student || !student.group_id) {
    return await ctx.reply('⚠️ Siz hali hech qaysi guruhga qo\'shilmagansiz.');
  }

  const homeworks = await getHomeworksByGroup(student.group_id);
  if (!homeworks.length) {
    return await ctx.reply('📭 Hozirda aktiv vazifa yo\'q.');
  }

  // Deadline o'tmagan vazifalarni filter
  const now = new Date();
  const activeHomeworks = homeworks.filter(h => !h.deadline || new Date(h.deadline) > now);

  if (!activeHomeworks.length) {
    return await ctx.reply('⏰ Barcha vazifalar deadline\'dan o\'tdi.');
  }

  setState(userId, 'homework_select', { studentId: student.id });

  const buttons = activeHomeworks.map((h, i) => {
    const deadline = h.deadline ? dayjs(h.deadline).format('DD.MM HH:mm') : 'yo\'q';
    return [Markup.button.callback(
      `📝 ${i + 1}-vazifa (deadline: ${deadline})`,
      `student_hw_${h.id}`
    )];
  });
  buttons.push([Markup.button.callback('❌ Bekor qilish', 'student_cancel')]);

  await ctx.reply(
    '📤 *Vazifa yuborish*\n\nVazifani tanlang:',
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
  );
}

async function processHomeworkFile(ctx, fileInfo) {
  const userId = ctx.from.id;
  const state = getState(userId);

  const files = [...(state.data.files || [])];
  files.push(fileInfo);

  setState(userId, 'homework_sending', { ...state.data, files });

  await ctx.reply(
    `✅ ${fileInfo.type} qabul qilindi!\n\nYana fayl yuborishingiz yoki "Yakunlash" tugmasini bosishingiz mumkin:`,
    studentHomeworkDoneKeyboard()
  );
}

async function processHomeworkComment(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);

  setState(userId, 'homework_ready', { ...state.data, comment: text });
  await ctx.reply(
    `📋 *Vazifa tayyorlandi!*\n💬 Izoh: ${text}\n\nYuborilsinmi?`,
    { parse_mode: 'Markdown', ...studentHomeworkSendKeyboard() }
  );
}

// =============================================
// TEKSHIRILGAN VAZIFALAR
// =============================================

async function showCheckedHomeworks(ctx) {
  const student = await getStudentByTelegramId(ctx.from.id);
  if (!student) return await ctx.reply('⚠️ Profil topilmadi.');

  const checked = await getCheckedSubmissions(student.id);

  if (!checked.length) {
    return await ctx.reply('📭 Hali tekshirilgan vazifa yo\'q.');
  }

  let text = '✅ *Tekshirilgan vazifalar:*\n\n';

  checked.forEach((sub, i) => {
    const hw = sub.homework;
    const submittedDate = dayjs(sub.submitted_at).format('DD.MM.YYYY');
    const checkedDate = dayjs(sub.checked_at).format('DD.MM.YYYY');

    text += `*${i + 1}-vazifa*\n`;
    text += `📅 Topshirilgan: ${submittedDate}\n`;
    text += `✅ Tekshirilgan: ${checkedDate}\n`;
    if (sub.feedback) text += `💬 Feedback: ${sub.feedback}\n`;
    text += '\n';
  });

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

// =============================================
// PROFIL
// =============================================

async function showProfile(ctx) {
  const student = await getStudentByTelegramId(ctx.from.id);
  if (!student) return await ctx.reply('⚠️ Profil topilmadi.');

  const totalCoins = await getStudentTotalCoins(student.id);
  const monthlyCoins = await getStudentMonthlyCoins(student.id);
  const joinedDate = dayjs(student.joined_date).format('DD.MM.YYYY');

  const text = `👤 *Mening profilim*\n\n` +
    `🆔 ID: \`${ctx.from.id}\`\n` +
    `👤 Ism: ${student.name}\n` +
    `📁 Guruh: ${student.group?.name || 'Noma\'lum'}\n` +
    `📅 Qo\'shilgan: ${joinedDate}\n` +
    `💰 Jami coin: ${totalCoins}\n` +
    `📅 1 oylik coin: ${monthlyCoins}`;

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

// =============================================
// STATISTIKA (Reyting)
// =============================================

async function showStatistics(ctx) {
  const student = await getStudentByTelegramId(ctx.from.id);
  if (!student || !student.group_id) {
    return await ctx.reply('⚠️ Siz hali guruhga qo\'shilmagansiz.');
  }

  const students = await getStudentsByGroup(student.group_id);

  // Coinlarni yig'ish
  const studentStats = [];
  for (const s of students) {
    const monthly = await getStudentMonthlyCoins(s.id);
    studentStats.push({ ...s, monthlyCoins: monthly });
  }

  studentStats.sort((a, b) => b.monthlyCoins - a.monthlyCoins);

  let text = `🏆 *${student.group?.name} reytingi*\n_(so\'nggi 30 kun)_\n\n`;

  studentStats.forEach((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const isMe = s.telegram_id === ctx.from.id ? ' ← Siz' : '';
    text += `${medal} ${s.name} — ${s.monthlyCoins} coin${isMe}\n`;
  });

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

// =============================================
// INLINE KEYBOARD HANDLER
// =============================================

async function handleStudentActions(ctx) {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  const state = getState(userId);

  await ctx.answerCbQuery();

  if (data === 'student_cancel') {
    clearState(userId);
    return await ctx.reply('❌ Bekor qilindi.', studentMainMenu());
  }

  // Vazifa tanlash
  if (data.startsWith('student_hw_')) {
    const hwId = parseInt(data.split('_')[2]);
    const hw = await require('../supabase').getHomeworkById(hwId);
    if (!hw) return;

    setState(userId, 'homework_sending', {
      homeworkId: hwId,
      studentId: state.data.studentId,
      files: []
    });

    let text = `📝 *Vazifa*\n`;
    if (hw.description) text += `${hw.description}\n`;
    if (hw.deadline) text += `\n⏰ Deadline: ${dayjs(hw.deadline).format('DD.MM.YYYY HH:mm')}`;
    text += '\n\n📎 Endi vazifangizni yuboring (fayl, rasm, video, audio...)';

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...studentHomeworkDoneKeyboard()
    });

    // Homework fayllarini ko'rsatish
    const { sendFile } = require('./common');
    for (const file of (hw.file_ids || [])) {
      await sendFile(ctx, file);
    }
  }

  // Yakunlash
  if (data === 'student_homework_done') {
    if (state.step !== 'homework_sending') return;

    if (!state.data.files?.length) {
      return await ctx.reply('⚠️ Hali hech qanday fayl yubormagansiz. Avval fayl yuboring.');
    }

    setState(userId, 'homework_comment', state.data);
    await ctx.reply(
      '💬 Izoh yozing _(ixtiyoriy)_:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('⏩ O\'tkazib yuborish', 'student_skip_comment')],
          [Markup.button.callback('❌ Bekor qilish', 'student_cancel')]
        ])
      }
    );
  }

  // Comment skip
  if (data === 'student_skip_comment') {
    setState(userId, 'homework_ready', { ...state.data, comment: '' });
    await ctx.reply(
      '📋 Vazifa yuborilsinmi?',
      studentHomeworkSendKeyboard()
    );
  }

  // Yuborish
  if (data === 'student_send_homework') {
    const currentState = getState(userId);

    try {
      const student = await getStudentById(currentState.data.studentId || state.data.studentId);
      if (!student) return;

      const submission = await submitHomework(
        student.id,
        currentState.data.homeworkId || state.data.homeworkId,
        currentState.data.files || state.data.files || [],
        currentState.data.comment || state.data.comment || ''
      );

      // O'qituvchiga xabar
      const { getGroupById } = require('../supabase');
      const group = await getGroupById(student.group_id);

      if (group) {
        // O'qituvchi Telegram ID sini topish
        const { supabase } = require('../supabase');
        const { data: teacherUser } = await supabase
          .from('users')
          .select('telegram_id')
          .eq('id', group.teacher_id)
          .single();

        if (teacherUser) {
          try {
            await ctx.telegram.sendMessage(
              teacherUser.telegram_id,
              `📬 *Yangi vazifa topshirildi!*\n\n🎓 O\'quvchi: ${student.name}\n📁 Guruh: ${group.name}`,
              { parse_mode: 'Markdown' }
            );

            const { forwardFile } = require('./common');
            for (const file of (currentState.data.files || state.data.files || [])) {
              await forwardFile(ctx, teacherUser.telegram_id, file);
            }
          } catch (e) {}
        }
      }

      clearState(userId);
      await ctx.reply(
        '✅ *Vazifa muvaffaqiyatli yuborildi!*\n\nO\'qituvchi tekshirib, javob beradi.',
        { parse_mode: 'Markdown', ...studentMainMenu() }
      );
    } catch (error) {
      console.error('Submit homework error:', error);
      await ctx.reply('⚠️ Xatolik yuz berdi.');
    }
  }
}

module.exports = { handleStudentText, handleStudentActions };
