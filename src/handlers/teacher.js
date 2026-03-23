const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const {
  getUserByTelegramId,
  createUser,
  getGroupsByTeacher,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  addStudentToGroup,
  getStudentsByGroup,
  getStudentById,
  updateStudent,
  deleteStudent,
  addCoins,
  getStudentMonthlyCoins,
  getStudentTotalCoins,
  createHomework,
  getHomeworksByGroup,
  getHomeworkById,
  getSubmissionsByHomework,
  getSubmissionById,
  checkSubmission,
  getGroupStats
} = require('../supabase');

const {
  teacherMainMenu,
  groupsListKeyboard,
  studentsListKeyboard,
  cancelKeyboard,
  doneAddingStudentsKeyboard,
  finishHomeworkKeyboard,
  sendHomeworkKeyboard,
  checkHomeworkKeyboard,
  afterCheckKeyboard,
  studentMainMenu
} = require('../keyboards');

const { getFileInfo } = require('./common');
const { Markup } = require('telegraf');

// State management
const teacherStates = new Map();

function getState(userId) {
  return teacherStates.get(userId) || { step: 'idle', data: {} };
}

function setState(userId, step, data = {}) {
  teacherStates.set(userId, { step, data });
}

function clearState(userId) {
  teacherStates.delete(userId);
}

// =============================================
// MAIN HANDLER
// =============================================

async function handleTeacherText(ctx) {
  const userId = ctx.from.id;
  const text = ctx.message?.text || '';
  const state = getState(userId);

  if (state.step === 'idle') {
    switch (text) {
      case '➕ Guruh qo\'shish': return await startCreateGroup(ctx);
      case '🎓 O\'quvchi qo\'shish': return await startAddStudent(ctx);
      case '📋 Ro\'yxat': return await showGroupsList(ctx);
      case '🪙 Coin berish': return await startGiveCoin(ctx);
      case '📚 Vazifalar': return await showHomeworkMenu(ctx);
      case '📊 Statistika': return await showStatistics(ctx);
    }
    return;
  }

  await handleTeacherFlow(ctx, state, text);
}

async function handleTeacherFlow(ctx, state, text) {
  const userId = ctx.from.id;
  const fileInfo = ctx.message ? getFileInfo(ctx.message) : null;

  switch (state.step) {
    case 'create_group_name': return await processGroupName(ctx, text);
    case 'create_group_desc': return await processGroupDesc(ctx, text);
    case 'create_group_assistant_id': return await processAssistantId(ctx, text);
    case 'create_group_student_id': return await processGroupStudentId(ctx, text);
    case 'create_group_student_name': return await processGroupStudentName(ctx, text);
    case 'create_group_link': return await processGroupLink(ctx, text);

    case 'add_student_id': return await processAddStudentId(ctx, text);
    case 'add_student_name': return await processAddStudentName(ctx, text);

    case 'give_coin_amount': return await processCoinAmount(ctx, text);

    case 'homework_give_content':
      return await processHomeworkContent(ctx, fileInfo, text);
    case 'homework_give_deadline': return await processHomeworkDeadline(ctx, text);

    case 'homework_check_feedback': return await processHomeworkFeedback(ctx, fileInfo, text);
    case 'homework_check_coin': return await processHomeworkCoin(ctx, text);

    case 'edit_group_name': return await processEditGroupName(ctx, text);
    case 'edit_group_link': return await processEditGroupLink(ctx, text);
    case 'edit_student_name': return await processEditStudentName(ctx, text);
  }
}

// =============================================
// GURUH QO'SHISH
// =============================================

async function startCreateGroup(ctx) {
  setState(ctx.from.id, 'create_group_name', {});
  await ctx.reply(
    '➕ *Guruh qo\'shish*\n\nGuruh nomini yozing:',
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

async function processGroupName(ctx, text) {
  setState(ctx.from.id, 'create_group_desc', { name: text });
  await ctx.reply(
    '📝 Guruh tavsifini yozing:\n_(ixtiyoriy)_',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⏩ O\'tkazib yuborish', 'skip_group_desc')],
        [Markup.button.callback('❌ Bekor qilish', 'cancel')]
      ])
    }
  );
}

async function processGroupDesc(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);
  setState(userId, 'create_group_ask_assistant', { ...state.data, desc: text });
  await askAssistant(ctx);
}

async function askAssistant(ctx) {
  await ctx.reply(
    '🤝 Yordamchi ustoz qo\'shilsinmi?',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Ha', 'add_assistant_yes'),
        Markup.button.callback('❌ Yo\'q', 'add_assistant_no')
      ]
    ])
  );
}

async function processAssistantId(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);
  const assistantId = parseInt(text);

  if (isNaN(assistantId)) {
    return await ctx.reply('⚠️ Noto\'g\'ri ID. Raqam kiriting:');
  }

  const user = await getUserByTelegramId(assistantId);
  if (!user || user.role !== 'teacher') {
    return await ctx.reply('⚠️ Bu foydalanuvchi o\'qituvchi emas.');
  }

  setState(userId, 'create_group_student_id', {
    ...state.data,
    assistantTeacherId: user.id,
    students: []
  });

  await ctx.reply(
    `✅ Yordamchi: ${user.name || assistantId}\n\n🎓 O\'quvchi ID sini yuboring:`,
    doneAddingStudentsKeyboard()
  );
}

async function processGroupStudentId(ctx, text) {
  const userId = ctx.from.id;
  const studentId = parseInt(text);

  if (isNaN(studentId)) return await ctx.reply('⚠️ Noto\'g\'ri ID.');

  const state = getState(userId);
  setState(userId, 'create_group_student_name', { ...state.data, currentStudentId: studentId });
  await ctx.reply('✍️ O\'quvchining Ism Familiyasini yozing:');
}

async function processGroupStudentName(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);
  const students = [...(state.data.students || [])];
  students.push({ telegramId: state.data.currentStudentId, name: text });

  setState(userId, 'create_group_student_id', { ...state.data, students, currentStudentId: null });
  await ctx.reply(
    `✅ ${text} qo\'shildi. Jami: ${students.length} ta\n\nKeyingi o\'quvchi yoki "O\'quvchilar qo\'shildi":`,
    doneAddingStudentsKeyboard()
  );
}

async function processGroupLink(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);

  if (state.step !== 'create_group_link') return; // Lock

  // Clear state immediately to prevent multiple triggers
  clearState(userId);

  await ctx.reply('⏳ Guruh yaratilmoqda, iltimos kuting...');

  try {
    const teacherUser = await getUserByTelegramId(userId);

    const group = await createGroup(
      state.data.name,
      state.data.desc || '',
      teacherUser.id,
      text,
      state.data.assistantTeacherId || null
    );

    for (const student of (state.data.students || [])) {
      await addStudentToGroup(student.telegramId, student.name, group.id);
      try {
        await ctx.telegram.sendMessage(
          student.telegramId,
          `🎉 Siz *${group.name}* guruhiga qo\'shildingiz!`,
          { parse_mode: 'Markdown', ...studentMainMenu() }
        );
      } catch (e) {}
    }

    clearState(userId);
    await ctx.reply(
      `✅ *Guruh yaratildi!*\n\n📁 Nom: ${group.name}\n🎓 O\'quvchilar: ${state.data.students?.length || 0} ta`,
      { parse_mode: 'Markdown', ...teacherMainMenu() }
    );
  } catch (error) {
    console.error('Create group error:', error);
    await ctx.reply(`⚠️ Xatolik yuz berdi: ${error.message || error}`);
  }
}

// =============================================
// O'QUVCHI QO'SHISH
// =============================================

async function startAddStudent(ctx) {
  const teacherUser = await getUserByTelegramId(ctx.from.id);
  const groups = await getGroupsByTeacher(teacherUser.id);

  if (!groups.length) {
    return await ctx.reply('⚠️ Sizda hali guruh yo\'q. Avval guruh yarating.');
  }

  setState(ctx.from.id, 'add_student_select_group');
  await ctx.reply(
    '📁 Guruhni tanlang:',
    groupsListKeyboard(groups, 'teacher_addst_group')
  );
}

async function processAddStudentId(ctx, text) {
  const userId = ctx.from.id;
  const studentId = parseInt(text);
  if (isNaN(studentId)) return await ctx.reply('⚠️ Noto\'g\'ri ID.');

  const state = getState(userId);
  setState(userId, 'add_student_name', { ...state.data, studentTelegramId: studentId });
  await ctx.reply('✍️ Ism Familiyani yozing:');
}

async function processAddStudentName(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);

  try {
    const student = await addStudentToGroup(state.data.studentTelegramId, text, state.data.groupId);
    const group = await getGroupById(state.data.groupId);

    clearState(userId);
    await ctx.reply(
      `✅ *${text}* guruhga qo\'shildi!\n📁 Guruh: ${group?.name}`,
      { parse_mode: 'Markdown', ...teacherMainMenu() }
    );

    try {
      await ctx.telegram.sendMessage(
        state.data.studentTelegramId,
        `🎉 Siz *${group?.name}* guruhiga qo\'shildingiz!`,
        { parse_mode: 'Markdown', ...studentMainMenu() }
      );
    } catch (e) {}
  } catch (error) {
    await ctx.reply('⚠️ Xatolik yuz berdi.');
  }
}

// =============================================
// RO'YXAT
// =============================================

async function showGroupsList(ctx) {
  const teacherUser = await getUserByTelegramId(ctx.from.id);
  const groups = await getGroupsByTeacher(teacherUser.id);

  if (!groups.length) {
    return await ctx.reply('📋 Hali guruh yo\'q.');
  }

  const buttons = groups.map(g => [
    Markup.button.callback(`📁 ${g.name}`, `t_view_group_${g.id}`)
  ]);

  await ctx.reply('📋 *Guruhlaringiz:*', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

// Guruh ma'lumotlarini ko'rsatish
async function showGroupInfo(ctx, groupId) {
  const group = await getGroupById(groupId);
  if (!group) return;

  const students = await getStudentsByGroup(groupId);

  let text = `📁 *${group.name}*\n`;
  if (group.description) text += `📝 ${group.description}\n`;
  text += `🔗 Link: ${group.link || 'Yo\'q'}\n`;
  text += `\n🎓 O'quvchilar (${students.length} ta):\n`;

  const buttons = [
    ...students.map(s => [Markup.button.callback(`🎓 ${s.name}`, `t_student_${s.id}`)]),
    [
      Markup.button.callback('✏️ Nomini tahrirlash', `t_edit_group_${groupId}`),
      Markup.button.callback('🔗 Linkni tahrirlash', `t_edit_group_link_${groupId}`)
    ],
    [Markup.button.callback('🗑 O\'chirish', `t_delete_group_${groupId}`)],
    [Markup.button.callback('◀️ Orqaga', 'back_to_groups')]
  ];

  students.forEach((s, i) => { text += `${i + 1}. ${s.name}\n`; });

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

// =============================================
// COIN BERISH
// =============================================

async function startGiveCoin(ctx) {
  const teacherUser = await getUserByTelegramId(ctx.from.id);
  const groups = await getGroupsByTeacher(teacherUser.id);

  if (!groups.length) {
    return await ctx.reply('⚠️ Sizda guruh yo\'q.');
  }

  setState(ctx.from.id, 'give_coin_select_group');
  await ctx.reply('💰 *Coin berish*\n\nGuruhni tanlang:', {
    parse_mode: 'Markdown',
    ...groupsListKeyboard(groups, 'coin_group')
  });
}

async function processCoinAmount(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);
  const amount = parseInt(text);

  if (isNaN(amount) || amount <= 0) {
    return await ctx.reply('⚠️ To\'g\'ri miqdor kiriting (musbat son):');
  }

  try {
    const student = await getStudentById(state.data.studentId);
    await addCoins(state.data.studentId, amount, 'O\'qituvchi tomonidan');
    const total = await getStudentTotalCoins(state.data.studentId);

    clearState(userId);
    await ctx.reply(
      `✅ *${student.name}* ga ${amount} coin berildi!\n💰 Jami coini: ${total}`,
      { parse_mode: 'Markdown', ...teacherMainMenu() }
    );

    // O'quvchiga xabar
    try {
      await ctx.telegram.sendMessage(
        student.telegram_id,
        `🪙 Sizga *${amount} coin* berildi!\n💰 Jami coiningiz: ${total}`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {}
  } catch (error) {
    await ctx.reply('⚠️ Xatolik yuz berdi.');
  }
}

// =============================================
// VAZIFALAR
// =============================================

async function showHomeworkMenu(ctx) {
  await ctx.reply(
    '📚 *Vazifalar*',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📝 Vazifa berish', 'hw_give')],
        [Markup.button.callback('✅ Vazifa tekshirish', 'hw_check')]
      ])
    }
  );
}

// ---- VAZIFA BERISH ----

async function startGiveHomework(ctx) {
  const teacherUser = await getUserByTelegramId(ctx.from.id);
  const groups = await getGroupsByTeacher(teacherUser.id);

  if (!groups.length) {
    return await ctx.reply('⚠️ Sizda guruh yo\'q.');
  }

  setState(ctx.from.id, 'homework_give_select_group');
  await ctx.reply(
    '📝 *Vazifa berish*\n\nGuruhni tanlang:',
    { parse_mode: 'Markdown', ...groupsListKeyboard(groups, 'hwgive_group') }
  );
}

async function processHomeworkContent(ctx, fileInfo, text) {
  const userId = ctx.from.id;
  const state = getState(userId);

  const files = [...(state.data.files || [])];

  if (fileInfo) {
    files.push(fileInfo);
    setState(userId, 'homework_give_content', { ...state.data, files });
    await ctx.reply(
      `📎 Fayl qabul qilindi (${fileInfo.type}). Yana material yuborishingiz yoki yakunlashingiz mumkin:`,
      finishHomeworkKeyboard()
    );
  } else if (text) {
    setState(userId, 'homework_give_content', {
      ...state.data,
      files,
      description: (state.data.description || '') + text + '\n'
    });
    await ctx.reply('✅ Matn qabul qilindi. Yana material yoki yakunlang:', finishHomeworkKeyboard());
  }
}

async function processHomeworkDeadline(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);

  // Deadline format: DD.MM.YYYY HH:mm
  let deadline = null;
  try {
    deadline = dayjs(text, 'DD.MM.YYYY HH:mm').toDate();
    if (isNaN(deadline.getTime())) throw new Error('Invalid date');
  } catch {
    return await ctx.reply('⚠️ Noto\'g\'ri format. Misol: 25.03.2026 20:00');
  }

  setState(userId, 'homework_ready_to_send', { ...state.data, deadline: deadline.toISOString() });
  await ctx.reply(
    `📋 *Vazifa tayyorlandi!*\n\n📅 Deadline: ${text}\n\nYuborilsinmi?`,
    { parse_mode: 'Markdown', ...sendHomeworkKeyboard() }
  );
}

// ---- VAZIFA TEKSHIRISH ----

async function startCheckHomework(ctx) {
  const teacherUser = await getUserByTelegramId(ctx.from.id);
  const groups = await getGroupsByTeacher(teacherUser.id);

  if (!groups.length) {
    return await ctx.reply('⚠️ Sizda guruh yo\'q.');
  }

  setState(ctx.from.id, 'homework_check_select_group');
  await ctx.reply(
    '✅ *Vazifa tekshirish*\n\nGuruhni tanlang:',
    { parse_mode: 'Markdown', ...groupsListKeyboard(groups, 'hwcheck_group') }
  );
}

async function processHomeworkFeedback(ctx, fileInfo, text) {
  const userId = ctx.from.id;
  const state = getState(userId);

  try {
    const submission = await checkSubmission(state.data.submissionId, text || 'Tekshirildi');

    // Student'ga feedback yuborish
    const student = await getStudentById(submission.student_id);
    if (student) {
      try {
        if (fileInfo) {
          const { forwardFile } = require('./common');
          await forwardFile(ctx, student.telegram_id, fileInfo, `💬 O\'qituvchi xabari:\n${text || ''}`);
        } else {
          await ctx.telegram.sendMessage(
            student.telegram_id,
            `✅ Vazifangiz tekshirildi!\n\n💬 Feedback:\n${text || 'Tekshirildi'}`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (e) {}
    }

    setState(userId, 'homework_after_check', { ...state.data, submissionId: submission.id });
    await ctx.reply(
      '✅ *Feedback yuborildi!*\n\nNima qilishni xohlaysiz?',
      { parse_mode: 'Markdown', ...afterCheckKeyboard(submission.id) }
    );
  } catch (error) {
    console.error('Feedback error:', error);
    await ctx.reply('⚠️ Xatolik yuz berdi.');
  }
}

async function processHomeworkCoin(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);
  const amount = parseInt(text);

  if (isNaN(amount) || amount <= 0) {
    return await ctx.reply('⚠️ To\'g\'ri miqdor kiriting:');
  }

  try {
    const submission = await getSubmissionById(state.data.submissionId);
    const student = await getStudentById(submission.student_id);

    await addCoins(student.id, amount, 'Vazifa uchun');
    const total = await getStudentTotalCoins(student.id);

    clearState(userId);
    await ctx.reply(
      `✅ *${student.name}* ga ${amount} coin berildi!\n💰 Jami: ${total}`,
      { parse_mode: 'Markdown', ...teacherMainMenu() }
    );

    try {
      await ctx.telegram.sendMessage(
        student.telegram_id,
        `🪙 Vazifa uchun *${amount} coin* oldingiz!\n💰 Jami coiningiz: ${total}`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {}
  } catch (error) {
    await ctx.reply('⚠️ Xatolik yuz berdi.');
  }
}

// =============================================
// STATISTIKA
// =============================================

async function showStatistics(ctx) {
  const teacherUser = await getUserByTelegramId(ctx.from.id);
  const groups = await getGroupsByTeacher(teacherUser.id);

  if (!groups.length) {
    return await ctx.reply('📊 Hali statistika yo\'q.');
  }

  const buttons = groups.map(g => [
    Markup.button.callback(`📁 ${g.name}`, `t_stats_group_${g.id}`)
  ]);

  await ctx.reply('📊 *Statistika*\n\nGuruhni tanlang:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

// =============================================
// INLINE KEYBOARD HANDLER
// =============================================

async function handleTeacherActions(ctx) {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  const state = getState(userId);

  await ctx.answerCbQuery();

  if (data === 'cancel') {
    clearState(userId);
    return await ctx.reply('❌ Bekor qilindi.', teacherMainMenu());
  }

  // Guruh yaratish - skip desc
  if (data === 'skip_group_desc') {
    if (state.step === 'create_group_desc') {
      setState(userId, 'create_group_ask_assistant', { ...state.data, desc: '' });
      return await askAssistant(ctx);
    }
  }

  // Yordamchi ustoz
  if (data === 'add_assistant_yes') {
    const state2 = getState(userId);
    setState(userId, 'create_group_assistant_id', state2.data);
    return await ctx.reply('🤝 Yordamchi ustoz Telegram ID sini yuboring:', cancelKeyboard());
  }

  if (data === 'add_assistant_no') {
    const state2 = getState(userId);
    setState(userId, 'create_group_student_id', { ...state2.data, students: [] });
    return await ctx.reply(
      '🎓 O\'quvchi ID sini yuboring:',
      doneAddingStudentsKeyboard()
    );
  }

  // Done adding students (group creation)
  if (data === 'done_adding_students') {
    if (['create_group_student_id', 'create_group_student_name'].includes(state.step)) {
      setState(userId, 'create_group_link', state.data);
      return await ctx.reply(
        `✅ ${state.data.students?.length || 0} o\'quvchi qo\'shildi.\n\n🔗 Guruh linkini yuboring:`,
        cancelKeyboard()
      );
    }
  }

  // Group/Student Actions (Prefix based)
  if (data.startsWith('t_edit_group_link_')) {
    const groupId = parseInt(data.split('_')[4]);
    setState(userId, 'edit_group_link', { groupId });
    return await ctx.reply('🔗 Yangi guruh linkini yuboring:', cancelKeyboard());
  }

  if (data.startsWith('t_edit_group_')) {
    const groupId = parseInt(data.split('_')[3]);
    setState(userId, 'edit_group_name', { groupId });
    return await ctx.reply('✏️ Yangi guruh nomini yozing:', cancelKeyboard());
  }

  if (data.startsWith('t_delete_group_')) {
    const groupId = parseInt(data.split('_')[3]);
    const group = await getGroupById(groupId);
    if (!group) return;
    await deleteGroup(groupId);
    return await ctx.editMessageText(`✅ *${group.name}* guruhi o'chirildi.`, { parse_mode: 'Markdown' });
  }

  if (data.startsWith('t_edit_student_')) {
    const studentId = parseInt(data.split('_')[3]);
    setState(userId, 'edit_student_name', { studentId });
    return await ctx.reply('✏️ Yangi ism familiyani yozing:', cancelKeyboard());
  }

  if (data.startsWith('t_delete_student_')) {
    const studentId = parseInt(data.split('_')[3]);
    const student = await getStudentById(studentId);
    if (!student) return;
    await deleteStudent(studentId);
    return await ctx.editMessageText(`✅ *${student.name}* o'chirildi.`, { parse_mode: 'Markdown' });
  }

  if (data.startsWith('t_student_')) {
    const studentId = parseInt(data.split('_')[2]);
    const student = await getStudentById(studentId);
    if (!student) return;

    const totalCoins = await getStudentTotalCoins(student.id);
    const monthlyCoins = await getStudentMonthlyCoins(student.id);

    return await ctx.editMessageText(
      `🎓 *${student.name}*\n📁 Guruh: ${student.group?.name}\n🪙 Jami coin: ${totalCoins}\n📅 1 oylik: ${monthlyCoins}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Tahrirlash', `t_edit_student_${studentId}`)],
          [Markup.button.callback('🗑 O\'chirish', `t_delete_student_${studentId}`)],
          [Markup.button.callback('◀️ Orqaga', `t_view_group_${student.group_id}`)]
        ])
      }
    );
  }

  if (data.startsWith('t_view_group_')) {
    const groupId = parseInt(data.split('_')[3]);
    return await showGroupInfo(ctx, groupId);
  }

  if (data === 'back_to_groups') {
    clearState(userId);
    return await showGroupsList(ctx);
  }

  // O'quvchi qo'shish - guruh tanlash
  if (data.startsWith('teacher_addst_group_')) {
    const groupId = parseInt(data.split('_')[3]);
    setState(userId, 'add_student_id', { groupId });
    return await ctx.reply('📱 Student Telegram ID sini yuboring:', cancelKeyboard());
  }

  // Coin berish - guruh tanlash
  if (data.startsWith('coin_group_')) {
    const groupId = parseInt(data.split('_')[2]);
    const students = await getStudentsByGroup(groupId);
    if (!students.length) return await ctx.reply('⚠️ Bu guruhda o\'quvchi yo\'q.');

    setState(userId, 'give_coin_select_student', { groupId });
    return await ctx.editMessageText(
      '🎓 O\'quvchini tanlang:',
      studentsListKeyboard(students, 'coin_student')
    );
  }

  if (data.startsWith('coin_student_')) {
    const studentId = parseInt(data.split('_')[2]);
    const student = await getStudentById(studentId);
    setState(userId, 'give_coin_amount', { studentId });
    return await ctx.reply(`🪙 *${student?.name}* ga qancha coin beriladi?\n\nMiqdorni yozing:`, {
      parse_mode: 'Markdown',
      ...cancelKeyboard()
    });
  }

  // Homework - give
  if (data === 'hw_give') {
    return await startGiveHomework(ctx);
  }

  if (data === 'hw_check') {
    return await startCheckHomework(ctx);
  }

  if (data.startsWith('hwgive_group_')) {
    const groupId = parseInt(data.split('_')[2]);
    setState(userId, 'homework_give_content', { groupId, files: [], description: '' });
    return await ctx.reply(
      '📝 *Vazifa materialni yuboring*\n\nMatn, rasm, video, audio, PDF yuborishingiz mumkin.\nHammasi qo\'shilgandan keyin "Yakunlash" tugmasini bosing.',
      { parse_mode: 'Markdown', ...finishHomeworkKeyboard() }
    );
  }

  if (data === 'finish_homework') {
    setState(userId, 'homework_give_deadline', state.data);
    return await ctx.reply(
      '📅 Vazifa topshirish vaqtini belgilang:\n\nFormat: `DD.MM.YYYY HH:mm`\nMisol: `25.03.2026 20:00`',
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  if (data === 'send_homework') {
    const hwState = getState(userId);
    if (hwState.step !== 'homework_ready_to_send') return;

    try {
      const homework = await createHomework(
        hwState.data.groupId,
        hwState.data.description || '',
        hwState.data.files || [],
        hwState.data.deadline
      );

      const group = await getGroupById(hwState.data.groupId);
      const students = await getStudentsByGroup(hwState.data.groupId);
      const deadline = dayjs(hwState.data.deadline).format('DD.MM.YYYY HH:mm');

      // Guruh chatiga yuborish
      if (group?.link) {
        // Link faqat t.me/ formati bo'lishi kerak
      }

      // Har bir studentga yuborish
      for (const student of students) {
        try {
          let text = `📚 *Yangi vazifa!*\n📁 Guruh: ${group?.name}\n📅 Deadline: ${deadline}\n\n`;
          if (hwState.data.description) text += hwState.data.description;

          await ctx.telegram.sendMessage(student.telegram_id, text, { parse_mode: 'Markdown' });

          // Fayllarni yuborish
          const { forwardFile } = require('./common');
          for (const file of (hwState.data.files || [])) {
            await forwardFile(ctx, student.telegram_id, file);
          }
        } catch (e) {}
      }

      clearState(userId);
      await ctx.reply(
        `✅ Vazifa ${students.length} ta o\'quvchiga yuborildi!`,
        teacherMainMenu()
      );
    } catch (error) {
      console.error('Send homework error:', error);
      await ctx.reply('⚠️ Xatolik yuz berdi.');
    }
  }

  // Homework - check
  if (data.startsWith('hwcheck_group_')) {
    const groupId = parseInt(data.split('_')[2]);
    const homeworks = await getHomeworksByGroup(groupId);

    if (!homeworks.length) {
      return await ctx.reply('⚠️ Bu guruhda hali vazifa yo\'q.');
    }

    setState(userId, 'homework_check_select_hw', { groupId });

    const buttons = homeworks.map((h, i) => [
      Markup.button.callback(
        `📝 ${i + 1}-vazifa (${dayjs(h.created_at).format('DD.MM')})`,
        `hwcheck_hw_${h.id}`
      )
    ]);
    buttons.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);

    return await ctx.editMessageText('📝 Vazifani tanlang:', Markup.inlineKeyboard(buttons));
  }

  if (data.startsWith('hwcheck_hw_')) {
    const hwId = parseInt(data.split('_')[2]);
    const submissions = await getSubmissionsByHomework(hwId);

    if (!submissions.length) {
      return await ctx.reply('📭 Hali hech kim topshirmagan.');
    }

    setState(userId, 'homework_check_select_student', { hwId });

    const notChecked = submissions.filter(s => !s.checked);
    const buttons = notChecked.map(s => [
      Markup.button.callback(`🎓 ${s.student?.name || 'O\'quvchi'}`, `hwcheck_sub_${s.id}`)
    ]);

    if (!buttons.length) {
      return await ctx.reply('✅ Barcha vazifalar tekshirilgan.');
    }

    buttons.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
    return await ctx.editMessageText(
      `📋 Topshirganlar: ${submissions.length} ta\n✅ Tekshirilmagan: ${notChecked.length} ta\n\nO\'quvchini tanlang:`,
      Markup.inlineKeyboard(buttons)
    );
  }

  if (data.startsWith('hwcheck_sub_')) {
    const submissionId = parseInt(data.split('_')[2]);
    const submission = await getSubmissionById(submissionId);
    if (!submission) return;

    setState(userId, 'homework_check_view', { submissionId });

    // Fayllarni ko'rsatish
    let text = `📋 *${submission.student?.name}* vazifasi\n📅 ${dayjs(submission.submitted_at).format('DD.MM.YYYY HH:mm')}`;
    if (submission.comment) text += `\n💬 Izoh: ${submission.comment}`;

    await ctx.reply(text, { parse_mode: 'Markdown' });

    // Fayllarni yuborish
    const { sendFile } = require('./common');
    for (const file of (submission.file_ids || [])) {
      await sendFile(ctx, file);
    }

    await ctx.reply('Vazifani tekshirish:', checkHomeworkKeyboard(submissionId));
  }

  if (data.startsWith('check_submission_')) {
    const submissionId = parseInt(data.split('_')[2]);
    setState(userId, 'homework_check_feedback', { submissionId });
    return await ctx.reply(
      '💬 Feedback yuboring:\n\n_Matn, ovozli xabar, video yoki rasm yuborishingiz mumkin_',
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  if (data.startsWith('send_feedback_')) {
    const submissionId = parseInt(data.split('_')[2]);
    setState(userId, 'homework_check_feedback', { submissionId });
    return await ctx.reply('💬 Xabar yuboring:', cancelKeyboard());
  }

  if (data.startsWith('give_coin_')) {
    const submissionId = parseInt(data.split('_')[2]);
    setState(userId, 'homework_check_coin', { submissionId });
    return await ctx.reply('🪙 Coin miqdorini yozing:', cancelKeyboard());
  }

  if (data === 'check_done') {
    clearState(userId);
    return await ctx.reply('✅ Tekshirish yakunlandi.', teacherMainMenu());
  }

  // Statistics
  if (data.startsWith('t_stats_group_')) {
    const groupId = parseInt(data.split('_')[3]);
    const group = await getGroupById(groupId);
    if (!group) return;

    const stats = await getGroupStats(groupId);

    let text = `📊 *${group.name}* statistikasi\n`;
    text += `👥 O\'quvchilar: ${stats.length} ta\n\n`;

    stats.forEach((s, i) => {
      text += `${i + 1}. *${s.name}*\n`;
      text += `   🪙 1 oy: ${s.monthlyCoins} coin\n`;
      text += `   💰 Jami: ${s.totalCoins} coin\n\n`;
    });

    const buttons = stats.map(s => [
      Markup.button.callback(`🎓 ${s.name}`, `t_stats_student_${s.id}`)
    ]);
    buttons.push([Markup.button.callback('◀️ Orqaga', 'teacher_stats_back')]);

    return await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  }

  if (data.startsWith('t_stats_student_')) {
    const studentId = parseInt(data.split('_')[3]);
    const student = await getStudentById(studentId);
    if (!student) return;

    const { getStudentFullStats } = require('../supabase');
    const stats = await getStudentFullStats(studentId);

    let text = `📊 *${student.name}*\n`;
    text += `📁 Guruh: ${student.group?.name}\n`;
    text += `💰 Jami coin: ${stats.totalCoins}\n`;
    text += `📅 1 oylik coin: ${stats.monthlyCoins}\n\n`;
    text += `📝 Vazifalar:\n`;

    stats.submissions.slice(0, 5).forEach((sub, i) => {
      const hw = sub.homework;
      text += `${i + 1}. ${dayjs(hw?.created_at).format('DD.MM')}`;
      text += sub.checked ? ' ✅' : ' ⏳';
      text += '\n';
    });

    return await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Orqaga', `t_stats_group_${student.group_id}`)]
      ])
    });
  }

  if (data === 'teacher_stats_back') {
    return await showStatistics(ctx);
  }
}

// Tahrirlash
async function processEditGroupName(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);
  try {
    await updateGroup(state.data.groupId, { name: text });
    clearState(userId);
    await ctx.reply(`✅ Guruh nomi *${text}* ga o\'zgartirildi.`, {
      parse_mode: 'Markdown', ...teacherMainMenu()
    });
  } catch (e) {
    await ctx.reply('⚠️ Xatolik yuz berdi.');
  }
}

async function processEditStudentName(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);
  try {
    await updateStudent(state.data.studentId, { name: text });
    clearState(userId);
    await ctx.reply(`✅ O'quvchi ismi *${text}* ga o'zgartirildi.`, {
      parse_mode: 'Markdown', ...teacherMainMenu()
    });
  } catch (e) {
    await ctx.reply('⚠️ Xatolik yuz berdi.');
  }
}

async function processEditGroupLink(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);
  try {
    await updateGroup(state.data.groupId, { link: text });
    clearState(userId);
    await ctx.reply(`✅ Guruh linki yangilandi: ${text}`, {
      parse_mode: 'Markdown', ...teacherMainMenu()
    });
  } catch (e) {
    await ctx.reply('⚠️ Xatolik yuz berdi.');
  }
}

module.exports = { handleTeacherText, handleTeacherActions };
