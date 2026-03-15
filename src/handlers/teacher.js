'use strict';
const supabase = require('../database/supabase');
const { teacherMenu, deadlineKeyboard, submitBtn, confirmKeyboard, studentListKeyboard, groupListKeyboard, editGroupListKeyboard, addStudentGroupKeyboard, removeStudentGroupKeyboard, groupStudentListKeyboard, addStudentToGroupKeyboard, coinAmountKeyboard, coinReasonKeyboard, confirmCoinKeyboard, coinStudentKeyboard, cancelKeyboard } = require('../utils/keyboards');
const {
  fmtDate, fmtTimeLeft, deadlineFromHours, parseDate,
  extractFile, fullName, statusBadge, writeLog, sendMedia,
} = require('../utils/helpers');
const { teacherState } = require('../utils/state');
const { Markup } = require('telegraf');

// ──────────────────────────────────────────────────────────────
//  /start
// ──────────────────────────────────────────────────────────────
async function teacherStart(ctx) {
  const { count: pending } = await supabase
    .from('homeworks')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', ctx.user.id)
    .eq('status', 'pending');

  await ctx.reply(
    `👨‍🏫 *Xush kelibsiz, ${ctx.user.first_name}!*\n\n` +
    `Siz *O'qituvchi* sifatida kirdingiз.\n` +
    `⏳ Kutilayotgan vazifalar: *${pending || 0}*\n\n` +
    `Menyudan foydalaning:`,
    { parse_mode: 'Markdown', ...teacherMenu() }
  );
}

// ──────────────────────────────────────────────────────────────
//  ASSIGN HOMEWORK — Step 1: pick student
// ──────────────────────────────────────────────────────────────
async function startAssign(ctx) {
  const { data: students } = await supabase
    .from('users')
    .select('id, first_name, last_name, username')
    .eq('role', 'student')
    .eq('mentor_id', ctx.user.id)
    .eq('is_active', true);

  teacherState.set(ctx.from.id, { step: 'pick_student' });

  if (!students?.length) {
    // No students assigned — allow manual ID entry
    teacherState.update(ctx.from.id, { step: 'manual_student_id' });
    return ctx.reply(
      `📝 *Vazifa berish*\n\n` +
      `Sizga biriktirilgan o'quvchi yo'q.\n` +
      `O'quvchining *Telegram ID* sini qo'lda kiriting:`,
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  await ctx.reply(
    `📝 *Vazifa berish*\n\nO'quvchini tanlang yoki ID orqali kiriting:`,
    { parse_mode: 'Markdown', ...studentListKeyboard(students) }
  );
}

// ──────────────────────────────────────────────────────────────
//  Callback: pick_student:<id|manual>
// ──────────────────────────────────────────────────────────────
async function onPickStudent(ctx) {
  await ctx.answerCbQuery();
  const raw = ctx.callbackQuery.data.replace('pick_student:', '');

  if (raw === 'manual') {
    teacherState.update(ctx.from.id, { step: 'manual_student_id' });
    return ctx.reply(
      `✍️ O'quvchining *Telegram User ID* sini yuboring:`,
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  return _setStudentAndAskFile(ctx, parseInt(raw));
}

async function _setStudentAndAskFile(ctx, studentId) {
  const { data: student } = await supabase
    .from('users')
    .select('id, first_name, last_name, username')
    .eq('id', studentId)
    .eq('role', 'student')
    .single();

  if (!student) {
    return ctx.reply('❌ Bunday ID li o\'quvchi topilmadi. Qayta urinib ko\'ring.');
  }

  teacherState.update(ctx.from.id, {
    step: 'await_file',
    studentId: student.id,
    studentName: fullName(student),
  });

  await ctx.reply(
    `🎓 Tanlangan: *${fullName(student)}*\n\n` +
    `📎 Endi vazifa faylini yuboring:\n` +
    `_(PDF, rasm, audio, video yoki ovozli xabar)_\n\n` +
    `💡 Faylga izoh (caption) ham qo'shishingiz mumkin.`,
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

// ──────────────────────────────────────────────────────────────
//  File received from teacher
// ──────────────────────────────────────────────────────────────
async function onTeacherFile(ctx) {
  const state = teacherState.get(ctx.from.id);
  if (!state) return;

  const file = extractFile(ctx.message);
  if (!file) {
    return ctx.reply('❌ Qo\'llab-quvvatlanmaydigan fayl turi. PDF, rasm, audio, video yoki ovoz yuboring.');
  }

  // Handle individual student homework
  if (state.step === 'await_file') {
    teacherState.update(ctx.from.id, {
      step: 'await_deadline',
      fileId:   file.file_id,
      fileType: file.file_type,
      caption:  ctx.message.caption || null,
    });

    return ctx.reply(
      `📎 Fayl qabul qilindi! ✅\n` +
      (ctx.message.caption ? `💬 Izoh: _"${ctx.message.caption}"_\n` : '') +
      `\n⏰ Endi *muddatni* belgilang:`,
      { parse_mode: 'Markdown', ...deadlineKeyboard() }
    );
  }

  // Handle group homework
  if (state.step === 'await_group_file') {
    teacherState.update(ctx.from.id, {
      step: 'await_group_deadline',
      fileId:   file.file_id,
      fileType: file.file_type,
      caption:  ctx.message.caption || null,
    });

    return ctx.reply(
      `📎 Guruh uchun fayl qabul qilindi! ✅\n` +
      (ctx.message.caption ? `💬 Izoh: _"${ctx.message.caption}"_\n` : '') +
      `\n⏰ Endi *muddatni* belgilang:\n\n` +
      `⚠️ Vazifa "${state.groupName}" guruhidagi barcha o'quvchilarga yuboriladi!`,
      { parse_mode: 'Markdown', ...deadlineKeyboard() }
    );
  }
}

// ──────────────────────────────────────────────────────────────
//  Callback: dl_<hours|custom>
// ──────────────────────────────────────────────────────────────
async function onDeadlinePick(ctx) {
  await ctx.answerCbQuery();
  const state = teacherState.get(ctx.from.id);
  if (!state) return;

  const data = ctx.callbackQuery.data; // dl_6 | dl_12 | dl_24 | dl_48 | dl_72 | dl_custom

  if (data === 'dl_custom') {
    if (state.step === 'await_deadline') {
      teacherState.update(ctx.from.id, { step: 'await_custom_deadline' });
    } else if (state.step === 'await_group_deadline') {
      teacherState.update(ctx.from.id, { step: 'await_custom_group_deadline' });
    }
    return ctx.reply(
      `🗓 *Aniq sana kiriting:*\n\n` +
      `Format: \`KK.OO.YYYY SS:DD\`\n` +
      `Masalan: \`${new Date().toLocaleDateString('ru-RU')} 18:00\``,
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  const hoursMap = { dl_6: 6, dl_12: 12, dl_24: 24, dl_48: 48, dl_72: 72 };
  const hours = hoursMap[data];
  if (!hours) return;

  const deadline = deadlineFromHours(hours);
  
  if (state.step === 'await_deadline') {
    await _saveHomework(ctx, state, deadline);
  } else if (state.step === 'await_group_deadline') {
    await _saveGroupHomework(ctx, state, deadline);
  }
}

// ──────────────────────────────────────────────────────────────
//  MY STUDENTS
// ──────────────────────────────────────────────────────────────
async function myStudents(ctx) {
  // Get teacher's groups
  const { data: teacherGroups } = await supabase
    .from('groups')
    .select('id, name')
    .eq('teacher_id', ctx.user.id)
    .eq('is_active', true);

  if (!teacherGroups?.length) {
    return ctx.reply('📂 Sizda guruhlar yo\'q. Avval guruh yarating.');
  }

  const groupIds = teacherGroups.map(g => g.id);
  const groupNameMap = {};
  teacherGroups.forEach(g => {
    groupNameMap[g.id] = g.name;
  });

  // Get students in teacher's groups
  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, username, group_id, created_at')
    .eq('role', 'student')
    .eq('is_active', true)
    .in('group_id', groupIds)
    .order('created_at', { ascending: false });

  if (error || !data?.length) {
    return ctx.reply('📂 Sizning guruhlaringizda o\'quvchilar yo\'q.');
  }

  const list = data.map((s, i) => {
    const groupName = groupNameMap[s.group_id] || 'Noma\'lum guruh';
    
    return `┌─ *${i + 1}. ${fullName(s)}*\n` +
           `│ 🆔 \`${s.id}\`\n` +
           `│ ${s.username ? `👤 @${s.username}\n│` : ''}` +
           `│ 🏷 ${groupName}\n` +
           `│ 🟢 Aktiv\n` +
           `└─ 📅 ${new Date(s.created_at).toLocaleDateString('ru-RU')}`;
  }).join('\n\n');

  await ctx.reply(
    `📂 *Mening O'quvchilarim (${data.length} ta)*\n\n${list}`,
    { parse_mode: 'Markdown' }
  );
}

// ──────────────────────────────────────────────────────────────
//  ASSIGN GROUP HOMEWORK — Step 1: pick group
// ──────────────────────────────────────────────────────────────
async function startAssignGroup(ctx) {
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, description')
    .eq('teacher_id', ctx.user.id)
    .eq('is_active', true);

  teacherState.set(ctx.from.id, { step: 'pick_group' });

  if (!groups?.length) {
    return ctx.reply(
      `📝 *Guruhga vazifa berish*\n\n` +
      `Sizda guruhlar yo'q. Avval admin orqali guruh yarating.`,
      { parse_mode: 'Markdown' }
    );
  }

  await ctx.reply(
    `📝 *Guruhga vazifa berish*\n\nGuruhni tanlang:`,
    { parse_mode: 'Markdown', ...groupListKeyboard(groups) }
  );
}

// ──────────────────────────────────────────────────────────────
//  Callback: pick_group:<id>
// ──────────────────────────────────────────────────────────────
async function onPickGroup(ctx) {
  await ctx.answerCbQuery();
  const groupId = ctx.callbackQuery.data.replace('pick_group:', '');

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, description')
    .eq('id', groupId)
    .single();

  if (!group) {
    return ctx.reply('❌ Guruh topilmadi.');
  }

  teacherState.update(ctx.from.id, {
    step: 'await_group_file',
    groupId: group.id,
    groupName: group.name,
  });

  await ctx.reply(
    `🏷 Tanlangan guruh: *${group.name}*\n\n` +
    `📎 Endi vazifa faylini yuboring:\n` +
    `_(PDF, rasm, audio, video yoki ovozli xabar)_\n\n` +
    `💡 Faylga izoh (caption) ham qo'shishingiz mumkin.\n\n` +
    `⚠️ Vazifa guruhdagi barcha o'quvchilarga yuboriladi!`,
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

// ──────────────────────────────────────────────────────────────
//  MY GROUPS
// ──────────────────────────────────────────────────────────────
async function myGroups(ctx) {
  const { data: groups, error } = await supabase
    .from('groups')
    .select('id, name, description')
    .eq('teacher_id', ctx.user.id)
    .eq('is_active', true);

  if (error || !groups?.length) {
    return ctx.reply('📂 Sizda guruhlar yo\'q.');
  }

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
    const students = `👥 ${countMap[g.id] || 0} ta o'quvchi`;
    const status = countMap[g.id] > 0 ? '🟢 Aktiv' : '🔴 Bo\'sh';
    
    return `┌─ *${i + 1}. ${g.name}*\n` +
           `│ 📝 ${g.description || 'Tavsif yo\'q'}\n` +
           `│ ${students} • ${status}\n` +
           `└─ 🆔 \`${g.id}\``;
  }).join('\n\n');

  await ctx.reply(
    `📂 *Mening Guruhlarim (${groups.length} ta)*\n\n${list}`,
    { parse_mode: 'Markdown' }
  );
}

// ──────────────────────────────────────────────────────────────
//  HOMEWORK STATUS
// ──────────────────────────────────────────────────────────────
async function homeworkStatus(ctx) {
  const { data, error } = await supabase
    .from('homeworks')
    .select('*, student:student_id(first_name, last_name, username), group:group_id(name)')
    .eq('teacher_id', ctx.user.id)
    .order('created_at', { ascending: false })
    .limit(15);

  if (error || !data?.length) {
    return ctx.reply('📊 Hozircha berilgan vazifalar yo\'q.');
  }

  const lines = data.map((hw, i) => {
    const groupName = hw.group ? `🏷 ${hw.group.name}` : '🏷 Guruh yo\'q';
    const statusIcon = hw.status === 'pending' ? '⏳' : hw.status === 'submitted' ? '✅' : '🔴';
    
    return `┌─ *${i + 1}. ${fullName(hw.student)}*\n` +
           `│ ${groupName}\n` +
           `│ ${statusIcon} ${statusBadge(hw.status)}\n` +
           `│ ⏰ Muddat: ${fmtDate(hw.deadline)}\n` +
           `│ 🕐 ${fmtTimeLeft(hw.deadline)}\n` +
           `└─ 🆔 \`${hw.id}\``;
  }).join('\n\n');

  await ctx.reply(`📊 *Vazifalar holati (so'nggi 15)*\n\n${lines}`, {
    parse_mode: 'Markdown',
  });
}

// ──────────────────────────────────────────────────────────────
//  SUBMITTED HOMEWORKS — teacher reviews
// ──────────────────────────────────────────────────────────────
async function submittedHomeworks(ctx) {
  const { data, error } = await supabase
    .from('homeworks')
    .select('*, student:student_id(first_name, last_name, username), group:group_id(name, id)')
    .eq('teacher_id', ctx.user.id)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false });

  if (error || !data?.length) {
    return ctx.reply('✅ Ko\'rib chiqilmagan topshirilgan vazifalar yo\'q.');
  }

  // Group homeworks by group
  const groupedByGroup = {};
  data.forEach(hw => {
    const groupId = hw.group?.id || 'no_group';
    const groupName = hw.group?.name || 'Guruh yo\'q';
    
    if (!groupedByGroup[groupId]) {
      groupedByGroup[groupId] = {
        name: groupName,
        homeworks: []
      };
    }
    groupedByGroup[groupId].homeworks.push(hw);
  });

  // Create message with groups
  let message = `✅ *Topshirilgan Vazifalar (${data.length} ta)*\n\n`;
  const groupButtons = [];
  
  Object.entries(groupedByGroup).forEach(([groupId, group], index) => {
    const latestHomework = group.homeworks[0]; // Most recent in this group
    const studentName = fullName(latestHomework.student);
    const submittedDate = fmtDate(latestHomework.submitted_at);
    
    message += `┌─ 🏷 *${group.name}* (${group.homeworks.length} ta)\n` +
               `│ 🎓 Oxirgi: ${studentName}\n` +
               `│ 📅 Sana: ${submittedDate}\n` +
               `└─ 🆔 \`${latestHomework.id}\`\n\n`;
    
    // Add button for this group
    groupButtons.push([Markup.button.callback(
      `🏷 ${group.name} (${group.homeworks.length})`,
      `view_group_submissions:${groupId}`
    )]);
  });

  // Add cancel button
  groupButtons.push([Markup.button.callback('❌ Bekor qilish', 'cancel')]);

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(groupButtons)
  });
}

async function onViewGroupSubmissions(ctx) {
  await ctx.answerCbQuery();
  const groupId = ctx.callbackQuery.data.replace('view_group_submissions:', '');

  const { data, error } = await supabase
    .from('homeworks')
    .select('*, student:student_id(first_name, last_name, username), group:group_id(name)')
    .eq('teacher_id', ctx.user.id)
    .eq('status', 'submitted')
    .eq('group_id', groupId === 'no_group' ? null : groupId)
    .order('submitted_at', { ascending: false });

  if (error || !data?.length) {
    return ctx.reply('📋 Bu guruhda topshirilgan vazifalar yo\'q.');
  }

  const groupName = data[0]?.group?.name || 'Guruh yo\'q';
  
  await ctx.reply(`🏷 *${groupName} - Topshirilgan vazifalar (${data.length} ta)*`, {
    parse_mode: 'Markdown',
  });

  // Show each submission with review buttons
  for (const hw of data) {
    const cap =
      `┌─ 🎓 *${fullName(hw.student)}*\n` +
      `│ 📅 Topshirilgan: ${fmtDate(hw.submitted_at)}\n` +
      `│ 🕐 Muddat: ${fmtDate(hw.deadline)}\n` +
      `│ ${hw.submission_caption ? `💬 Izoh: ${hw.submission_caption}` : '💬 Izoh yo\'q'}\n` +
      `└─ 🆔 \`${hw.id}\``;

    const reviewButtons = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Qabul qilish', `accept_homework:${hw.id}`),
        Markup.button.callback('❌ Qaytarish', `reject_homework:${hw.id}`)
      ],
      [Markup.button.callback('💬 Izoh qoldirish', `comment_homework:${hw.id}`)]
    ]);

    try {
      await sendMedia(
        ctx.telegram,
        ctx.chat.id,
        hw.submission_file_id,
        hw.submission_file_type,
        cap
      );
      // Send review buttons as separate message
      await ctx.reply('Kerakli amalni tanlang:', reviewButtons);
    } catch {
      await ctx.reply(cap, { parse_mode: 'Markdown', ...reviewButtons });
    }
  }
}

// ──────────────────────────────────────────────────────────────
//  COIN GIVING
// ──────────────────────────────────────────────────────────────
async function startCoinGiving(ctx) {
  const { data: students } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('role', 'student')
    .eq('is_active', true)
    .order('first_name');

  if (!students?.length) {
    return ctx.reply('📋 Sizda o\'quvchilar yo\'q.');
  }

  teacherState.set(ctx.from.id, { step: 'coin_amount' });
  
  await ctx.reply(
    `🪙 *Coin berish*\n\n` +
    `Qancha coin bermoqchisiz?\n\n` +
    `Misol uchun: 10, 25, 50, 100`,
    { parse_mode: 'Markdown' }
  );
}

async function onCoinAmount(ctx) {
  const amount = parseInt(ctx.message.text);
  
  if (isNaN(amount) || amount < 1) {
    return ctx.reply('❌ Noto\'g\'ri miqdor. Iltimos, musbat raqam kiriting.\n\nMisol: 10, 25, 50, 100');
  }
  
  if (amount > 1000) {
    return ctx.reply('❌ Juda katta miqdor! Iltimos, 1000 dan kam coin kiriting.');
  }

  teacherState.update(ctx.from.id, { step: 'coin_reason', amount });
  
  await ctx.reply(
    `🪙 *Coin berish sababi*\n\n` +
    `${amount} 🪙 coin berish sababini tanlang:`,
    { parse_mode: 'Markdown', ...coinReasonKeyboard() }
  );
}

async function onCoinReason(ctx) {
  const reason = ctx.message.text;
  const state = teacherState.get(ctx.from.id);
  
  if (!state || !state.amount) return;

  const reasonMap = {
    'vazifa uchun': '✅ Vazifa uchun',
    'yutuq uchun': '🏆 Yutuq uchun', 
    'yaxshi ishlashi uchun': '🌟 Yaxshi ishlashi uchun',
    'faollik uchun': '📚 Faollik uchun',
    'boshqa sabab': '🎯 Boshqa sabab'
  };

  const selectedReason = reasonMap[reason.toLowerCase()] || reason;
  
  teacherState.update(ctx.from.id, { 
    step: 'coin_student', 
    amount: state.amount, 
    reason: selectedReason 
  });

  await ctx.reply(
    `🎓 *O\'quvchini tanlang*\n\n` +
    `${state.amount} 🪙 coin berish uchun o\'quvchini tanlang:`,
    { parse_mode: 'Markdown' }
  );

  // Get students for selection
  const { data: students } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('role', 'student')
    .eq('is_active', true)
    .order('first_name');

  await ctx.reply('O\'quvchini tanlang:', coinStudentKeyboard(students));
}

async function onCoinStudentSelect(ctx) {
  await ctx.answerCbQuery();
  const studentId = parseInt(ctx.callbackQuery.data.replace('give_coin_student:', ''));
  const state = teacherState.get(ctx.from.id);
  
  if (!state || !state.amount || !state.reason) return;

  const { data: student } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('id', studentId)
    .eq('role', 'student')
    .single();

  if (!student) {
    return ctx.reply('❌ O\'quvchi topilmadi.');
  }

  teacherState.update(ctx.from.id, { 
    step: 'coin_confirm', 
    amount: state.amount, 
    reason: state.reason,
    studentId,
    studentName: fullName(student)
  });

  await ctx.reply(
    `🪙 *Coin berishni tasdiqlang*\n\n` +
    `┌─ 🎓 O\'quvchi: *${fullName(student)}*\n` +
    `│ 🆔 ID: \`${student.id}\`\n` +
    `│ 🪙 Miqdor: *${state.amount}*\n` +
    `│ 📝 Sabab: *${state.reason}*\n` +
    `└─ 👨‍🏫 O\'qituvchi: *${ctx.user.first_name}*\n\n` +
    `Rostdan ham berishni xohlaysizmi?`,
    { parse_mode: 'Markdown', ...confirmCoinKeyboard() }
  );
}

async function onCoinConfirm(ctx) {
  await ctx.answerCbQuery();
  const state = teacherState.get(ctx.from.id);
  
  if (!state || state.step !== 'coin_confirm') return;

  try {
    // Insert coin record
    await supabase
      .from('coins')
      .insert({
        student_id: state.studentId,
        teacher_id: ctx.user.id,
        amount: state.amount,
        reason: state.reason
      });

    // Get student's total coins
    const { data: coinHistory } = await supabase
      .from('coins')
      .select('amount')
      .eq('student_id', state.studentId);

    const totalCoins = coinHistory?.reduce((sum, coin) => sum + coin.amount, 0);

    teacherState.clear(ctx.from.id);

    await ctx.reply(
      `✅ *Muvaffaqiyatli coin berildi!*\n\n` +
      `┌─ 🎓 O\'quvchi: *${state.studentName}*\n` +
      `│ 🪙 Berilgan: *${state.amount}*\n` +
      `│ 📊 Jami coinlari: *${totalCoins + state.amount}*\n` +
      `│ 📝 Sabab: *${state.reason}*\n` +
      `└─ 🕐 Vaqt: *${new Date().toLocaleString('ru-RU')}*\n\n` +
      `🎉 Tabriklaymiz!`,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    await ctx.reply(`❌ Xatolik: ${error.message}`);
  }
}

async function onCoinCancel(ctx) {
  await ctx.answerCbQuery();
  teacherState.clear(ctx.from.id);
  
  await ctx.reply(
    `❌ *Coin berish bekor qilindi*\n\n` +
    `🔙 Asosiy menuga qaytdingiz.`,
    { parse_mode: 'Markdown' }
  );
}

// ──────────────────────────────────────────────────────────────
//  HOMEWORK REVIEW CALLBACKS
// ──────────────────────────────────────────────────────────────
async function onAcceptHomework(ctx) {
  await ctx.answerCbQuery();
  const homeworkId = ctx.callbackQuery.data.replace('accept_homework:', '');

  try {
    // Update homework status
    const { data: homework, error } = await supabase
      .from('homeworks')
      .update({ status: 'accepted' })
      .eq('id', homeworkId)
      .select('*, student:student_id(first_name, last_name)')
      .single();

    if (error) {
      return ctx.reply(`❌ Xatolik: ${error.message}`);
    }

    // Set state for points input
    teacherState.set(ctx.from.id, { 
      step: 'await_homework_points', 
      homeworkId,
      studentId: homework.student_id,
      studentName: fullName(homework.student)
    });

    await ctx.reply(
      `✅ *Vazifa qabul qilindi!*\n\n` +
      `┌─ 🎓 O'quvchi: *${fullName(homework.student)}*\n` +
      `│ 🆔 Vazifa ID: \`${homework.id}\`\n` +
      `│ � Sana: *${new Date().toLocaleString('ru-RU')}*\n` +
      `└─ 📊 Endi ballarini kiriting:\n\n` +
      `Qancha ball bermoqchisiz? (Misol: 5, 10, 15)`,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    await ctx.reply(`❌ Xatolik: ${error.message}`);
  }
}

async function onRejectHomework(ctx) {
  await ctx.answerCbQuery();
  const homeworkId = ctx.callbackQuery.data.replace('reject_homework:', '');

  try {
    // Update homework status
    const { data: homework, error } = await supabase
      .from('homeworks')
      .update({ status: 'rejected' })
      .eq('id', homeworkId)
      .select('*, student:student_id(first_name, last_name)')
      .single();

    if (error) {
      return ctx.reply(`❌ Xatolik: ${error.message}`);
    }

    await ctx.reply(
      `❌ *Vazifa qaytarildi!*\n\n` +
      `┌─ 🎓 O'quvchi: *${fullName(homework.student)}*\n` +
      `│ 🆔 Vazifa ID: \`${homework.id}\`\n` +
      `│ 📅 Sana: *${new Date().toLocaleString('ru-RU')}*\n` +
      `└─ 📝 Sabab: Qaytarildi (qayta topshirish kerak)`,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    await ctx.reply(`❌ Xatolik: ${error.message}`);
  }
}

async function onCommentHomework(ctx) {
  await ctx.answerCbQuery();
  const homeworkId = ctx.callbackQuery.data.replace('comment_homework:', '');

  // Set state for comment
  teacherState.set(ctx.from.id, { 
    step: 'await_homework_comment', 
    homeworkId 
  });

  await ctx.reply(
    `💬 *Izoh qoldirish*\n\n` +
    `Vazifa uchun izohingizni yozing:\n\n` +
    `Yoki "Bekor qilish" deb yozing:`,
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}
//  TEXT HANDLER — multi-step conversation
// ──────────────────────────────────────────────────────────────
async function handleTeacherText(ctx) {
  const uid = ctx.from.id;
  const state = teacherState.get(uid);
  if (!state) return;

  const text = ctx.message.text?.trim();

  // Step: coin amount
  if (state.step === 'coin_amount') {
    return onCoinAmount(ctx);
  }

  // Step: coin reason
  if (state.step === 'coin_reason') {
    return onCoinReason(ctx);
  }

  // Step: homework comment
  if (state.step === 'await_homework_comment') {
    if (text.toLowerCase() === 'bekor qilish') {
      teacherState.clear(ctx.from.id);
      return ctx.reply('❌ Izoh qoldirish bekor qilindi.');
    }

    if (!text || text.length < 3) {
      return ctx.reply('❌ Izoh kamida 3 ta belgidan iborat bo\'lishi kerak.');
    }

    try {
      const { data: homework, error } = await supabase
        .from('homeworks')
        .update({ 
          status: 'commented',
          teacher_comment: text 
        })
        .eq('id', state.homeworkId)
        .select('*, student:student_id(first_name, last_name)')
        .single();

      if (error) {
        return ctx.reply(`❌ Xatolik: ${error.message}`);
      }

      // Send notification to student
      try {
        await ctx.telegram.sendMessage(
          homework.student_id,
          `💬 *O'qituvchi izoh qoldirdi!*\n\n` +
          `👨‍🏫 O'qituvchi sizning vazifangiz haqida izoh yozdi:\n` +
          `💬 Izoh: *${text}*\n\n` +
          `📅 Sana: *${new Date().toLocaleDateString('ru-RU')}*`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.error('[Teacher→Student notify] error:', notifyError.message);
      }

      teacherState.clear(ctx.from.id);

      await ctx.reply(
        `💬 *Izoh muvaffaqiyatli qoldirildi!*\n\n` +
        `┌─ 🎓 O'quvchi: *${fullName(homework.student)}*\n` +
        `│ 🆔 Vazifa ID: \`${homework.id}\`\n` +
        `│ 💬 Izoh: *${text}*\n` +
        `│ 📅 Sana: *${new Date().toLocaleString('ru-RU')}*\n` +
        `└─ 👨‍🏫 O'qituvchi: *${ctx.user.first_name}*`,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      await ctx.reply(`❌ Xatolik: ${error.message}`);
    }
  }

  // Step: homework points
  if (state.step === 'await_homework_points') {
    const points = parseInt(text);
    
    if (isNaN(points) || points < 0) {
      return ctx.reply('❌ Noto\'g\'ri ball. Iltimos, musbat raqam kiriting.\n\nMisol: 5, 10, 15, 20');
    }
    
    if (points > 100) {
      return ctx.reply('❌ Juda katta ball! Iltimos, 100 dan kam ball kiriting.');
    }

    try {
      // Give points as coins
      await supabase
        .from('coins')
        .insert({
          student_id: state.studentId,
          teacher_id: ctx.user.id,
          amount: points,
          reason: '✅ Vazifa uchun ball'
        });

      // Get student's total coins
      const { data: coinHistory } = await supabase
        .from('coins')
        .select('amount')
        .eq('student_id', state.studentId);

      const totalCoins = coinHistory?.reduce((sum, coin) => sum + coin.amount, 0);

      // Send notification to student
      try {
        await ctx.telegram.sendMessage(
          state.studentId,
          `🎉 *Tabriklaymiz!*\n\n` +
          `👨‍🏫 O'qituvchi sizning vazifangizni qabul qildi!\n` +
          `📊 Ball: *${points}*\n` +
          `🪙 Jami coinlaringiz: *${totalCoins + points}*\n\n` +
          `📅 Sana: *${new Date().toLocaleDateString('ru-RU')}*`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.error('[Teacher→Student notify] error:', notifyError.message);
      }

      teacherState.clear(ctx.from.id);

      await ctx.reply(
        `✅ *Ball muvaffaqiyatli berildi!*\n\n` +
        `┌─ 🎓 O'quvchi: *${state.studentName}*\n` +
        `│ 🆔 Vazifa ID: \`${state.homeworkId}\`\n` +
        `│ 📊 Ball: *${points}*\n` +
        `│ 🪙 Jami coinlari: *${totalCoins + points}*\n` +
        `└─ 🕐 Vaqt: *${new Date().toLocaleString('ru-RU')}*\n\n` +
        `🎉 Tabriklaymiz!`,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      await ctx.reply(`❌ Xatolik: ${error.message}`);
    }
  }

  // Step: manual student ID
  if (state.step === 'manual_student_id') {
    const sid = parseInt(text);
    if (isNaN(sid) || sid < 1) {
      return ctx.reply('❌ Noto\'g\'ri ID. Iltimos, to\'g\'ri raqam kiriting.');
    }
    return startAssign(ctx, sid);
  }

  // Step: custom deadline
  if (state.step === 'await_custom_deadline') {
    const deadline = parseDate(text);
    if (!deadline) {
      return ctx.reply(
        '❌ Noto\'g\'ri format yoki o\'tgan vaqt.\n\n' +
        'To\'g\'ri format: `KK.OO.YYYY SS:DD`\nMasalan: `25.12.2024 18:00`',
        { parse_mode: 'Markdown' }
      );
    }
    await _saveHomework(ctx, state, deadline);
  }

  // Step: custom group deadline
  if (state.step === 'await_custom_group_deadline') {
    const deadline = parseDate(text);
    if (!deadline) {
      return ctx.reply(
        '❌ Noto\'g\'ri format yoki o\'tgan vaqt.\n\n' +
        'To\'g\'ri format: `KK.OO.YYYY SS:DD`\nMasalan: `25.12.2024 18:00`',
        { parse_mode: 'Markdown' }
      );
    }
    await _saveGroupHomework(ctx, state, deadline);
  }

  // Step: group name creation
  if (state.step === 'await_group_name') {
    if (!text || text.length < 2) {
      return ctx.reply('❌ Guruh nomi kamida 2 ta belgidan iborat bo\'lishi kerak.');
    }
    
    const { error } = await supabase
      .from('groups')
      .insert({
        name: text.trim(),
        teacher_id: ctx.user.id,
      });

    if (error) {
      return ctx.reply(`❌ Xatolik: ${error.message}`);
    }

    teacherState.clear(ctx.from.id);

    await ctx.reply(
      `✅ *Guruh muvaffaqiyatli yaratildi!*\n\n` +
      `🏷 Guruh nomi: *${text.trim()}*\n` +
      `👨‍🏫 O'qituvchi: *${fullName(ctx.user)}*`,
      { parse_mode: 'Markdown', ...teacherMenu() }
    );
  }

  // Step: group editing - name
  if (state.step === 'await_group_edit') {
    if (text.toLowerCase() === 'o\'zgartirmaslik') {
      teacherState.update(ctx.from.id, { step: 'await_group_description' });
      return ctx.reply(
        `📝 *Guruh tavsifini kiriting:*\n\n` +
        `Hozirgi tavsif: ${state.currentDescription || 'yo\'q'}\n` +
        `Yoki "O'zgartirmaslik" deb yozing:`,
        { parse_mode: 'Markdown', ...cancelKeyboard() }
      );
    }

    if (!text || text.length < 2) {
      return ctx.reply('❌ Guruh nomi kamida 2 ta belgidan iborat bo\'lishi kerak.');
    }

    teacherState.update(ctx.from.id, { step: 'await_group_description', newName: text });
    return ctx.reply(
      `📝 *Guruh tavsifini kiriting:*\n\n` +
      `Yangi nomi: *${text}*\n` +
      `Hozirgi tavsif: ${state.currentDescription || 'yo\'q'}\n` +
      `Yoki "O'zgartirmaslik" deb yozing:`,
      { parse_mode: 'Markdown', ...cancelKeyboard() }
    );
  }

  // Step: group editing - description
  if (state.step === 'await_group_description') {
    if (text.toLowerCase() === 'o\'zgartirmaslik') {
      const updates = { name: state.newName };
      const { error } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', state.groupId);

      if (error) {
        return ctx.reply(`❌ Xatolik: ${error.message}`);
      }

      teacherState.clear(ctx.from.id);

      return ctx.reply(
        `✅ *Guruh muvaffaqiyatli tahrirlandi!*\n\n` +
        `🏷 Yangi nomi: *${state.newName}*\n` +
        `📝 Tavsif: o\'zgartirilmadi\n` +
        `👨‍🏫 O'qituvchi: *${fullName(ctx.user)}*`,
        { parse_mode: 'Markdown', ...teacherMenu() }
      );
    }

    const updates = { name: state.newName, description: text };
    const { error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', state.groupId);

    if (error) {
      return ctx.reply(`❌ Xatolik: ${error.message}`);
    }

    teacherState.clear(ctx.from.id);

    await ctx.reply(
      `✅ *Guruh muvaffaqiyatli tahrirlandi!*\n\n` +
      `🏷 Yangi nomi: *${state.newName}*\n` +
      `📝 Yangi tavsifi: *${text}*\n` +
      `👨‍🏫 O'qituvchi: *${fullName(ctx.user)}*`,
      { parse_mode: 'Markdown', ...teacherMenu() }
    );
  }
}
// ──────────────────────────────────────────────────────────────
//  INTERNAL: save homework to DB and notify student
// ──────────────────────────────────────────────────────────────
async function _saveHomework(ctx, state, deadline) {
  const { studentId, studentName, fileId, fileType, caption } = state;

  const { data: hw, error } = await supabase
    .from('homeworks')
    .insert({
      teacher_id: ctx.user.id,
      student_id: studentId,
      file_id:    fileId,
      file_type:  fileType,
      caption,
      deadline,
      status: 'pending',
    })
    .select()
    .single();

  teacherState.clear(ctx.from.id);

  if (error) {
    return ctx.reply(`❌ Saqlashda xatolik: ${error.message}`);
  }

  await writeLog(supabase, {
    homework_id: hw.id,
    action: 'assigned',
    actor_id: ctx.user.id,
    metadata: { student_id: studentId, deadline },
  });

  // Confirm to teacher
  await ctx.reply(
    `✅ *Vazifa muvaffaqiyatli berildi!*\n\n` +
    `🎓 O'quvchi: *${studentName}*\n` +
    `⏰ Muddat: *${fmtDate(deadline)}*\n` +
    `🕐 Qolgan vaqt: *${fmtTimeLeft(deadline)}*\n` +
    `📎 Fayl turi: ${fileType}`,
    { parse_mode: 'Markdown', ...teacherMenu() }
  );

  // Notify student
  await _notifyStudent(ctx.telegram, hw, ctx.user, studentId, deadline);
}

// ──────────────────────────────────────────────────────────────
//  INTERNAL: save group homework to DB and notify all students
// ──────────────────────────────────────────────────────────────
async function _saveGroupHomework(ctx, state, deadline) {
  const { groupId, groupName, fileId, fileType, caption } = state;

  // Get all students in the group
  const { data: students, error: studentsError } = await supabase
    .from('users')
    .select('id, first_name, last_name, username')
    .eq('role', 'student')
    .eq('group_id', groupId)
    .eq('is_active', true);

  if (studentsError || !students?.length) {
    teacherState.clear(ctx.from.id);
    return ctx.reply(`❌ "${groupName}" guruhida o'quvchilar yo'q.`);
  }

  // Create homework for each student
  const homeworkPromises = students.map(student =>
    supabase
      .from('homeworks')
      .insert({
        teacher_id: ctx.user.id,
        student_id: student.id,
        group_id: groupId,
        file_id: fileId,
        file_type: fileType,
        caption,
        deadline,
        status: 'pending',
      })
      .select()
      .single()
  );

  const results = await Promise.allSettled(homeworkPromises);
  const successful = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');

  teacherState.clear(ctx.from.id);

  if (successful.length === 0) {
    return ctx.reply('❌ Vazifalarni saqlashda xatolik yuz berdi.');
  }

  // Log successful assignments
  for (const result of successful) {
    await writeLog(supabase, {
      homework_id: result.value.data.id,
      action: 'assigned',
      actor_id: ctx.user.id,
      metadata: { group_id: groupId, deadline },
    });
  }

  // Confirm to teacher
  await ctx.reply(
    `✅ *Guruh vazifasi muvaffaqiyatli berildi!*\n\n` +
    `🏷 Guruh: *${groupName}*\n` +
    `👥 O'quvchilar: *${successful.length}* ta\n` +
    `⏰ Muddat: *${fmtDate(deadline)}*\n` +
    `🕐 Qolgan vaqt: *${fmtTimeLeft(deadline)}*\n` +
    `📎 Fayl turi: ${fileType}` +
    (failed.length > 0 ? `\n\n⚠️ ${failed.length} ta o'quvchiga vazifa yuborilmadi.` : ''),
    { parse_mode: 'Markdown', ...teacherMenu() }
  );

  // Notify all students
  for (let i = 0; i < successful.length; i++) {
    const student = students[i];
    const hw = successful[i].value.data;
    await _notifyStudent(ctx.telegram, hw, ctx.user, student.id, deadline);
  }
}

async function _notifyStudent(telegram, hw, teacher, studentId, deadline) {
  const cap =
    `📚 *Yangi Vazifa Keldi!*\n\n` +
    `👨‍🏫 O'qituvchi: *${fullName(teacher)}*\n` +
    `⏰ Muddat: *${fmtDate(deadline)}*\n` +
    `🕐 Vaqt: *${fmtTimeLeft(deadline)}*` +
    (hw.caption ? `\n\n📝 *Izoh:* ${hw.caption}` : '');

  try {
    await sendMedia(telegram, studentId, hw.file_id, hw.file_type, cap);
    await telegram.sendMessage(
      studentId,
      `👇 Vazifani bajarganingizdan so'ng quyidagi tugmani bosing:`,
      submitBtn(hw.id)
    );
  } catch (err) {
    console.error(`[Teacher→Student notify] studentId=${studentId} err=${err.message}`);
  }
}

// ──────────────────────────────────────────────────────────────
//  CREATE GROUP
// ──────────────────────────────────────────────────────────────
async function createGroup(ctx) {
  teacherState.set(ctx.from.id, { step: 'await_group_name' });
  
  await ctx.reply(
    `➕ *Guruh yaratish*\n\n` +
    `📝 Guruh nomini kiriting:`,
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

// ──────────────────────────────────────────────────────────────
//  EDIT GROUP
// ──────────────────────────────────────────────────────────────
async function editGroup(ctx) {
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, description')
    .eq('teacher_id', ctx.user.id)
    .eq('is_active', true);

  if (!groups?.length) {
    return ctx.reply('📂 Sizda tahrirlash uchun guruhlar yo\'q.');
  }

  await ctx.reply(
    `✏️ *Guruhni tahrirlash*\n\nTahrirlash uchun guruhni tanlang:`,
    { parse_mode: 'Markdown', ...editGroupListKeyboard(groups) }
  );
}

// ──────────────────────────────────────────────────────────────
//  Callback: edit_group:<id>
// ──────────────────────────────────────────────────────────────
async function onEditGroup(ctx) {
  await ctx.answerCbQuery();
  const groupId = ctx.callbackQuery.data.replace('edit_group:', '');

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, description')
    .eq('id', groupId)
    .single();

  if (!group) {
    return ctx.reply('❌ Guruh topilmadi.');
  }

  teacherState.update(ctx.from.id, {
    step: 'await_group_edit',
    groupId: group.id,
    currentName: group.name,
    currentDescription: group.description,
  });

  await ctx.reply(
    `✏️ *Guruhni tahrirlash*\n\n` +
    `🏷 Hozirgi nom: *${group.name}*\n` +
    `📝 Hozirgi tavsif: ${group.description || 'yo\'q'}\n\n` +
    `📝 Yangi nomni yuboring yoki "O'zgartirmaslik" deb yozing:`,
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

// ──────────────────────────────────────────────────────────────
//  ADD STUDENT TO GROUP
// ──────────────────────────────────────────────────────────────
async function addStudentToGroup(ctx) {
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, description')
    .eq('teacher_id', ctx.user.id)
    .eq('is_active', true);

  if (!groups?.length) {
    return ctx.reply('📂 Sizda guruhlar yo\'q. Avval guruh yarating.');
  }

  await ctx.reply(
    `👥 *Guruhga o'quvchi qo'shish*\n\nGuruhni tanlang:`,
    { parse_mode: 'Markdown', ...addStudentGroupKeyboard(groups) }
  );
}

// ──────────────────────────────────────────────────────────────
//  Callback: add_student_group:<id>
// ──────────────────────────────────────────────────────────────
async function onAddStudentGroup(ctx) {
  await ctx.answerCbQuery();
  const groupId = ctx.callbackQuery.data.replace('add_student_group:', '');

  // Get all active students (not just those without groups)
  const { data: availableStudents } = await supabase
    .from('users')
    .select('id, first_name, last_name, username, group_id')
    .eq('role', 'student')
    .eq('is_active', true);

  if (!availableStudents?.length) {
    return ctx.reply('📂 O\'quvchilar topilmadi.');
  }

  teacherState.update(ctx.from.id, {
    step: 'await_student_add',
    groupId: groupId,
  });

  await ctx.reply(
    `👥 *Guruhga o'quvchi qo'shish*\n\nO'quvchini tanlang:`,
    { parse_mode: 'Markdown', ...addStudentToGroupKeyboard(availableStudents, groupId) }
  );
}

// ──────────────────────────────────────────────────────────────
//  Callback: add_student_to_group:<groupId>:<studentId>
// ──────────────────────────────────────────────────────────────
async function onAddStudentToGroup(ctx) {
  await ctx.answerCbQuery();
  const [groupId, studentId] = ctx.callbackQuery.data.replace('add_student_to_group:', '').split(':');

  const { data: student } = await supabase
    .from('users')
    .select('id, first_name, last_name, username, group_id')
    .eq('id', studentId)
    .eq('role', 'student')
    .single();

  if (!student) {
    return ctx.reply('❌ O\'quvchi topilmadi.');
  }

  const wasInGroup = student.group_id !== null;

  const { error } = await supabase
    .from('users')
    .update({ group_id: groupId })
    .eq('id', studentId);

  if (error) {
    return ctx.reply(`❌ Xatolik: ${error.message}`);
  }

  teacherState.clear(ctx.from.id);

  await ctx.reply(
    `✅ *O'quvchi muvaffaqiyatli qo'shildi!*\n\n` +
    `🎓 O'quvchi: *${fullName(student)}*\n` +
    `🏷 Guruhga biriktirildi${wasInGroup ? ' (boshqa guruhdan ko\'chirildi)' : ''}.`,
    { parse_mode: 'Markdown', ...teacherMenu() }
  );
}

// ──────────────────────────────────────────────────────────────
//  REMOVE STUDENT FROM GROUP
// ──────────────────────────────────────────────────────────────
async function removeStudentFromGroup(ctx) {
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, description')
    .eq('teacher_id', ctx.user.id)
    .eq('is_active', true);

  if (!groups?.length) {
    return ctx.reply('📂 Sizda guruhlar yo\'q.');
  }

  await ctx.reply(
    `🗑 *Guruhdan o'quvchi olib tashlash*\n\nGuruhni tanlang:`,
    { parse_mode: 'Markdown', ...removeStudentGroupKeyboard(groups) }
  );
}

// ──────────────────────────────────────────────────────────────
//  Callback: remove_student_group:<id>
// ──────────────────────────────────────────────────────────────
async function onRemoveStudentGroup(ctx) {
  await ctx.answerCbQuery();
  const groupId = ctx.callbackQuery.data.replace('remove_student_group:', '');

  // Get students in this group
  const { data: students } = await supabase
    .from('users')
    .select('id, first_name, last_name, username')
    .eq('role', 'student')
    .eq('group_id', groupId)
    .eq('is_active', true);

  if (!students?.length) {
    return ctx.reply('📂 Bu guruhda o\'quvchilar yo\'q.');
  }

  teacherState.update(ctx.from.id, {
    step: 'await_student_remove',
    groupId: groupId,
  });

  await ctx.reply(
    `🗑 *Guruhdan o'quvchi olib tashlash*\n\nO'quvchini tanlang:`,
    { parse_mode: 'Markdown', ...groupStudentListKeyboard(students, groupId, 'remove') }
  );
}

// ──────────────────────────────────────────────────────────────
//  Callback: remove_student:<groupId>:<studentId>
// ──────────────────────────────────────────────────────────────
async function onRemoveStudent(ctx) {
  await ctx.answerCbQuery();
  const [groupId, studentId] = ctx.callbackQuery.data.replace('remove_student:', '').split(':');

  const { data: student } = await supabase
    .from('users')
    .select('id, first_name, last_name, username')
    .eq('id', studentId)
    .eq('role', 'student')
    .single();

  if (!student) {
    return ctx.reply('❌ O\'quvchi topilmadi.');
  }

  const { error } = await supabase
    .from('users')
    .update({ group_id: null })
    .eq('id', studentId);

  if (error) {
    return ctx.reply(`❌ Xatolik: ${error.message}`);
  }

  teacherState.clear(ctx.from.id);

  await ctx.reply(
    `✅ *O'quvchi guruhdan olindi tashlandi!*\n\n` +
    `🎓 O'quvchi: *${fullName(student)}*\n` +
    `🏷 Guruhdan olib tashlandi.`,
    { parse_mode: 'Markdown', ...teacherMenu() }
  );
}

module.exports = {
  teacherStart, startAssign, onPickStudent,
  startAssignGroup, onPickGroup, myGroups,
  onTeacherFile, onDeadlinePick,
  myStudents, homeworkStatus, submittedHomeworks,
  handleTeacherText,
  createGroup, editGroup, onEditGroup,
  addStudentToGroup, onAddStudentGroup, onAddStudentToGroup,
  removeStudentFromGroup, onRemoveStudentGroup, onRemoveStudent,
  onViewGroupSubmissions,
  startCoinGiving, onCoinAmount, onCoinReason, onCoinStudentSelect, onCoinConfirm, onCoinCancel,
  onAcceptHomework, onRejectHomework, onCommentHomework,
};
