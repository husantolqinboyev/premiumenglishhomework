const { Markup } = require('telegraf');

// =============================================
// ADMIN PANEL KEYBOARDS
// =============================================

const adminMainMenu = () =>
  Markup.keyboard([
    ['👨‍🏫 O\'qituvchi qo\'shish', '👥 Guruh yaratish'],
    ['🎓 O\'quvchi qo\'shish', '👤 Admin qo\'shish'],
    ['📋 Ro\'yxat', '📊 Statistika']
  ]).resize();

// =============================================
// TEACHER PANEL KEYBOARDS
// =============================================

const teacherMainMenu = () =>
  Markup.keyboard([
    ['➕ Guruh qo\'shish', '🎓 O\'quvchi qo\'shish'],
    ['📋 Ro\'yxat', '🪙 Coin berish'],
    ['📚 Vazifalar', '📊 Statistika']
  ]).resize();

// =============================================
// STUDENT PANEL KEYBOARDS
// =============================================

const studentMainMenu = () =>
  Markup.keyboard([
    ['📤 Vazifa yuborish', '✅ Tekshirilgan vazifalar'],
    ['👤 Profil', '🏆 Statistika']
  ]).resize();

// =============================================
// INLINE KEYBOARDS
// =============================================

const teachersListKeyboard = (teachers) => {
  const buttons = teachers.map(t =>
    [Markup.button.callback(`👨‍🏫 ${t.name || 'Ustoz'} (ID: ${t.telegram_id})`, `teacher_${t.id}`)]
  );
  buttons.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(buttons);
};

const groupsListKeyboard = (groups, prefix = 'group') => {
  const buttons = groups.map(g =>
    [Markup.button.callback(`📁 ${g.name}`, `${prefix}_${g.id}`)]
  );
  buttons.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(buttons);
};

const studentsListKeyboard = (students, prefix = 'student') => {
  const buttons = students.map(s =>
    [Markup.button.callback(`🎓 ${s.name}`, `${prefix}_${s.id}`)]
  );
  buttons.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(buttons);
};

const teacherGroupsManageKeyboard = (teacher, groups) => {
  const teacherName = teacher.name || `ID: ${teacher.telegram_id}`;
  const buttons = groups.map(g => [
    Markup.button.callback(`📁 ${g.name}`, `manage_group_${g.id}`)
  ]);
  buttons.push([Markup.button.callback('◀️ Orqaga', 'back_to_teachers')]);
  return Markup.inlineKeyboard(buttons);
};

const groupManageKeyboard = (groupId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✏️ Tahrirlash', `edit_group_${groupId}`)],
    [Markup.button.callback('🗑 O\'chirish', `delete_group_${groupId}`)],
    [Markup.button.callback('◀️ Orqaga', 'back_to_teachers')]
  ]);

const studentManageKeyboard = (studentId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✏️ Tahrirlash', `edit_student_${studentId}`)],
    [Markup.button.callback('🗑 O\'chirish', `delete_student_${studentId}`)],
    [Markup.button.callback('◀️ Orqaga', 'back_to_group')]
  ]);

const teacherManageKeyboard = (teacherId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✏️ Tahrirlash', `edit_teacher_${teacherId}`)],
    [Markup.button.callback('🗑 O\'chirish', `delete_teacher_${teacherId}`)],
    [Markup.button.callback('◀️ Orqaga', 'back_to_list')]
  ]);

const confirmKeyboard = (yesAction, noAction = 'cancel') =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Ha', yesAction),
      Markup.button.callback('❌ Yo\'q', noAction)
    ]
  ]);

const skipKeyboard = (action = 'skip') =>
  Markup.inlineKeyboard([
    [Markup.button.callback('⏩ O\'tkazib yuborish', action)],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')]
  ]);

const yesNoKeyboard = (yesAction, noAction) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Ha', yesAction),
      Markup.button.callback('❌ Yo\'q', noAction)
    ]
  ]);

const doneAddingStudentsKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✅ O\'quvchilar qo\'shildi', 'done_adding_students')],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')]
  ]);

const finishHomeworkKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✅ Vazifani yakunlash', 'finish_homework')],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')]
  ]);

const sendHomeworkKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('📤 Yuborish', 'send_homework')],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')]
  ]);

const checkHomeworkKeyboard = (submissionId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✔️ Tekshirildi', `check_submission_${submissionId}`)],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')]
  ]);

const afterCheckKeyboard = (submissionId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('💬 Xabar yuborish', `send_feedback_${submissionId}`)],
    [Markup.button.callback('🪙 Coin berish', `give_coin_${submissionId}`)],
    [Markup.button.callback('✅ Tayyor', 'check_done')]
  ]);

const studentHomeworkDoneKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✅ Yakunlash', 'student_homework_done')],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')]
  ]);

const studentHomeworkSendKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('📤 Yuborish', 'student_send_homework')],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')]
  ]);

const homeworksListKeyboard = (homeworks) => {
  const buttons = homeworks.map((h, i) =>
    [Markup.button.callback(`📝 ${i + 1}-vazifa`, `hw_${h.id}`)]
  );
  buttons.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(buttons);
};

const cancelKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('❌ Bekor qilish', 'cancel')]
  ]);

const deleteTeacherKeyboard = (teacherId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('👥 Boshqa o\'qituvchi tayinlash', `reassign_teacher_${teacherId}`)],
    [Markup.button.callback('🗑 Guruhlarni ham o\'chirish', `delete_with_groups_${teacherId}`)],
    [Markup.button.callback('◀️ Bekor qilish', 'cancel')]
  ]);

module.exports = {
  adminMainMenu,
  teacherMainMenu,
  studentMainMenu,
  teachersListKeyboard,
  groupsListKeyboard,
  studentsListKeyboard,
  teacherGroupsManageKeyboard,
  groupManageKeyboard,
  studentManageKeyboard,
  teacherManageKeyboard,
  confirmKeyboard,
  skipKeyboard,
  yesNoKeyboard,
  doneAddingStudentsKeyboard,
  finishHomeworkKeyboard,
  sendHomeworkKeyboard,
  checkHomeworkKeyboard,
  afterCheckKeyboard,
  studentHomeworkDoneKeyboard,
  studentHomeworkSendKeyboard,
  homeworksListKeyboard,
  cancelKeyboard,
  deleteTeacherKeyboard
};
