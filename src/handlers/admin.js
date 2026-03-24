const {
  getUserByTelegramId,
  createUser,
  updateUserRole,
  getTeachers,
  getTeacherById,
  deleteTeacher,
  createGroup,
  getAllGroups,
  getGroupsByTeacher,
  getGroupById,
  updateGroup,
  deleteGroup,
  addStudentToGroup,
  getStudentsByGroup,
  getStudentById,
  updateStudent,
  deleteStudent,
  getGroupStats,
  getTeacherStats
} = require('../supabase');

const {
  adminMainMenu,
  teachersListKeyboard,
  groupsListKeyboard,
  studentsListKeyboard,
  teacherGroupsManageKeyboard,
  groupManageKeyboard,
  studentManageKeyboard,
  teacherManageKeyboard,
  confirmKeyboard,
  skipKeyboard,
  doneAddingStudentsKeyboard,
  deleteTeacherKeyboard,
  cancelKeyboard
} = require('../keyboards');

const { escapeMarkdown } = require('./common');

// Admin state'larini boshqarish
const adminStates = new Map();

function getState(userId) {
  return adminStates.get(userId) || { step: 'idle', data: {} };
}

function setState(userId, step, data = {}) {
  adminStates.set(userId, { step, data });
}

function clearState(userId) {
  adminStates.delete(userId);
}

// =============================================
// MAIN MENU HANDLER
// =============================================

async function handleAdminText(ctx) {
  const userId = ctx.from.id;
  const text = ctx.message?.text || '';
  const state = getState(userId);

  // Menu tugmalari
  if (state.step === 'idle') {
    switch (text) {
      case '👨‍🏫 O\'qituvchi qo\'shish':
        return await startAddTeacher(ctx);
      case '👥 Guruh yaratish':
        return await startCreateGroup(ctx);
      case '🎓 O\'quvchi qo\'shish':
        return await startAddStudentAdmin(ctx);
      case '👤 Admin qo\'shish':
        return await startAddAdmin(ctx);
      case '📋 Ro\'yxat':
        return await showListMenu(ctx);
      case '📊 Statistika':
        return await showStatisticsMenu(ctx);
    }
    return;
  }

  // Multi-step flows
  await handleAdminFlow(ctx, state, text);
}

async function handleAdminFlow(ctx, state, text) {
  const userId = ctx.from.id;

  switch (state.step) {
    // === O'qituvchi qo'shish ===
    case 'add_teacher_waiting_id':
      return await processAddTeacherId(ctx, text);

    // === Guruh yaratish ===
    case 'create_group_name':
      return await processCreateGroupName(ctx, text);
    case 'create_group_desc':
      return await processCreateGroupDesc(ctx, text);
    case 'create_group_teacher_id':
      return await processCreateGroupTeacherId(ctx, text);
    case 'create_group_student_id':
      return await processCreateGroupStudentId(ctx, text);
    case 'create_group_student_name':
      return await processCreateGroupStudentName(ctx, text);
    case 'create_group_link':
      return await processCreateGroupLink(ctx, text);

    // === O'quvchi qo'shish ===
    case 'add_student_id':
      return await processAddStudentId(ctx, text);
    case 'add_student_name':
      return await processAddStudentName(ctx, text);

    // === Admin qo'shish ===
    case 'add_admin_waiting_id':
      return await processAddAdminId(ctx, text);

    // === Tahrirlash ===
    case 'edit_teacher_name':
      return await processEditTeacherName(ctx, text);
    case 'edit_group_name':
      return await processEditGroupName(ctx, text);
    case 'edit_group_link':
      return await processEditGroupLink(ctx, text);
    case 'edit_student_name':
      return await processEditStudentName(ctx, text);
  }
}

// =============================================
// O'QITUVCHI QO'SHISH
// =============================================

async function startAddTeacher(ctx) {
  setState(ctx.from.id, 'add_teacher_waiting_id');
  await ctx.reply(
    '👨‍🏫 *O\'qituvchi qo\'shish*\n\nO\'qituvchi bo\'ladigan foydalanuvchining Telegram ID sini yuboring:',
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

async function processAddTeacherId(ctx, text) {
  const userId = ctx.from.id;
  const targetId = parseInt(text.trim());

  if (isNaN(targetId)) {
    return await ctx.reply('⚠️ Noto\'g\'ri ID. Raqam kiriting:');
  }

  if (targetId === userId) {
    return await ctx.reply('⚠️ O\'zingizni o\'qituvchi qilib qo\'shmang, aks holda Admin panelidan mahrum bo\'lasiz.');
  }

  try {
    let user = await getUserByTelegramId(targetId);
    
    if (!user) {
      user = await createUser(targetId, `Ustoz ${targetId}`, 'teacher');
    } else if (user.role === 'teacher') {
      clearState(userId);
      const safeName = (user.name || 'Noma\'lum').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return await ctx.reply(`ℹ️ <b>Bu foydalanuvchi allaqachon o'qituvchi sifatida mavjud.</b>\n\n👨‍🏫 ID: <code>${targetId}</code>\nIsm: ${safeName}`, {
        parse_mode: 'HTML',
        ...adminMainMenu()
      });
    } else {
      // Mavjud user rolimni yangilash
      await updateUserRole(targetId, 'teacher');
      user = await getUserByTelegramId(targetId);
    }

    clearState(userId);

    const safeNameSuccess = (user?.name || 'Noma\'lum').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await ctx.reply(
      `✅ <b>O'qituvchi qo'shildi!</b>\n\n👨‍🏫 ID: <code>${targetId}</code>\nIsm: ${safeNameSuccess}\nRole: Teacher`,
      { parse_mode: 'HTML', ...adminMainMenu() }
    );

    // O'qituvchiga xabar yuborish
    try {
      const { teacherMainMenu } = require('../keyboards');
      await ctx.telegram.sendMessage(
        targetId,
        '🎉 <b>Siz o\'qituvchi roliga o\'tkazildingiz!</b>\n\n👨‍🏫 <b>TEACHER PANEL</b> ochildi.\nBotni /start qilib qaytadan ishga tushiring.',
        { parse_mode: 'HTML', ...teacherMainMenu() }
      );
    } catch (msgError) {
      console.warn(`O'qituvchiga xabar yuborilmadi: ${msgError.message}`);
    }
  } catch (error) {
    console.error('Add teacher error:', error);
    await ctx.reply(`⚠️ Xatolik yuz berdi: ${error.message || error}`);
  }
}


// =============================================
// GURUH YARATISH
// =============================================

async function startCreateGroup(ctx) {
  setState(ctx.from.id, 'create_group_name', {});
  await ctx.reply(
    '👥 *Guruh yaratish*\n\nGuruh nomini yozing:',
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

async function processCreateGroupName(ctx, text) {
  const userId = ctx.from.id;
  setState(userId, 'create_group_desc', { name: text });
  await ctx.reply(
    '📝 Guruh tavsifini yozing:\n_(ixtiyoriy — o\'tkazib yuborish mumkin)_',
    { parse_mode: 'Markdown', ...skipKeyboard('skip_group_desc') }
  );
}

async function processCreateGroupDesc(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);
  setState(userId, 'create_group_teacher_id', { ...state.data, desc: text });
  await ctx.reply(
    '👨‍🏫 Ustoz qo\'shing.\n\nTeacher Telegram ID sini yuboring:',
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

async function processCreateGroupTeacherId(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);
  const teacherId = parseInt(text);

  if (isNaN(teacherId)) {
    return await ctx.reply('⚠️ Noto\'g\'ri ID. Raqam kiriting:');
  }

  const user = await getUserByTelegramId(teacherId);
  if (!user || user.role !== 'teacher') {
    return await ctx.reply('⚠️ Bu foydalanuvchi o\'qituvchi emas. Avval o\'qituvchi sifatida qo\'shing.');
  }

  setState(userId, 'create_group_student_id', {
    ...state.data,
    teacherTelegramId: teacherId,
    teacherUserId: user.id,
    students: []
  });

  await ctx.reply(
    `✅ O\'qituvchi: ${user.name || teacherId}\n\n🎓 *O\'quvchi qo\'shish*\nStudent Telegram ID sini yuboring:`,
    { parse_mode: 'Markdown', ...doneAddingStudentsKeyboard() }
  );
}

async function processCreateGroupStudentId(ctx, text) {
  const userId = ctx.from.id;
  const studentId = parseInt(text);

  if (isNaN(studentId)) {
    return await ctx.reply('⚠️ Noto\'g\'ri ID. Raqam kiriting:');
  }

  const state = getState(userId);
  setState(userId, 'create_group_student_name', {
    ...state.data,
    currentStudentId: studentId
  });

  await ctx.reply('✍️ O\'quvchining Ism Familiyasini yozing:');
}

async function processCreateGroupStudentName(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);

  const students = state.data.students || [];
  students.push({ telegramId: state.data.currentStudentId, name: text });

  setState(userId, 'create_group_student_id', {
    ...state.data,
    students,
    currentStudentId: null
  });

  await ctx.reply(
    `✅ O\'quvchi qo\'shildi: ${text}\n\nJami: ${students.length} o\'quvchi\n\nKeyingi o\'quvchi ID sini yuboring yoki "O\'quvchilar qo\'shildi" tugmasini bosing:`,
    doneAddingStudentsKeyboard()
  );
}

async function processCreateGroupLink(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);

  if (state.step !== 'create_group_link') return; // Lock: already processing or processed
  
  // Set to idle immediately to prevent duplicate triggers
  clearState(userId);

  await ctx.reply('⏳ Guruh yaratilmoqda, iltimos kuting...');

  try {
    // Guruhni yaratish
    const group = await createGroup(
      state.data.name,
      state.data.desc || '',
      state.data.teacherUserId,
      text
    );

    // O'quvchilarni guruhga qo'shish
    for (const student of (state.data.students || [])) {
      await addStudentToGroup(student.telegramId, student.name, group.id);
    }

    clearState(userId);

    await ctx.reply(
      `✅ *Guruh muvaffaqiyatli yaratildi!*\n\n📁 Nom: ${escapeMarkdown(group.name)}\n👨‍🏫 O\'qituvchi ID: ${state.data.teacherTelegramId}\n🎓 O\'quvchilar: ${state.data.students?.length || 0} ta\n🔗 Link: ${text}`,
      { parse_mode: 'Markdown', ...adminMainMenu() }
    );
  } catch (error) {
    console.error('Create group error:', error);
    await ctx.reply(`⚠️ Xatolik yuz berdi: ${error.message || error}`);
  }
}

// =============================================
// O'QUVCHI QO'SHISH (Admin)
// =============================================

async function startAddStudentAdmin(ctx) {
  const teachers = await getTeachers();
  if (!teachers.length) {
    return await ctx.reply('⚠️ Hali o\'qituvchi yo\'q. Avval o\'qituvchi qo\'shing.');
  }

  setState(ctx.from.id, 'add_student_select_teacher');
  await ctx.reply(
    '🎓 *O\'quvchi qo\'shish*\n\nO\'qituvchini tanlang:',
    { parse_mode: 'Markdown', ...teachersListKeyboard(teachers) }
  );
}

async function processAddStudentId(ctx, text) {
  const userId = ctx.from.id;
  const studentId = parseInt(text);

  if (isNaN(studentId)) {
    return await ctx.reply('⚠️ Noto\'g\'ri ID. Raqam kiriting:');
  }

  const state = getState(userId);
  setState(userId, 'add_student_name', { ...state.data, studentTelegramId: studentId });
  await ctx.reply('✍️ O\'quvchining Ism Familiyasini yozing:');
}

async function processAddStudentName(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);

  try {
    const student = await addStudentToGroup(
      state.data.studentTelegramId,
      text,
      state.data.groupId
    );

    clearState(userId);
    const group = await getGroupById(state.data.groupId);

    await ctx.reply(
      `✅ *O\'quvchi qo\'shildi!*\n\n🎓 Ism: ${escapeMarkdown(text)}\n📁 Guruh: ${escapeMarkdown(group?.name || 'Noma\'lum')}`,
      { parse_mode: 'Markdown', ...adminMainMenu() }
    );

    // O'quvchiga xabar
    try {
      const { studentMainMenu } = require('../keyboards');
      await ctx.telegram.sendMessage(
        state.data.studentTelegramId,
        `🎉 Siz *${group?.name}* guruhiga qo\'shildingiz!\n\n🎓 *STUDENT PANEL* ochildi.`,
        { parse_mode: 'Markdown', ...studentMainMenu() }
      );
    } catch (e) {}
  } catch (error) {
    console.error('Add student error:', error);
    await ctx.reply('⚠️ Xatolik yuz berdi.');
  }
}

// =============================================
// ADMIN QO'SHISH
// =============================================

async function startAddAdmin(ctx) {
  setState(ctx.from.id, 'add_admin_waiting_id');
  await ctx.reply(
    '👤 *Admin qo\'shish*\n\nAdmin bo\'ladigan foydalanuvchining Telegram ID sini yuboring:',
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

async function processAddAdminId(ctx, text) {
  const userId = ctx.from.id;
  const targetId = parseInt(text);

  if (isNaN(targetId)) {
    return await ctx.reply('⚠️ Noto\'g\'ri ID. Raqam kiriting:');
  }

  try {
    let user = await getUserByTelegramId(targetId);
    if (!user) {
      user = await createUser(targetId, `Admin ${targetId}`, 'admin');
    } else {
      await updateUserRole(targetId, 'admin');
    }

    clearState(userId);
    await ctx.reply(
      `✅ *Admin qo\'shildi!*\n\n👤 ID: \`${targetId}\``,
      { parse_mode: 'Markdown', ...adminMainMenu() }
    );

    try {
      await ctx.telegram.sendMessage(
        targetId,
        '🎉 Siz Admin roliga o\'tkazildingiz!\n\n🔐 *ADMIN PANEL* ochildi.',
        { parse_mode: 'Markdown', ...adminMainMenu() }
      );
    } catch (e) {}
  } catch (error) {
    console.error('Add admin error:', error);
    await ctx.reply('⚠️ Xatolik yuz berdi.');
  }
}

// =============================================
// RO'YXAT
// =============================================

async function showListMenu(ctx) {
  await ctx.reply(
    '📋 *Ro\'yxat*\n\nQaysi ro\'yxatni ko\'rmoqchisiz?',
    {
      parse_mode: 'Markdown',
      ...require('telegraf').Markup.inlineKeyboard([
        [require('telegraf').Markup.button.callback('👨‍🏫 O\'qituvchilar', 'list_teachers')],
        [require('telegraf').Markup.button.callback('📁 Guruhlar', 'list_groups')]
      ])
    }
  );
}

async function showTeachersList(ctx) {
  const teachers = await getTeachers();
  if (!teachers.length) {
    return await ctx.editMessageText('📋 Hali o\'qituvchi yo\'q.', { parse_mode: 'Markdown' });
  }

  let text = '👨‍🏫 *O\'qituvchilar ro\'yxati:*\n\n';
  const buttons = teachers.map(t => [
    require('telegraf').Markup.button.callback(`👨‍🏫 ${t.name || 'Ustoz'} (${t.telegram_id})`, `manage_teacher_${t.id}`)
  ]);
  buttons.push([require('telegraf').Markup.button.callback('◀️ Orqaga', 'back_to_list_menu')]);

  await ctx.editMessageText(text + `Jami: ${teachers.length} ta o\'qituvchi`, {
    parse_mode: 'Markdown',
    ...require('telegraf').Markup.inlineKeyboard(buttons)
  });
}

async function showGroupsList(ctx) {
  const teachers = await getTeachers();
  if (!teachers.length) {
    return await ctx.editMessageText('📋 Hali guruh yo\'q.');
  }

  let text = '📁 *Guruhlar ro\'yxati:*\n\n';
  const allGroups = await getAllGroups();

  for (const teacher of teachers) {
    const teacherGroups = allGroups.filter(g => g.teacher_id === teacher.id);
    if (teacherGroups.length) {
      text += `👨‍🏫 *${escapeMarkdown(teacher.name || 'Ustoz')} (${teacher.telegram_id})*\n`;
      teacherGroups.forEach(g => {
        text += `  📁 ${escapeMarkdown(g.name)}${g.link ? ` [Link](${g.link})` : ''}\n`;
      });
      text += '\n';
    }
  }

  const buttons = teachers.map(t => [
    require('telegraf').Markup.button.callback(
      `👨‍🏫 ${t.name || 'Ustoz'}`,
      `teacher_groups_${t.id}`
    )
  ]);
  buttons.push([require('telegraf').Markup.button.callback('◀️ Orqaga', 'back_to_list_menu')]);

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...require('telegraf').Markup.inlineKeyboard(buttons)
  });
}

// =============================================
// STATISTIKA
// =============================================

async function showStatisticsMenu(ctx) {
  const teachers = await getTeachers();
  if (!teachers.length) {
    return await ctx.reply('📊 Hali statistika yo\'q.');
  }

  const buttons = teachers.map(t => [
    require('telegraf').Markup.button.callback(
      `👨‍🏫 ${t.name || 'Ustoz'} (${t.telegram_id})`,
      `stats_teacher_${t.id}`
    )
  ]);

  await ctx.reply(
    '📊 *Statistika*\n\nO\'qituvchini tanlang:',
    { parse_mode: 'Markdown', ...require('telegraf').Markup.inlineKeyboard(buttons) }
  );
}

async function showTeacherStats(ctx, teacherUserId) {
  const teacher = await getTeacherById(teacherUserId);
  if (!teacher) return await ctx.answerCbQuery('O\'qituvchi topilmadi');

  const groups = await getGroupsByTeacher(teacherUserId);

  let text = `📊 *${escapeMarkdown(teacher.name || 'O\'qituvchi')} statistikasi*\n\n`;
  text += `Jami guruhlar: ${groups.length} ta\n\n`;

  let totalStudents = 0;
  for (const group of groups) {
    const stats = await getGroupStats(group.id);
    totalStudents += stats.length;
    text += `📁 *${escapeMarkdown(group.name)}* — ${stats.length} o\'quvchi\n`;
    stats.slice(0, 5).forEach(s => {
      text += `  🎓 ${escapeMarkdown(s.name)} — ${s.monthlyCoins} coin (1 oylik)\n`;
    });
    text += '\n';
  }

  text += `\n👥 Jami o\'quvchilar: ${totalStudents} ta`;

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...require('telegraf').Markup.inlineKeyboard([
      [require('telegraf').Markup.button.callback('◀️ Orqaga', 'admin_stats_back')]
    ])
  });
}

// =============================================
// INLINE KEYBOARD (CALLBACK) HANDLER
// =============================================

async function handleAdminActions(ctx) {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  const state = getState(userId);

  await ctx.answerCbQuery();

  // Cancel
  if (data === 'cancel') {
    clearState(userId);
    return await ctx.reply('❌ Bekor qilindi.', adminMainMenu());
  }

  // Skip group description
  if (data === 'skip_group_desc') {
    if (state.step === 'create_group_desc') {
      setState(userId, 'create_group_teacher_id', { ...state.data, desc: '' });
      return await ctx.reply(
        '👨‍🏫 Ustoz qo\'shing.\n\nTeacher Telegram ID sini yuboring:',
        cancelKeyboard()
      );
    }
  }

  // Done adding students
  if (data === 'done_adding_students') {
    if (state.step === 'create_group_student_id' || state.step === 'create_group_student_name') {
      setState(userId, 'create_group_link', state.data);
      return await ctx.reply(
        `✅ ${state.data.students?.length || 0} ta o'quvchi qo'shildi.\n\n🔗 Guruh Telegram linkini yuboring:`,
        cancelKeyboard()
      );
    }
  }

  // Statistics
  if (data.startsWith('stats_teacher_')) {
    const teacherUserId = parseInt(data.split('_')[2]);
    return await showTeacherStats(ctx, teacherUserId);
  } else if (data === 'admin_stats_back') {
    return await showStatisticsMenu(ctx);
  }

  // Teacher groups list
  if (data.startsWith('teacher_groups_')) {
    const teacherId = parseInt(data.split('_')[2]);
    const teacher = await getTeacherById(teacherId);
    if (!teacher) return;

    const groups = await getGroupsByTeacher(teacherId);
    const buttons = groups.map(g => [
      require('telegraf').Markup.button.callback(`📁 ${g.name}`, `view_group_${g.id}`)
    ]);
    buttons.push([require('telegraf').Markup.button.callback('◀️ Orqaga', 'list_groups')]);

    return await ctx.editMessageText(
      `👨‍🏫 *${teacher.name || 'Ustoz'}* guruhlari:`,
      {
        parse_mode: 'Markdown',
        ...require('telegraf').Markup.inlineKeyboard(buttons)
      }
    );
  }

  // View group and its students
  if (data.startsWith('view_group_')) {
    const groupId = parseInt(data.split('_')[2]);
    const group = await getGroupById(groupId);
    if (!group) return;

    const students = await getStudentsByGroup(groupId);

    let text = `📁 *${group.name}*\n👨‍🏫 O'qituvchi: ${group.teacher?.name || 'Noma\'lum'}\n🔗 Link: ${group.link || 'Yo\'q'}\n\n🎓 O'quvchilar (${students.length} ta):\n`;
    students.forEach((s, i) => {
      text += `${i + 1}. ${s.name}\n`;
    });

    const studentsButtons = students.map(s => [
      require('telegraf').Markup.button.callback(`🎓 ${s.name}`, `admin_student_${s.id}`)
    ]);

    const buttons = [
      ...studentsButtons,
      [
        require('telegraf').Markup.button.callback('✏️ Nomini tahrirlash', `edit_group_${groupId}`),
        require('telegraf').Markup.button.callback('🔗 Linkni tahrirlash', `edit_group_link_${groupId}`)
      ],
      [require('telegraf').Markup.button.callback('🗑 O\'chirish', `delete_group_${groupId}`)],
      [require('telegraf').Markup.button.callback('◀️ Orqaga', `teacher_groups_${group.teacher_id}`)]
    ];

    return await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...require('telegraf').Markup.inlineKeyboard(buttons)
    });
  }

  // Delete group
  if (data.startsWith('delete_group_')) {
    const groupId = parseInt(data.split('_')[2]);
    const group = await getGroupById(groupId);
    if (!group) return;

    await deleteGroup(groupId);
    await ctx.editMessageText(`✅ *${group.name}* guruhi muvaffaqiyatli o'chirildi.`);
    return await ctx.reply('Asosiy menyuga qaytdingiz.', adminMainMenu());
  }

  // Select teacher for adding student
  if (data.startsWith('teacher_') && !data.includes('_groups_') && !data.includes('stats_')) {
    const teacherId = parseInt(data.split('_')[1]);
    const groups = await getGroupsByTeacher(teacherId);
    if (!groups.length) {
      return await ctx.answerCbQuery('⚠️ Bu o\'qituvchida guruh yo\'q.', { show_alert: true });
    }

    setState(userId, 'add_student_select_group', { teacherUserId: teacherId });
    return await ctx.editMessageText(
      '📁 Guruhni tanlang:',
      groupsListKeyboard(groups, 'addstudent_group')
    );
  }

  // List menu
  if (data === 'list_teachers') return await showTeachersList(ctx);
  if (data === 'list_groups') return await showGroupsList(ctx);
  if (data === 'back_to_list_menu') return await showListMenu(ctx);

  // Remaining actions...
  if (data.startsWith('manage_teacher_')) {
    const teacherId = parseInt(data.split('_')[2]);
    const teacher = await getTeacherById(teacherId);
    if (!teacher) return;
    const groups = await getGroupsByTeacher(teacherId);
    let text = `👨‍🏫 *${teacher.name || 'Ustoz'}*\nID: \`${teacher.telegram_id}\`\nGuruhlar: ${groups.length} ta`;
    return await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...require('telegraf').Markup.inlineKeyboard([
        [require('telegraf').Markup.button.callback('✏️ Tahrirlash', `edit_teacher_${teacherId}`)],
        [require('telegraf').Markup.button.callback('🗑 O\'chirish', `delete_teacher_${teacherId}`)],
        [require('telegraf').Markup.button.callback('◀️ Orqaga', 'list_teachers')]
      ])
    });
  }

  if (data.startsWith('edit_teacher_')) {
    const teacherId = parseInt(data.split('_')[2]);
    setState(userId, 'edit_teacher_name', { teacherId });
    return await ctx.reply('✏️ Yangi ism familiyani yozing:', cancelKeyboard());
  }

  if (data.startsWith('delete_teacher_')) {
    const teacherId = parseInt(data.split('_')[2]);
    const teacher = await getTeacherById(teacherId);
    if (!teacher) return;
    return await ctx.editMessageText(`⚠️ *${teacher.name || 'Ustoz'}* o'qituvchisini o'chirishni tasdiqlaysizmi?\nGuruhlar ham o'chiriladi!`, {
      parse_mode: 'Markdown',
      ...deleteTeacherKeyboard(teacherId)
    });
  }

  if (data.startsWith('delete_with_groups_')) {
    const teacherId = parseInt(data.split('_')[3]);
    const teacher = await getTeacherById(teacherId);
    if (!teacher) return;
    const groups = await getGroupsByTeacher(teacherId);
    for (const group of groups) { await deleteGroup(group.id); }
    await deleteTeacher(teacherId);
    await ctx.editMessageText(`✅ O'qituvchi va ${groups.length} ta guruh o'chirildi.`);
    return await ctx.reply('Asosiy menyuga qaytdingiz.', adminMainMenu());
  }

  if (data.startsWith('admin_student_')) {
    const studentId = parseInt(data.split('_')[2]);
    const student = await getStudentById(studentId);
    if (!student) return;
    return await ctx.editMessageText(`🎓 *${student.name}*\nGuruh: ${student.group?.name || 'Noma\'lum'}`, {
      parse_mode: 'Markdown',
      ...require('telegraf').Markup.inlineKeyboard([
        [require('telegraf').Markup.button.callback('✏️ Tahrirlash', `edit_student_${studentId}`)],
        [require('telegraf').Markup.button.callback('🗑 O\'chirish', `delete_student_${studentId}`)],
        [require('telegraf').Markup.button.callback('◀️ Orqaga', `view_group_${student.group_id}`)]
      ])
    });
  }

  if (data.startsWith('edit_student_')) {
    const studentId = parseInt(data.split('_')[2]);
    setState(userId, 'edit_student_name', { studentId });
    return await ctx.reply('✏️ Yangi ism familiyani yozing:', cancelKeyboard());
  }

  if (data.startsWith('delete_student_')) {
    const studentId = parseInt(data.split('_')[2]);
    const student = await getStudentById(studentId);
    if (!student) return;
    await deleteStudent(studentId);
    return await ctx.editMessageText(`✅ *${student.name}* o'quvchi o'chirildi.`, {
      parse_mode: 'Markdown', ...require('telegraf').Markup.inlineKeyboard([[require('telegraf').Markup.button.callback('◀️ Orqaga', `view_group_${student.group_id}`)]])
    });
  }

  if (data.startsWith('edit_group_link_')) {
    const groupId = parseInt(data.split('_')[3]);
    setState(userId, 'edit_group_link', { groupId });
    return await ctx.reply('🔗 Yangi guruh linkini yuboring:', cancelKeyboard());
  }

  if (data.startsWith('edit_group_')) {
    const groupId = parseInt(data.split('_')[2]);
    setState(userId, 'edit_group_name', { groupId });
    return await ctx.reply('✏️ Yangi guruh nomini yozing:', cancelKeyboard());
  }

  if (data.startsWith('addstudent_group_')) {
    const groupId = parseInt(data.split('_')[2]);
    const state2 = getState(userId);
    setState(userId, 'add_student_id', { ...state2.data, groupId });
    return await ctx.reply('🎓 Student Telegram ID sini yuboring:', cancelKeyboard());
  }

  if (data === 'back_to_teachers') {
    return await showTeachersList(ctx);
  }
}

// =============================================
// TAHRIRLASH JARAYONLARI
// =============================================

async function processEditTeacherName(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);

  try {
    await require('../supabase').supabase
      .from('users')
      .update({ name: text })
      .eq('id', state.data.teacherId);

    clearState(userId);
    await ctx.reply(`✅ O'qituvchi ismi *${text}* ga o'zgartirildi.`, {
      parse_mode: 'Markdown',
      ...adminMainMenu()
    });
  } catch (error) {
    console.error('Edit teacher name error:', error);
    await ctx.reply('⚠️ Xatolik yuz berdi.');
  }
}

async function processEditGroupName(ctx, text) {
  const userId = ctx.from.id;
  const state = getState(userId);

  try {
    await updateGroup(state.data.groupId, { name: text });
    clearState(userId);
    await ctx.reply(`✅ Guruh nomi *${text}* ga o'zgartirildi.`, {
      parse_mode: 'Markdown',
      ...adminMainMenu()
    });
  } catch (error) {
    console.error('Edit group name error:', error);
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
      parse_mode: 'Markdown',
      ...adminMainMenu()
    });
  } catch (error) {
    console.error('Edit group link error:', error);
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
      parse_mode: 'Markdown',
      ...adminMainMenu()
    });
  } catch (error) {
    console.error('Edit student name error:', error);
    await ctx.reply('⚠️ Xatolik yuz berdi.');
  }
}

module.exports = { handleAdminText, handleAdminActions };
