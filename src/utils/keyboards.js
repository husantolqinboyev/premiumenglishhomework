'use strict';
const { Markup } = require('telegraf');

// ── Coin giving keyboards ─────────────────────────────────────

const coinAmountKeyboard = () => {
  return Markup.keyboard([
    ['1 ', '5 ', '10 '],
    ['20 ', '50 ', '100 '],
    [' Orqaga'],
  ])
    .oneTime()
    .resize();
};

const coinReasonKeyboard = () => {
  return Markup.keyboard([
    [' Vazifa uchun', ' Yutuq uchun'],
    [' Yaxshi ishlashi uchun', ' Faollik uchun'],
    [' Boshqa sabab', ' Orqaga'],
  ])
    .oneTime()
    .resize();
};

const confirmCoinKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(' Tasdiqlash', 'confirm_coin'),
      Markup.button.callback(' Bekor qilish', 'cancel_coin'),
    ],
  ]);
};

// ── Student selector for coin giving ───────────────────────

const coinStudentKeyboard = (students) => {
  const rows = [];
  
  // Create rows with 2 students each
  for (let i = 0; i < students.length; i += 2) {
    const row = [];
    
    // First student in row
    const student1 = students[i];
    row.push(
      Markup.button.callback(
        ` ${student1.first_name}${student1.last_name ? ' ' + student1.last_name.slice(0, 8) : ''}`,
        `give_coin_student:${student1.id}`
      )
    );
    
    // Second student in row (if exists)
    if (students[i + 1]) {
      const student2 = students[i + 1];
      row.push(
        Markup.button.callback(
          ` ${student2.first_name}${student2.last_name ? ' ' + student2.last_name.slice(0, 8) : ''}`,
          `give_coin_student:${student2.id}`
        )
      );
    }
    
    rows.push(row);
  }
  
  // Add cancel button at the end
  rows.push([Markup.button.callback(' Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(rows);
};

// ── Reply Keyboards (main menus) ──────────────────────────────

const adminMenu = () =>
  Markup.keyboard([
    ['👨‍💼 Admin yaratish', '👨‍🏫 O\'qituvchi qo\'shish'],
    ['👨‍🎓 O\'quvchi qo\'shish', '🏷 Guruh yaratish'],
    ['📋 Guruhlar ro\'yxati', '👥 O\'quvchilar ro\'yxati'],
    ['👨‍🏫 O\'qituvchilar ro\'yxati', '📊 Statistika'],
    ['🔗 O\'quvchini guruhga biriktirish'],
  ])
    .resize()
    .persistent();

const teacherMenu = () =>
  Markup.keyboard([
    ['📝 Vazifa berish', '📝 Guruhga vazifa berish'],
    ['📂 Mening o\'quvchilarim', '📂 Guruhlarim'],
    ['➕ Guruh yaratish', '✏️ Guruhni tahrirlash'],
    ['👥 Guruhga o\'quvchi qo\'shish', '🗑 Guruhdan o\'quvchi olib tashlash'],
    ['🪙 Coin berish', '📈 Statistika'],
  ])
    .oneTime()
    .resize();

const studentMenu = () =>
  Markup.keyboard([
    ['📚 Mening vazifalarim'],
    ['📊 Mening natijalarim'],
  ])
    .resize()
    .persistent();

// ── Deadline Inline Keyboard ──────────────────────────────────

const deadlineKeyboard = () =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('⚡ 6 soat', 'dl_6'),
      Markup.button.callback('🕐 12 soat', 'dl_12'),
    ],
    [
      Markup.button.callback('📅 24 soat', 'dl_24'),
      Markup.button.callback('📅 48 soat', 'dl_48'),
    ],
    [
      Markup.button.callback('🗓 72 soat', 'dl_72'),
      Markup.button.callback('✏️ Aniq sana', 'dl_custom'),
    ],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')],
  ]);

// ── Submit Button for student ─────────────────────────────────

const submitBtn = (hwId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('📤 Vazifani topshirish', `submit:${hwId}`)],
  ]);

// ── Confirm / Cancel ──────────────────────────────────────────

const confirmKeyboard = (hwId) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Tasdiqlash', `confirm:${hwId}`),
      Markup.button.callback('❌ Bekor qilish', 'cancel'),
    ],
  ]);

// ── Student selector (from teacher's students list) ───────────

const studentListKeyboard = (students) => {
  const rows = students.map((s) => [
    Markup.button.callback(
      `🎓 ${s.first_name}${s.last_name ? ' ' + s.last_name : ''} ${s.username ? '(@' + s.username + ')' : '[ID: ' + s.id + ']'}`,
      `pick_student:${s.id}`
    ),
  ]);
  rows.push([Markup.button.callback('✍️ ID orqali kiritish', 'pick_student:manual')]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(rows);
};

// ── Cancel only ───────────────────────────────────────────────

const cancelKeyboard = () =>
  Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'cancel')]]);

// ── Group selector ───────────────────────────────────────────────

const groupListKeyboard = (groups) => {
  const rows = groups.map((g) => [
    Markup.button.callback(
      `🏷 ${g.name}${g.description ? ' - ' + g.description : ''}`,
      `pick_group:${g.id}`
    ),
  ]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(rows);
};

// ── Teacher selector for group creation ─────────────────────────

const teacherListKeyboard = (teachers) => {
  const rows = teachers.map((t) => [
    Markup.button.callback(
      `👨‍🏫 ${t.first_name}${t.last_name ? ' ' + t.last_name : ''}`,
      `pick_teacher:${t.id}`
    ),
  ]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(rows);
};

// ── Group selector for editing ─────────────────────────────────────

const editGroupListKeyboard = (groups) => {
  const rows = groups.map((g) => [
    Markup.button.callback(
      `🏷 ${g.name}${g.description ? ' - ' + g.description : ''}`,
      `edit_group:${g.id}`
    ),
  ]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(rows);
};

// ── Group selector for adding students ───────────────────────────

const addStudentGroupKeyboard = (groups) => {
  const rows = groups.map((g) => [
    Markup.button.callback(
      `🏷 ${g.name}${g.description ? ' - ' + g.description : ''}`,
      `add_student_group:${g.id}`
    ),
  ]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(rows);
};

// ── Group selector for removing students ─────────────────────────

const removeStudentGroupKeyboard = (groups) => {
  const rows = groups.map((g) => [
    Markup.button.callback(
      `🏷 ${g.name}${g.description ? ' - ' + g.description : ''}`,
      `remove_student_group:${g.id}`
    ),
  ]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(rows);
};

// ── Student selector for group operations ─────────────────────────

const groupStudentListKeyboard = (students, groupId, action) => {
  const rows = students.map((s) => [
    Markup.button.callback(
      `🎓 ${s.first_name}${s.last_name ? ' ' + s.last_name : ''} ${s.username ? '(@' + s.username + ')' : '[ID: ' + s.id + ']'}`,
      `${action}_student:${groupId}:${s.id}`
    ),
  ]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(rows);
};

// ── Student selector for adding to group (including unassigned) ───

const addStudentToGroupKeyboard = (students, groupId) => {
  const rows = students.map((s) => [
    Markup.button.callback(
      `🎓 ${s.first_name}${s.last_name ? ' ' + s.last_name : ''} ${s.username ? '(@' + s.username + ')' : '[ID: ' + s.id + ']'} ${s.group_id ? '🏷' : '🔓'}`,
      `add_student_to_group:${groupId}:${s.id}`
    ),
  ]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(rows);
};

// ── Student management keyboard with pagination ─────

const studentManagementKeyboard = (students, page = 1, totalPages = 1) => {
  const rows = [];
  const itemsPerPage = 10;
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageStudents = students.slice(startIndex, endIndex);
  
  // Create rows with 5 buttons each for better layout
  for (let i = 0; i < pageStudents.length; i += 5) {
    const row = [];
    
    // Add up to 5 buttons in each row
    for (let j = 0; j < 5 && (i + j) < pageStudents.length; j++) {
      const student = pageStudents[i + j];
      row.push(
        Markup.button.callback(
          `${startIndex + i + j + 1}`,
          `student_action:${student.id}`
        )
      );
    }
    
    rows.push(row);
  }
  
  // Add pagination buttons if needed
  if (totalPages > 1) {
    const paginationRow = [];
    
    if (page > 1) {
      paginationRow.push(
        Markup.button.callback('⬅️ Oldingi', `student_page:${page - 1}`)
      );
    }
    
    paginationRow.push(
      Markup.button.callback(`📄 ${page}/${totalPages}`, `page_info`)
    );
    
    if (page < totalPages) {
      paginationRow.push(
        Markup.button.callback('Keyingi ➡️', `student_page:${page + 1}`)
      );
    }
    
    rows.push(paginationRow);
  }
  
  // Add cancel button at the end
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(rows);
};

// ── Teacher management keyboard with pagination ─────

const teacherManagementKeyboard = (teachers, page = 1, totalPages = 1) => {
  const rows = [];
  const itemsPerPage = 10;
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageTeachers = teachers.slice(startIndex, endIndex);
  
  // Create rows with 5 buttons each for better layout
  for (let i = 0; i < pageTeachers.length; i += 5) {
    const row = [];
    
    // Add up to 5 buttons in each row
    for (let j = 0; j < 5 && (i + j) < pageTeachers.length; j++) {
      const teacher = pageTeachers[i + j];
      row.push(
        Markup.button.callback(
          `${startIndex + i + j + 1}`,
          `teacher_action:${teacher.id}`
        )
      );
    }
    
    rows.push(row);
  }
  
  // Add pagination buttons if needed
  if (totalPages > 1) {
    const paginationRow = [];
    
    if (page > 1) {
      paginationRow.push(
        Markup.button.callback('⬅️ Oldingi', `teacher_page:${page - 1}`)
      );
    }
    
    paginationRow.push(
      Markup.button.callback(`📄 ${page}/${totalPages}`, `page_info`)
    );
    
    if (page < totalPages) {
      paginationRow.push(
        Markup.button.callback('Keyingi ➡️', `teacher_page:${page + 1}`)
      );
    }
    
    rows.push(paginationRow);
  }
  
  // Add cancel button at the end
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);
  return Markup.inlineKeyboard(rows);
};

const teacherActionKeyboard = (teacherId) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✏️ 📝 Tahrirlash', `edit_teacher:${teacherId}`),
      Markup.button.callback('🏷 📚 Guruh qo\'shish', `add_teacher_group:${teacherId}`),
    ],
    [
      Markup.button.callback('📊 📈 Statistika', `teacher_stats:${teacherId}`),
      Markup.button.callback('🗑 🚑 O\'chirish', `delete_teacher:${teacherId}`),
    ],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')],
  ]);
};

const studentActionKeyboard = (studentId) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✏️ 📝 Tahrirlash', `edit_student:${studentId}`),
      Markup.button.callback('🏷 📚 Guruhga biriktirish', `assign_student_group:${studentId}`),
    ],
    [
      Markup.button.callback('🗑 🚑 O\'chirish', `delete_student:${studentId}`),
      Markup.button.callback('📊 📈 Statistika', `student_stats:${studentId}`),
    ],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')],
  ]);
};

module.exports = {
  adminMenu,
  teacherMenu,
  studentMenu,
  deadlineKeyboard,
  submitBtn,
  confirmKeyboard,
  studentListKeyboard,
  cancelKeyboard,
  groupListKeyboard,
  teacherListKeyboard,
  editGroupListKeyboard,
  addStudentGroupKeyboard,
  removeStudentGroupKeyboard,
  groupStudentListKeyboard,
  addStudentToGroupKeyboard,
  studentManagementKeyboard,
  studentActionKeyboard,
  teacherManagementKeyboard,
  teacherActionKeyboard,
  coinAmountKeyboard,
  coinReasonKeyboard,
  confirmCoinKeyboard,
  coinStudentKeyboard,
};
