'use strict';
const supabase = require('../database/supabase');
const { studentMenu, submitBtn, confirmKeyboard, cancelKeyboard } = require('../utils/keyboards');
const {
  fmtDate, fmtTimeLeft, extractFile, fullName, statusBadge, writeLog, sendMedia,
} = require('../utils/helpers');
const { studentState } = require('../utils/state');

// ──────────────────────────────────────────────────────────────
//  /start
// ──────────────────────────────────────────────────────────────
async function studentStart(ctx) {
  const [{ count: pending }, { count: overdue }] = await Promise.all([
    supabase.from('homeworks').select('id', { count: 'exact', head: true })
      .eq('student_id', ctx.user.id).eq('status', 'pending'),
    supabase.from('homeworks').select('id', { count: 'exact', head: true })
      .eq('student_id', ctx.user.id).eq('status', 'overdue'),
  ]);

  let extra = '';
  if (overdue > 0) extra += `\n🔴 *${overdue} ta muddati o'tgan vazifa!*`;
  if (pending > 0) extra += `\n⏳ *${pending} ta bajarilmagan vazifa bor.*`;

  await ctx.reply(
    `🎓 *Xush kelibsiz, ${ctx.user.first_name}!*\n\n` +
    `Siz *O'quvchi* sifatida kirdingiз.${extra}\n\n` +
    `Menyudan foydalaning:`,
    { parse_mode: 'Markdown', ...studentMenu() }
  );
}

// ──────────────────────────────────────────────────────────────
//  MY HOMEWORKS — show list with submit buttons
// ──────────────────────────────────────────────────────────────
async function myHomeworks(ctx) {
  const { data, error } = await supabase
    .from('homeworks')
    .select('*, teacher:teacher_id(first_name, last_name, username)')
    .eq('student_id', ctx.user.id)
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) return ctx.reply('❌ Xatolik yuz berdi.');
  if (!data?.length) {
    return ctx.reply('📚 Hozircha sizga vazifa berilmagan.');
  }

  const pending   = data.filter((h) => h.status === 'pending');
  const submitted = data.filter((h) => ['submitted', 'accepted', 'rejected', 'commented'].includes(h.status));
  const overdue   = data.filter((h) => h.status === 'overdue');

  let msg = `📚 *Mening Vazifalarim*\n`;
  msg += `\n⏳ Kutilmoqda: ${pending.length} | ✅ Topshirildi: ${submitted.length} | 🔴 O'tdi: ${overdue.length}\n`;

  if (overdue.length) {
    msg += `\n━━━━━ 🔴 MUDDATI O'TGAN ━━━━━\n`;
    for (const hw of overdue) {
      msg +=
        `\n👨‍🏫 *${fullName(hw.teacher)}*\n` +
        `📅 Muddat edi: ${fmtDate(hw.deadline)}\n`;
    }
  }

  if (submitted.length) {
    msg += `\n━━━━━ ✅ TOPSHIRILGAN ━━━━━\n`;
    for (const hw of submitted) {
      let statusText = '';
      if (hw.status === 'accepted') statusText = '✅ Qabul qilingan';
      else if (hw.status === 'rejected') statusText = '❌ Qaytarilgan';
      else if (hw.status === 'commented') statusText = '💬 Izoh qoldirilgan';
      else statusText = '📋 Ko\'rib chiqilmoqda';
      
      msg +=
        `\n👨‍🏫 *${fullName(hw.teacher)}*\n` +
        `📅 Topshirilgan: ${fmtDate(hw.submitted_at)}\n` +
        `📊 Holati: ${statusText}\n`;
    }
  }

  await ctx.reply(msg, { parse_mode: 'Markdown' });

  // For each pending — send file preview + submit button
  for (const hw of pending) {
    const cap =
      `⏳ *Kutilayotgan vazifa*\n` +
      `👨‍🏫 O'qituvchi: *${fullName(hw.teacher)}*\n` +
      `⏰ Muddat: *${fmtDate(hw.deadline)}*\n` +
      `🕐 Qoldi: *${fmtTimeLeft(hw.deadline)}*` +
      (hw.caption ? `\n\n📝 ${hw.caption}` : '');

    try {
      await sendMedia(ctx.telegram, ctx.chat.id, hw.file_id, hw.file_type, cap);
    } catch {
      await ctx.reply(cap, { parse_mode: 'Markdown' });
    }

    await ctx.reply(
      `📤 Ushbu vazifani topshirish uchun:`,
      submitBtn(hw.id)
    );
  }
}

// ──────────────────────────────────────────────────────────────
//  MY STATS
// ──────────────────────────────────────────────────────────────
async function myStats(ctx) {
  const [
    { count: total },
    { count: submitted },
    { count: pending },
    { count: overdue },
  ] = await Promise.all([
    supabase.from('homeworks').select('id', { count: 'exact', head: true }).eq('student_id', ctx.user.id),
    supabase.from('homeworks').select('id', { count: 'exact', head: true }).eq('student_id', ctx.user.id).eq('status', 'submitted'),
    supabase.from('homeworks').select('id', { count: 'exact', head: true }).eq('student_id', ctx.user.id).eq('status', 'pending'),
    supabase.from('homeworks').select('id', { count: 'exact', head: true }).eq('student_id', ctx.user.id).eq('status', 'overdue'),
  ]);

  const t    = total || 0;
  const s    = submitted || 0;
  const rate = t > 0 ? Math.round((s / t) * 100) : 0;
  const bar  = '█'.repeat(Math.round(rate / 10)) + '░'.repeat(10 - Math.round(rate / 10));

  await ctx.reply(
    `📊 *Mening Natijalarim*\n\n` +
    `${bar} *${rate}%*\n\n` +
    `📚 Jami vazifalar: *${t}*\n` +
    `✅ Topshirildi:    *${s}*\n` +
    `⏳ Kutilmoqda:    *${pending || 0}*\n` +
    `🔴 Muddati o'tdi: *${overdue || 0}*`,
    { parse_mode: 'Markdown' }
  );
}

// ──────────────────────────────────────────────────────────────
//  CALLBACK: submit:<homeworkId>  — student clicks Submit button
// ──────────────────────────────────────────────────────────────
async function onSubmitCallback(ctx) {
  const hwId = ctx.callbackQuery.data.replace('submit:', '');
  await ctx.answerCbQuery('📤 Topshirish jarayoni boshlandi...');

  const { data: hw, error } = await supabase
    .from('homeworks')
    .select('*, teacher:teacher_id(first_name, last_name, username)')
    .eq('id', hwId)
    .eq('student_id', ctx.user.id)
    .single();

  if (error || !hw) return ctx.reply('❌ Vazifa topilmadi.');
  if (hw.status === 'submitted') {
    return ctx.reply('✅ Bu vazifani allaqachon topshirgansiz.');
  }
  if (hw.status === 'overdue') {
    return ctx.reply(
      '🔴 *Bu vazifaning muddati o\'tib ketgan.*\n\n' +
      'Iltimos o\'qituvchangiz bilan bog\'laning.',
      { parse_mode: 'Markdown' }
    );
  }

  // Show original assignment for reference
  const refCap =
    `📋 *Asl Vazifa (eslatma)*\n` +
    `👨‍🏫 O'qituvchi: *${fullName(hw.teacher)}*\n` +
    `⏰ Muddat: *${fmtDate(hw.deadline)}*\n` +
    `🕐 ${fmtTimeLeft(hw.deadline)}` +
    (hw.caption ? `\n\n📝 ${hw.caption}` : '');

  try {
    await sendMedia(ctx.telegram, ctx.chat.id, hw.file_id, hw.file_type, refCap);
  } catch {
    await ctx.reply(refCap, { parse_mode: 'Markdown' });
  }

  studentState.set(ctx.from.id, {
    step:      'await_submission_file',
    homeworkId: hw.id,
    teacherId:  hw.teacher_id,
  });

  await ctx.reply(
    `📤 *Ish faylingizni yuboring*\n\n` +
    `_(PDF, rasm, audio, video yoki ovozli xabar)_\n` +
    `💡 Faylga izoh ham qo'sha olasiz.`,
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

// ──────────────────────────────────────────────────────────────
//  Student sends submission file
// ──────────────────────────────────────────────────────────────
async function onStudentFile(ctx) {
  const state = studentState.get(ctx.from.id);
  if (!state || state.step !== 'await_submission_file') return;

  const file = extractFile(ctx.message);
  if (!file) {
    return ctx.reply('❌ Qo\'llab-quvvatlanmaydigan fayl. PDF, rasm, audio, video yoki ovoz yuboring.');
  }

  studentState.update(ctx.from.id, {
    step:               'confirm_submission',
    submissionFileId:   file.file_id,
    submissionFileType: file.file_type,
    submissionCaption:  ctx.message.caption || null,
  });

  await ctx.reply(
    `✅ *Fayl qabul qilindi!*\n\n` +
    `📎 Turi: *${file.file_type}*\n` +
    (ctx.message.caption ? `💬 Izoh: _"${ctx.message.caption}"_\n` : '') +
    `\nTopshirishni tasdiqlaysizmi?`,
    { parse_mode: 'Markdown', ...confirmKeyboard(state.homeworkId) }
  );
}

// ──────────────────────────────────────────────────────────────
//  CALLBACK: confirm:<homeworkId>
// ──────────────────────────────────────────────────────────────
async function onConfirmSubmit(ctx) {
  const hwId = ctx.callbackQuery.data.replace('confirm:', '');
  await ctx.answerCbQuery('⏳ Topshirilmoqda...');

  const uid   = ctx.from.id;
  const state = studentState.get(uid);
  if (!state || state.step !== 'confirm_submission') {
    return ctx.reply('❌ Topshirish sessiyasi topilmadi. Qayta /start bosing.');
  }

  const { submissionFileId, submissionFileType, submissionCaption, teacherId } = state;

  const { error } = await supabase
    .from('homeworks')
    .update({
      status:               'submitted',
      submission_file_id:   submissionFileId,
      submission_file_type: submissionFileType,
      submission_caption:   submissionCaption,
      submitted_at:         new Date().toISOString(),
    })
    .eq('id', hwId)
    .eq('student_id', uid);

  studentState.clear(uid);

  if (error) {
    return ctx.reply(`❌ Xatolik: ${error.message}`);
  }

  await writeLog(supabase, {
    homework_id: hwId,
    action:      'submitted',
    actor_id:    uid,
  });

  await ctx.reply(
    `🎉 *Vazifa muvaffaqiyatli topshirildi!*\n\n` +
    `O'qituvchingizga xabar yuborildi. Zo'r ish! 💪`,
    { parse_mode: 'Markdown', ...studentMenu() }
  );

  // Notify teacher
  await _notifyTeacherOnSubmit(ctx.telegram, hwId, teacherId, ctx.user);
}

async function _notifyTeacherOnSubmit(telegram, hwId, teacherId, student) {
  try {
    await telegram.sendMessage(
      teacherId,
      `🔔 *Vazifa topshirildi!*\n\n` +
      `🎓 O'quvchi: *${fullName(student)}*\n` +
      `📅 Vaqt: *${fmtDate(new Date())}*\n\n` +
      `Ko'rish uchun: ✅ Topshirilgan vazifalar`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(`[Student→Teacher notify] teacherId=${teacherId} err=${err.message}`);
  }
}

// ──────────────────────────────────────────────────────────────
//  COIN HISTORY
// ──────────────────────────────────────────────────────────────
async function myCoins(ctx) {
  try {
    // Get student's coin history
    const { data: coinHistory, error } = await supabase
      .from('coins')
      .select('*, teacher:teacher_id(first_name, last_name)')
      .eq('student_id', ctx.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return ctx.reply('❌ Xatolik yuz berdi.');
    }

    // Get total coins
    const totalCoins = coinHistory?.reduce((sum, coin) => sum + coin.amount, 0) || 0;

    if (!coinHistory?.length) {
      return ctx.reply(
        `🪙 *Mening Coinlarim*\n\n` +
        `📊 Jami coin: *0*\n\n` +
        `💡 Hali coinlaringiz yo'q. Vazifalarni yaxshi bajaring!`,
        { parse_mode: 'Markdown' }
      );
    }

    // Create message with coin history
    let message = `🪙 *Mening Coinlarim*\n\n`;
    message += `📊 Jami coin: *${totalCoins}*\n\n`;
    message += `📜 *Oxirgi operatsiyalar:*\n\n`;

    coinHistory.forEach((coin, index) => {
      const teacherName = coin.teacher ? 
        `${coin.teacher.first_name} ${coin.teacher.last_name || ''}`.trim() : 
        'O\'qituvchi';
      const date = new Date(coin.created_at).toLocaleDateString('ru-RU');
      
      message += `${index + 1}. ${coin.amount > 0 ? '+' : ''}${coin.amount} 🪙\n`;
      message += `   👨‍🏫 ${teacherName}\n`;
      message += `   📝 ${coin.reason || 'Sababsiz'}\n`;
      message += `   📅 ${date}\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('[myCoins] error:', error);
    await ctx.reply('❌ Xatolik yuz berdi.');
  }
}

module.exports = {
  studentStart,
  myHomeworks,
  myStats,
  myCoins,
  onSubmitCallback,
  onStudentFile,
  onConfirmSubmit,
};
