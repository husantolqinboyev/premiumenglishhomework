'use strict';
const supabase = require('../database/supabase');
const { adminMenu, cancelKeyboard, teacherListKeyboard, studentManagementKeyboard, studentActionKeyboard, teacherManagementKeyboard, teacherActionKeyboard } = require('../utils/keyboards');
const { fullName } = require('../utils/helpers');
const { adminState } = require('../utils/state');
const { Markup } = require('telegraf');

// ──────────────────────────────────────────────────────────────
//  /start
// ──────────────────────────────────────────────────────────────
async function adminStart(ctx) {
  const { count: tc } = await supabase
    .from('users').select('id', { count: 'exact', head: true }).eq('role', 'teacher');
  const { count: sc } = await supabase
    .from('users').select('id', { count: 'exact', head: true }).eq('role', 'student');
  const { count: gc } = await supabase
    .from('groups').select('id', { count: 'exact', head: true });

  await ctx.reply(
    `👑 *EduFlow — Super Admin Paneli*\n\n` +
    `Salom, *${ctx.user.first_name}*!\n\n` +
    `👨‍🏫 O'qituvchilar: *${tc || 0}*\n` +
    `🎓 O'quvchilar: *${sc || 0}*\n` +
    `🏷 Guruhlar: *${gc || 0}*\n\n` +
    `Quyidagi menyudan foydalaning:`,
    { parse_mode: 'Markdown', ...adminMenu() }
  );
}

// ──────────────────────────────────────────────────────────────
//  CREATE GROUP — Step 1: ask for group name
// ──────────────────────────────────────────────────────────────
async function startCreateGroup(ctx) {
  adminState.set(ctx.from.id, { step: 'group_name' });
  await ctx.reply(
    `🏷 *Yangi Guruh yaratish*\n\n` +
    `Guruh *nomini* kiriting:`,
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

// ──────────────────────────────────────────────────────────────
//  LIST GROUPS
// ──────────────────────────────────────────────────────────────
async function listGroups(ctx) {
  const { data: groups, error } = await supabase
    .from('groups')
    .select('*, teacher:teacher_id(first_name, last_name, username)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return ctx.reply('❌ Xatolik yuz berdi.');
  if (!groups?.length) return ctx.reply('📋 Hozircha guruhlar yo\'q.');

  // Get student count for each group
  const groupIds = groups.map(g => g.id);
  const { data: studentCounts } = await supabase
    .from('users')
    .select('group_id')
    .eq('role', 'student')
    .eq('is_active', true)
    .in('group_id', groupIds);

  const countMap = {};
  studentCounts?.forEach(s => {
    countMap[s.group_id] = (countMap[s.group_id] || 0) + 1;
  });

  const list = groups.map((g, i) => {
    const teacher = g.teacher ? `👨‍🏫 ${fullName(g.teacher)}` : '👨‍🏫 Biriktirilmagan';
    const students = `👥 ${countMap[g.id] || 0} ta o'quvchi`;
    const status = countMap[g.id] > 0 ? '🟢 Aktiv' : '🔴 Bo\'sh';
    
    return `┌─ *${i + 1}. ${g.name}*\n` +
           `│ 📝 ${g.description || 'Tavsif yo\'q'}\n` +
           `│ ${teacher}\n` +
           `│ ${students} • ${status}\n` +
           `└─ 🆔 \`${g.id}\``;
  }).join('\n\n');

  await ctx.reply(`🏷 *Guruhlar (${groups.length} ta)*\n\n${list}`, {
    parse_mode: 'Markdown',
  });
}

// ──────────────────────────────────────────────────────────────
//  ADD TEACHER — Step 1: ask for Telegram ID
// ──────────────────────────────────────────────────────────────
async function startAddTeacher(ctx) {
  adminState.set(ctx.from.id, { step: 'teacher_id' });
  await ctx.reply(
    `👨‍🏫 *Yangi O'qituvchi qo'shish*\n\n` +
    `O'qituvchining *Telegram User ID* sini yuboring.\n\n` +
    `💡 ID ni bilish uchun @userinfobot ga /start yozing.`,
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

// ──────────────────────────────────────────────────────────────
//  ADD STUDENT — Step 1: ask for Telegram ID
// ──────────────────────────────────────────────────────────────
async function startAddStudent(ctx) {
  adminState.set(ctx.from.id, { step: 'student_id' });
  await ctx.reply(
    `🎓 *Yangi O'quvchi qo'shish*\n\n` +
    `O'quvchining *Telegram User ID* sini yuboring.`,
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

// ──────────────────────────────────────────────────────────────
//  LIST TEACHERS
// ──────────────────────────────────────────────────────────────
async function listTeachers(ctx, page = 1) {
  const itemsPerPage = 10;
  const offset = (page - 1) * itemsPerPage;

  const { data, error, count } = await supabase
    .from('users')
    .select('id, first_name, last_name, username, created_at', { count: 'exact' })
    .eq('role', 'teacher')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + itemsPerPage - 1);

  if (error) return ctx.reply('❌ Xatolik yuz berdi.');
  if (!data?.length) return ctx.reply('📋 Hozircha o\'qituvchilar yo\'q.');

  const totalPages = Math.ceil((count || 0) / itemsPerPage);

  // Get group count for each teacher
  const teacherIds = data.map(t => t.id);
  const { data: groupCounts } = await supabase
    .from('groups')
    .select('teacher_id')
    .eq('is_active', true)
    .in('teacher_id', teacherIds);

  const groupCountMap = {};
  groupCounts?.forEach(g => {
    groupCountMap[g.teacher_id] = (groupCountMap[g.teacher_id] || 0) + 1;
  });

  const list = data.map((t, i) => {
    const globalIndex = offset + i + 1;
    const displayName = t.first_name + (t.last_name ? ' ' + t.last_name : '');
    const username = t.username ? `@${t.username}` : '(yo\'q)';
    const groupCount = groupCountMap[t.id] || 0;
    
    return `${globalIndex}. ${displayName} (${username}) — ID: ${t.id} ${groupCount} ta guruh`;
  }).join('\n');

  await ctx.reply(
    `�‍🏫 *O'qituvchilar ro'yxati*\n\n${list}`,
    {
      parse_mode: 'Markdown',
      ...teacherManagementKeyboard(data, page, totalPages)
    }
  );
}

// ──────────────────────────────────────────────────────────────
//  LIST STUDENTS
// ──────────────────────────────────────────────────────────────
async function listStudents(ctx, page = 1) {
  const itemsPerPage = 10;
  const offset = (page - 1) * itemsPerPage;

  const { data, error, count } = await supabase
    .from('users')
    .select('id, first_name, last_name, username, group_id, created_at', { count: 'exact' })
    .eq('role', 'student')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + itemsPerPage - 1);

  if (error) return ctx.reply('❌ Xatolik yuz berdi.');
  if (!data?.length) return ctx.reply('📋 Hozircha o\'quvchilar yo\'q.');

  const totalPages = Math.ceil((count || 0) / itemsPerPage);

  // Get group information for each student
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name')
    .eq('is_active', true);

  const groupMap = {};
  groups?.forEach(g => {
    groupMap[g.id] = g.name;
  });

  const list = data.map((s, i) => {
    const globalIndex = offset + i + 1;
    const displayName = s.first_name + (s.last_name ? ' ' + s.last_name : '');
    const username = s.username ? `@${s.username}` : '(yo\'q)';
    const groupName = s.group_id ? (groupMap[s.group_id] || 'Noma\'lum guruh') : 'Guruh yo\'q';
    
    return `${globalIndex}. ${displayName} (${username}) — ID: ${s.id} ${groupName}`;
  }).join('\n');

  await ctx.reply(
    `👥 *O'quvchilar ro'yxati*\n\n${list}`,
    {
      parse_mode: 'Markdown',
      ...studentManagementKeyboard(data, page, totalPages)
    }
  );
}

// ──────────────────────────────────────────────────────────────
//  STATISTICS
// ──────────────────────────────────────────────────────────────
async function showStats(ctx) {
  const [
    { count: teachers },
    { count: students },
    { count: pending },
    { count: submitted },
    { count: overdue },
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('homeworks').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('homeworks').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase.from('homeworks').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
  ]);

  const total = (pending || 0) + (submitted || 0) + (overdue || 0);
  const rate  = total > 0 ? Math.round(((submitted || 0) / total) * 100) : 0;
  const bar   = '█'.repeat(Math.round(rate / 10)) + '░'.repeat(10 - Math.round(rate / 10));

  await ctx.reply(
    `📊 *EduFlow Statistikasi*\n\n` +
    `👨‍🏫 O'qituvchilar: *${teachers || 0}*\n` +
    `🎓 O'quvchilar:   *${students || 0}*\n\n` +
    `📚 *Vazifalar:*\n` +
    `  ⏳ Kutilmoqda:  *${pending || 0}*\n` +
    `  ✅ Topshirildi: *${submitted || 0}*\n` +
    `  🔴 Muddat o'tdi: *${overdue || 0}*\n\n` +
    `📈 Bajarish darajasi:\n${bar} *${rate}%*`,
    { parse_mode: 'Markdown' }
  );
}

// ──────────────────────────────────────────────────────────────
//  TEXT HANDLER — multi-step conversation
// ──────────────────────────────────────────────────────────────
async function handleAdminText(ctx) {
  const uid   = ctx.from.id;
  const state = adminState.get(uid);
  if (!state) return;

  const text = ctx.message.text?.trim();

  // ── ADMIN: step 1 — get admin ID ───────────────────────────────
  if (state.step === 'await_admin_id') {
    return onAdminId(ctx);
  }

  // ── GROUP: step 1 — get group name ─────────────────────────
  if (state.step === 'group_name') {
    adminState.update(uid, { step: 'group_description', groupName: text });
    return ctx.reply(
      `Nomi: *${text}* ✅\n\nEndi guruh *tavsifini* kiriting (yo'q bo'lsa - deb yozing):`,
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  // ── GROUP: step 2 — get description & pick teacher ───────────
  if (state.step === 'group_description') {
    const description = text === '-' ? null : text;
    const { groupName } = state;
    
    // Load teachers for assignment
    const { data: teachers } = await supabase
      .from('users')
      .select('id, first_name, last_name, username')
      .eq('role', 'teacher')
      .eq('is_active', true);

    if (!teachers?.length) {
      adminState.clear(uid);
      return ctx.reply('❌ Hech qanday o\'qituvchi topilmadi. Avval o\'qituvchi qo\'shing.');
    }

    adminState.update(uid, { step: 'group_teacher', description });

    const rows = teachers.map((t) => [
      Markup.button.callback(
        `👨‍🏫 ${fullName(t)}`,
        `assign_group_teacher:${t.id}`
      ),
    ]);

    return ctx.reply(
      `Guruh *${groupName}* uchun o'qituvchi tanlang:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) }
    );
  }

  // ── TEACHER: step 1 — get Telegram ID ──────────────────────
  if (state.step === 'teacher_id') {
    const tid = parseInt(text);
    if (isNaN(tid) || tid < 1) {
      return ctx.reply('❌ Noto\'g\'ri ID. Iltimos raqamli Telegram ID yuboring.');
    }
    adminState.update(uid, { step: 'teacher_firstname', tid, role: 'teacher' });
    return ctx.reply(
      `ID: \`${tid}\` ✅\n\nEndi o'qituvchining *ismini* kiriting:`,
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  // ── TEACHER: step 2 — get first name ───────────────────────
  if (state.step === 'teacher_firstname') {
    adminState.update(uid, { step: 'teacher_lastname', firstname: text });
    return ctx.reply(
      `Ism: *${text}* ✅\n\nFamiliyasini kiriting (yo'q bo'lsa - deb yozing):`,
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  // ── TEACHER: step 3 — get last name & save ─────────────────
  if (state.step === 'teacher_lastname') {
    const { tid, firstname } = state;
    const lastname = text === '-' ? null : text;

    const { error } = await supabase.from('users').upsert({
      id: tid, first_name: firstname, last_name: lastname, role: 'teacher', is_active: true,
    });

    adminState.clear(uid);

    if (error) return ctx.reply(`❌ Xatolik: ${error.message}`);

    return ctx.reply(
      `✅ *O'qituvchi qo'shildi!*\n\n` +
      `👤 Ism: *${firstname} ${lastname || ''}*\n` +
      `🆔 ID: \`${tid}\`\n\n` +
      `Endi bu foydalanuvchi botga /start yuborganda o'qituvchi sifatida kirishadi.`,
      { parse_mode: 'Markdown', ...adminMenu() }
    );
  }

  // ── STUDENT: step 1 — get Telegram ID ──────────────────────
  if (state.step === 'student_id') {
    const tid = parseInt(text);
    if (isNaN(tid) || tid < 1) {
      return ctx.reply('❌ Noto\'g\'ri ID. Iltimos raqamli Telegram ID yuboring.');
    }
    adminState.update(uid, { step: 'student_firstname', tid, role: 'student' });
    return ctx.reply(
      `ID: \`${tid}\` ✅\n\nEndi o'quvchining *ismini* kiriting:`,
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  // ── STUDENT: step 2 — get first name ───────────────────────
  if (state.step === 'student_firstname') {
    adminState.update(uid, { step: 'student_lastname', firstname: text });
    return ctx.reply(
      `Ism: *${text}* ✅\n\nFamiliyasini kiriting (yo'q bo'lsa - deb yozing):`,
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  // ── STUDENT: step 3 — get last name, then pick teacher ─────
  if (state.step === 'student_lastname') {
    const { tid, firstname } = state;
    const lastname = text === '-' ? null : text;
    adminState.update(uid, { step: 'student_teacher', lastname });

    // Load teachers for assignment
    const { data: teachers } = await supabase
      .from('users')
      .select('id, first_name, last_name, username')
      .eq('role', 'teacher')
      .eq('is_active', true);

    if (!teachers?.length) {
      // No teachers, save without assignment
      return saveStudent(ctx, tid, firstname, lastname, null);
    }

    const rows = teachers.map((t) => [
      Markup.button.callback(
        `👨‍🏫 ${fullName(t)}`,
        `assign_teacher:${t.id}`
      ),
    ]);
    rows.push([Markup.button.callback('⏭ O\'qituvchisiz saqlash', 'assign_teacher:none')]);

    return ctx.reply(
      `O'quvchi *${firstname}* uchun o'qituvchi tanlang:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) }
    );
  }

  // ── STUDENT: step 4 — manual teacher id ────────────────────
  if (state.step === 'student_manual_teacher') {
    const mentorId = parseInt(text);
    if (isNaN(mentorId)) return ctx.reply('❌ Noto\'g\'ri ID.');
    const { tid, firstname, lastname } = state;
    return saveStudent(ctx, tid, firstname, lastname, mentorId);
  }

  // ── STUDENT EDIT: step 1 — first name ────────────────────────
  if (state.step === 'edit_student_firstname') {
    const { studentId, currentData } = state;
    const firstname = text.toLowerCase() === 'o\'zgartirmaslik' ? currentData.first_name : text;
    
    adminState.update(uid, { 
      step: 'edit_student_lastname', 
      studentId, 
      currentData,
      firstname 
    });
    
    return ctx.reply(
      `📝 Ism: *${firstname}*\n\nEndi yangi familiyasini kiriting (o'zgartirmaslik uchun "O'zgartirmaslik" deb yozing):`,
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  // ── STUDENT EDIT: step 2 — last name ─────────────────────────
  if (state.step === 'edit_student_lastname') {
    const { studentId, currentData, firstname } = state;
    const lastname = text.toLowerCase() === 'o\'zgartirmaslik' ? currentData.last_name : text;
    
    const { error } = await supabase
      .from('users')
      .update({ first_name: firstname, last_name: lastname })
      .eq('id', studentId);

    adminState.clear(uid);

    if (error) return ctx.reply(`❌ Xatolik: ${error.message}`);

    return ctx.reply(
      `✅ *O'quvchi ma'lumotlari yangilandi!*\n\n` +
      `🎓 Ism: *${firstname} ${lastname || ''}*\n` +
      `🆔 ID: \`${studentId}\``,
      { parse_mode: 'Markdown', ...adminMenu() }
    );
  }
}

// ──────────────────────────────────────────────────────────────
//  CALLBACK: assign_teacher:<teacherId|none>
// ──────────────────────────────────────────────────────────────
async function handleAssignTeacher(ctx) {
  await ctx.answerCbQuery();
  const uid   = ctx.from.id;
  const state = adminState.get(uid);
  if (!state || state.step !== 'student_teacher') return;

  const raw      = ctx.callbackQuery.data.replace('assign_teacher:', '');
  const mentorId = raw === 'none' ? null : parseInt(raw);
  const { tid, firstname, lastname } = state;

  return saveStudent(ctx, tid, firstname, lastname, mentorId);
}

async function saveStudent(ctx, tid, firstname, lastname, mentorId) {
  const uid = ctx.from.id;
  const { error } = await supabase.from('users').upsert({
    id: tid, first_name: firstname, last_name: lastname,
    role: 'student', mentor_id: mentorId, is_active: true,
  });

  adminState.clear(uid);

  if (error) return ctx.reply(`❌ Xatolik: ${error.message}`);

  return ctx.reply(
    `✅ *O'quvchi qo'shildi!*\n\n` +
    `🎓 Ism: *${firstname} ${lastname || ''}*\n` +
    `🆔 ID: \`${tid}\`\n` +
    (mentorId ? `👨‍🏫 O'qituvchi ID: \`${mentorId}\`` : '👨‍🏫 O\'qituvchisiz saqlandi'),
    { parse_mode: 'Markdown', ...adminMenu() }
  );
}

// ──────────────────────────────────────────────────────────────
//  CALLBACK: assign_group_teacher:<teacherId>
// ──────────────────────────────────────────────────────────────
async function handleAssignGroupTeacher(ctx) {
  await ctx.answerCbQuery();
  const uid   = ctx.from.id;
  const state = adminState.get(uid);
  if (!state || state.step !== 'group_teacher') return;

  const teacherId = parseInt(ctx.callbackQuery.data.replace('assign_group_teacher:', ''));
  const { groupName, description } = state;

  const { error } = await supabase.from('groups').insert({
    name: groupName,
    description: description,
    teacher_id: teacherId,
    is_active: true,
  });

  adminState.clear(uid);

  if (error) return ctx.reply(`❌ Xatolik: ${error.message}`);

  return ctx.reply(
    `✅ *Guruh yaratildi!*\n\n` +
    `🏷 Nomi: *${groupName}*\n` +
    `📝 Tavsifi: ${description || 'Yo\'q'}\n` +
    `👨‍🏫 O'qituvchi ID: \`${teacherId}\`\n\n` +
    `Endi bu guruhga o'quvchilarni biriktirishingiz mumkin.`,
    { parse_mode: 'Markdown', ...adminMenu() }
  );
}

// ──────────────────────────────────────────────────────────────
//  ASSIGN STUDENT TO GROUP
// ──────────────────────────────────────────────────────────────
async function startAssignStudentToGroup(ctx) {
  adminState.set(ctx.from.id, { step: 'pick_student_for_group' });
  
  const { data: students } = await supabase
    .from('users')
    .select('id, first_name, last_name, username, group:group_id(name)')
    .eq('role', 'student')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!students?.length) {
    adminState.clear(ctx.from.id);
    return ctx.reply('📋 Hozircha o\'quvchilar yo\'q.');
  }

  const rows = students.map((s) => [
    Markup.button.callback(
      `🎓 ${fullName(s)} ${s.group ? `(${s.group.name})` : '[Guruh yo\'q]'}`,
      `pick_student_for_group:${s.id}`
    ),
  ]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);

  await ctx.reply(
    `🎓 *O'quvchini guruhga biriktirish*\n\nO'quvchini tanlang:`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) }
  );
}

async function handlePickStudentForGroup(ctx) {
  await ctx.answerCbQuery();
  const studentId = parseInt(ctx.callbackQuery.data.replace('pick_student_for_group:', ''));
  
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, description, teacher:teacher_id(first_name, last_name)')
    .eq('is_active', true)
    .order('name');

  if (!groups?.length) {
    adminState.clear(ctx.from.id);
    return ctx.reply('❌ Hech qanday guruh topilmadi. Avval guruh yarating.');
  }

  adminState.update(ctx.from.id, { 
    step: 'assign_group_to_student', 
    studentId 
  });

  const rows = groups.map((g) => [
    Markup.button.callback(
      `🏷 ${g.name} - 👨‍🏫 ${fullName(g.teacher)}`,
      `assign_group_to_student:${g.id}`
    ),
  ]);
  rows.push([Markup.button.callback('❌ Guruhdan olib tashlash', 'assign_group_to_student:none')]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);

  await ctx.reply(
    `🏷 *Guruhni tanlang:*`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) }
  );
}

async function handleAssignGroupToStudent(ctx) {
  await ctx.answerCbQuery();
  const uid = ctx.from.id;
  const state = adminState.get(uid);
  if (!state || state.step !== 'assign_group_to_student') return;

  const raw = ctx.callbackQuery.data.replace('assign_group_to_student:', '');
  const groupId = raw === 'none' ? null : raw;
  const { studentId } = state;

  const { error } = await supabase
    .from('users')
    .update({ group_id: groupId })
    .eq('id', studentId);

  adminState.clear(uid);

  if (error) return ctx.reply(`❌ Xatolik: ${error.message}`);

  const action = groupId ? 'biriktirildi' : 'olib tashlandi';
  const { data: student } = await supabase
    .from('users')
    .select('first_name, last_name')
    .eq('id', studentId)
    .single();

  return ctx.reply(
    `✅ *O'quvchi guruhga ${action}!*\n\n` +
    `🎓 O'quvchi: *${fullName(student)}*\n` +
    (groupId ? `🏷 Guruh ID: \`${groupId}\`` : '🏷 Guruh: Yo\'q'),
    { parse_mode: 'Markdown', ...adminMenu() }
  );
}

// ──────────────────────────────────────────────────────────────
//  STUDENT MANAGEMENT CALLBACKS
// ──────────────────────────────────────────────────────────────
async function handleStudentAction(ctx) {
  await ctx.answerCbQuery();
  const studentId = parseInt(ctx.callbackQuery.data.replace('student_action:', ''));

  const { data: student } = await supabase
    .from('users')
    .select('id, first_name, last_name, username, group_id')
    .eq('id', studentId)
    .eq('role', 'student')
    .single();

  if (!student) {
    return ctx.reply('❌ O\'quvchi topilmadi.');
  }

  const groupName = student.group_id ? 'Guruhda' : 'Guruhda emas';

  await ctx.reply(
    `🎓 *O'quvchi ma'lumotlari*\n\n` +
    `┌─ 👤 *${fullName(student)}*\n` +
    `│ 🆔 ID: \`${student.id}\`\n` +
    `│ � Username: ${student.username ? '@' + student.username : 'Yo\'q'}\n` +
    `│ 🏷 Holati: ${groupName}\n` +
    `│ 📅 Ro\'yxatdan o\'tgan: ${new Date(student.created_at).toLocaleDateString('ru-RU')}\n` +
    `└─ 📊 Status: 🟢 Aktiv\n\n` +
    `🎯 *Kerakli amalni tanlang:*`,
    { parse_mode: 'Markdown', ...studentActionKeyboard(studentId) }
  );
}

async function handleEditStudent(ctx) {
  await ctx.answerCbQuery();
  const studentId = parseInt(ctx.callbackQuery.data.replace('edit_student:', ''));

  const { data: student } = await supabase
    .from('users')
    .select('id, first_name, last_name, username')
    .eq('id', studentId)
    .eq('role', 'student')
    .single();

  if (!student) {
    return ctx.reply('❌ O\'quvchi topilmadi.');
  }

  adminState.set(ctx.from.id, { 
    step: 'edit_student_firstname', 
    studentId,
    currentData: student 
  });

  await ctx.reply(
    `✏️ *O'quvchini tahrirlash*\n\n` +
    `🎓 O'quvchi: *${fullName(student)}*\n\n` +
    `📝 Yangi ismini kiriting (o'zgartirmaslik uchun "O'zgartirmaslik" deb yozing):`,
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

async function handleAssignStudentGroup(ctx) {
  await ctx.answerCbQuery();
  const studentId = parseInt(ctx.callbackQuery.data.replace('assign_student_group:', ''));

  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, teacher:teacher_id(first_name, last_name)')
    .eq('is_active', true)
    .order('name');

  if (!groups?.length) {
    return ctx.reply('❌ Hech qanday guruh topilmadi. Avval guruh yarating.');
  }

  adminState.set(ctx.from.id, { 
    step: 'assign_student_group', 
    studentId 
  });

  const rows = groups.map((g) => [
    Markup.button.callback(
      `🏷 ${g.name} 👨‍🏫 ${fullName(g.teacher)}`,
      `assign_group_to_student:${g.id}`
    ),
  ]);
  rows.push([Markup.button.callback('🔓 ❌ Guruhdan olib tashlash', 'assign_group_to_student:none')]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);

  await ctx.reply(
    `🏷 *Guruhni tanlang:*`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) }
  );
}

async function handleDeleteStudent(ctx) {
  await ctx.answerCbQuery();
  const studentId = parseInt(ctx.callbackQuery.data.replace('delete_student:', ''));

  const { data: student } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('id', studentId)
    .eq('role', 'student')
    .single();

  if (!student) {
    return ctx.reply('❌ O\'quvchi topilmadi.');
  }

  // Soft delete by setting is_active to false
  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', studentId);

  if (error) {
    return ctx.reply(`❌ Xatolik: ${error.message}`);
  }

  await ctx.reply(
    `🗑 *O'quvchi o\'chirildi!*\n\n` +
    `🎓 O'quvchi: *${fullName(student)}*\n` +
    `🆔 ID: \`${studentId}\`\n` +
    `📊 Status: 🔴 Noaktiv`,
    { parse_mode: 'Markdown', ...adminMenu() }
  );
}

async function handleStudentStats(ctx) {
  await ctx.answerCbQuery();
  const studentId = parseInt(ctx.callbackQuery.data.replace('student_stats:', ''));

  const { data: student } = await supabase
    .from('users')
    .select('id, first_name, last_name, username, created_at')
    .eq('id', studentId)
    .eq('role', 'student')
    .single();

  if (!student) {
    return ctx.reply('❌ O\'quvchi topilmadi.');
  }

  // Get homework statistics
  const { data: homeworks } = await supabase
    .from('homeworks')
    .select('status, deadline, submitted_at')
    .eq('student_id', studentId);

  const total = homeworks?.length || 0;
  const pending = homeworks?.filter(hw => hw.status === 'pending').length || 0;
  const submitted = homeworks?.filter(hw => hw.status === 'submitted').length || 0;
  const overdue = homeworks?.filter(hw => hw.status === 'overdue').length || 0;
  const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;

  await ctx.reply(
    `📊 *O'quvchi statistikasi*\n\n` +
    `┌─ 👤 *${fullName(student)}*\n` +
    `│ 🆔 ID: \`${student.id}\`\n` +
    `│ 📧 Username: ${student.username ? '@' + student.username : 'Yo\'q'}\n` +
    `│ 📅 Ro\'yxatdan: ${new Date(student.created_at).toLocaleDateString('ru-RU')}\n` +
    `└─ 📊 Faollik: ${Math.round((new Date() - new Date(student.created_at)) / (1000 * 60 * 60 * 24))} kun\n\n` +
    `📚 *Vazifalar statistikasi:*\n` +
    `┌─ 📊 Jami: *${total} ta*\n` +
    `│ ⏳ Kutilmoqda: *${pending} ta*\n` +
    `│ ✅ Topshirilgan: *${submitted} ta*\n` +
    `│ 🔴 Muddati o'tgan: *${overdue} ta*\n` +
    `└─ 📈 Bajarish darajasi: *${rate}%*`,
    { parse_mode: 'Markdown' }
  );
}

async function handleStudentPage(ctx) {
  await ctx.answerCbQuery();
  const page = parseInt(ctx.callbackQuery.data.replace('student_page:', ''));
  return listStudents(ctx, page);
}

async function handleTeacherAction(ctx) {
  await ctx.answerCbQuery();
  const teacherId = parseInt(ctx.callbackQuery.data.replace('teacher_action:', ''));

  const { data: teacher } = await supabase
    .from('users')
    .select('id, first_name, last_name, username, created_at')
    .eq('id', teacherId)
    .eq('role', 'teacher')
    .single();

  if (!teacher) {
    return ctx.reply('❌ O\'qituvchi topilmadi.');
  }

  // Get teacher's groups
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name')
    .eq('teacher_id', teacherId)
    .eq('is_active', true);

  // Get student count
  const groupIds = groups?.map(g => g.id) || [];
  const { data: studentCounts } = await supabase
    .from('users')
    .select('group_id')
    .eq('role', 'student')
    .eq('is_active', true)
    .in('group_id', groupIds);

  const studentCountMap = {};
  studentCounts?.forEach(s => {
    studentCountMap[s.group_id] = (studentCountMap[s.group_id] || 0) + 1;
  });

  const groupList = groups?.map(g => `🏷 ${g.name} - ${studentCountMap[g.id] || 0} ta o'quvchi`).join('\n') || 'Guruhlar yo\'q';

  await ctx.reply(
    `👨‍🏫 *O'qituvchi ma'lumotlari*\n\n` +
    `┌─ 👤 *${fullName(teacher)}*\n` +
    `│ 🆔 ID: \`${teacher.id}\`\n` +
    `│ 📧 Username: ${teacher.username ? '@' + teacher.username : 'Yo\'q'}\n` +
    `│ 📅 Ro\'yxatdan o\'tgan: ${new Date(teacher.created_at).toLocaleDateString('ru-RU')}\n` +
    `└─ 📊 Status: 🟢 Aktiv\n\n` +
    `📚 *Guruhlari:*\n${groupList}\n\n` +
    `🎯 *Kerakli amalni tanlang:*`,
    { parse_mode: 'Markdown', ...teacherActionKeyboard(teacherId) }
  );
}

async function handleTeacherPage(ctx) {
  await ctx.answerCbQuery();
  const page = parseInt(ctx.callbackQuery.data.replace('teacher_page:', ''));
  return listTeachers(ctx, page);
}

// ──────────────────────────────────────────────────────────────
//  CREATE ADMIN
// ──────────────────────────────────────────────────────────────
async function createAdmin(ctx) {
  adminState.set(ctx.from.id, { step: 'await_admin_id' });
  
  await ctx.reply(
    `👨‍💼 *Admin yaratish*\n\n` +
    `Admin qilinadi foydalanuvchining *Telegram User ID* sini kiriting:\n\n` +
    `💡 Foydalanuvchi profiliga kirib User ID ni ko'rish mumkin\n` +
    `Yoki foydalanuvchidan /start buyrug'ini yuborishini so'rang`,
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

async function onAdminId(ctx) {
  const adminId = parseInt(ctx.message.text);
  
  if (isNaN(adminId) || adminId < 1) {
    return ctx.reply('❌ Noto\'g\'ri ID. Iltimos, to\'g\'ri raqam kiriting.');
  }

  try {
    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, username, role, is_active')
      .eq('id', adminId)
      .single();

    if (userError || !user) {
      return ctx.reply('❌ Bunday ID li foydalanuvchi topilmadi.');
    }

    // Check if already admin
    if (user.role === 'admin') {
      return ctx.reply('❌ Bu foydalanuvchi allaqachon admin.');
    }

    // Update user role to admin
    const { error: updateError } = await supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('id', adminId);

    if (updateError) {
      return ctx.reply(`❌ Xatolik: ${updateError.message}`);
    }

    adminState.clear(ctx.from.id);

    await ctx.reply(
      `✅ *Admin muvaffaqiyatli yaratildi!*\n\n` +
      `👨‍💼 Admin: *${fullName(user)}*\n` +
      `🆔 ID: \`${user.id}\`\n` +
      `📱 Username: ${user.username ? `@${user.username}` : 'yo\'q'}\n` +
      `📅 Sana: *${new Date().toLocaleDateString('ru-RU')}*\n\n` +
      `🎉 Endi u admin sifatida ishlaydi!`,
      { parse_mode: 'Markdown', ...adminMenu() }
    );

    // Notify the new admin
    try {
      await ctx.telegram.sendMessage(
        adminId,
        `🎉 *Tabriklaymiz!*\n\n` +
        `Siz *Admin* etib tayinlandingiz!\n\n` +
        `👑 Admin huquqlari berildi.\n` +
        `📋 /start buyrug'ini qayta yuboring.`,
        { parse_mode: 'Markdown' }
      );
    } catch (notifyError) {
      console.error('[Admin→NewAdmin notify] error:', notifyError.message);
    }

  } catch (error) {
    await ctx.reply(`❌ Xatolik: ${error.message}`);
  }
}

module.exports = {
  adminStart, startAddTeacher, startAddStudent,
  listTeachers, listStudents, showStats,
  startCreateGroup, listGroups, startAssignStudentToGroup,
  handleAdminText, handleAssignTeacher, handleAssignGroupTeacher,
  handlePickStudentForGroup, handleAssignGroupToStudent,
  handleStudentAction, handleEditStudent, handleAssignStudentGroup,
  handleDeleteStudent, handleStudentStats, handleStudentPage,
  handleTeacherAction, handleTeacherPage,
  createAdmin, onAdminId,
};
