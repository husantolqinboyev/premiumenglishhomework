'use strict';
const cron     = require('node-cron');
const moment   = require('moment-timezone');
const supabase = require('../database/supabase');
const { fmtDate, fmtTimeLeft, writeLog, sendMedia } = require('../utils/helpers');
const { submitBtn } = require('../utils/keyboards');
require('dotenv').config();

const TZ = process.env.TIMEZONE || 'Asia/Tashkent';

// ──────────────────────────────────────────────────────────────
//  MAIN: Start the cron scheduler
// ──────────────────────────────────────────────────────────────
function startReminderService(bot) {
  // Runs every minute
  cron.schedule('* * * * *', async () => {
    await runChecks(bot);
  }, { timezone: TZ });

  console.log('[ReminderService] ✅ Started — checking every minute');
}

// ──────────────────────────────────────────────────────────────
//  Core check: iterate all pending homeworks
// ──────────────────────────────────────────────────────────────
async function runChecks(bot) {
  const { data: homeworks, error } = await supabase
    .from('homeworks')
    .select(`
      id, deadline, caption, file_id, file_type,
      status,
      reminder_6h_sent, reminder_1h_sent, overdue_sent,
      student:student_id (id, first_name, last_name, username),
      teacher:teacher_id (id, first_name, last_name, username)
    `)
    .eq('status', 'pending')
    .order('deadline', { ascending: true });

  if (error) {
    console.error('[ReminderService] DB error:', error.message);
    return;
  }
  if (!homeworks?.length) return;

  const now = moment().tz(TZ);

  for (const hw of homeworks) {
    try {
      await processOne(bot, hw, now);
    } catch (err) {
      console.error(`[ReminderService] Error on hw ${hw.id}:`, err.message);
    }
  }
}

// ──────────────────────────────────────────────────────────────
//  Process a single homework
// ──────────────────────────────────────────────────────────────
async function processOne(bot, hw, now) {
  const deadline    = moment(hw.deadline).tz(TZ);
  const minutesLeft = deadline.diff(now, 'minutes');

  // ── 6-hour window: minutesLeft ∈ (60, 360] ─────────────────
  if (!hw.reminder_6h_sent && minutesLeft > 60 && minutesLeft <= 360) {
    await send6hReminder(bot, hw);
    await supabase.from('homeworks').update({ reminder_6h_sent: true }).eq('id', hw.id);
    await writeLog(supabase, {
      homework_id: hw.id, action: 'reminded_6h',
      metadata: { minutes_left: minutesLeft },
    });
    return;
  }

  // ── 1-hour window: minutesLeft ∈ (0, 60] ───────────────────
  if (!hw.reminder_1h_sent && minutesLeft > 0 && minutesLeft <= 60) {
    await send1hReminder(bot, hw);
    await supabase.from('homeworks').update({ reminder_1h_sent: true }).eq('id', hw.id);
    await writeLog(supabase, {
      homework_id: hw.id, action: 'reminded_1h',
      metadata: { minutes_left: minutesLeft },
    });
    return;
  }

  // ── Overdue: minutesLeft <= 0 ───────────────────────────────
  if (!hw.overdue_sent && minutesLeft <= 0) {
    await sendOverdue(bot, hw);
    await supabase.from('homeworks')
      .update({ status: 'overdue', overdue_sent: true })
      .eq('id', hw.id);
    await writeLog(supabase, {
      homework_id: hw.id, action: 'overdue',
      metadata: { deadline: hw.deadline },
    });
  }
}

// ──────────────────────────────────────────────────────────────
//  6-hour reminder → student
// ──────────────────────────────────────────────────────────────
async function send6hReminder(bot, hw) {
  const { student, teacher } = hw;
  const msg =
    `⚠️ *Eslatma: 6 soat qoldi!*\n\n` +
    `Sizda bajarilmagan vazifa bor!\n\n` +
    `👨‍🏫 O'qituvchi: *${teacher.first_name} ${teacher.last_name || ''}*\n` +
    `⏰ Muddat: *${fmtDate(hw.deadline)}*\n` +
    `🕐 Qoldi: *${fmtTimeLeft(hw.deadline)}*\n\n` +
    `📤 Iltimos vazifani tezroq topshiring!`;

  try {
    await bot.telegram.sendMessage(student.id, msg, {
      parse_mode: 'Markdown',
      ...submitBtn(hw.id),
    });
    console.log(`[6h] ✅ Reminded student ${student.id} for HW ${hw.id.slice(0, 8)}`);
  } catch (err) {
    console.error(`[6h] ❌ Student ${student.id}:`, err.message);
  }
}

// ──────────────────────────────────────────────────────────────
//  1-hour reminder → student
// ──────────────────────────────────────────────────────────────
async function send1hReminder(bot, hw) {
  const { student, teacher } = hw;
  const msg =
    `🚨 *SHOSHILINCH! 1 soat qoldi!*\n\n` +
    `Vazifa muddati tugashiga 1 soat qoldi!\n\n` +
    `👨‍🏫 O'qituvchi: *${teacher.first_name} ${teacher.last_name || ''}*\n` +
    `⏰ Muddat: *${fmtDate(hw.deadline)}*\n` +
    `🕐 Qoldi: *${fmtTimeLeft(hw.deadline)}*\n\n` +
    `📤 *HOZIROQ topshiring!*`;

  try {
    await bot.telegram.sendMessage(student.id, msg, {
      parse_mode: 'Markdown',
      ...submitBtn(hw.id),
    });
    console.log(`[1h] ✅ Reminded student ${student.id} for HW ${hw.id.slice(0, 8)}`);
  } catch (err) {
    console.error(`[1h] ❌ Student ${student.id}:`, err.message);
  }
}

// ──────────────────────────────────────────────────────────────
//  Overdue → student + teacher
// ──────────────────────────────────────────────────────────────
async function sendOverdue(bot, hw) {
  const { student, teacher } = hw;

  // → Student
  try {
    await bot.telegram.sendMessage(
      student.id,
      `🔴 *Vazifa muddati o'tdi!*\n\n` +
      `Afsuski, vazifani o'z vaqtida topshirmadingiz.\n\n` +
      `👨‍🏫 O'qituvchi: *${teacher.first_name} ${teacher.last_name || ''}*\n` +
      `📅 Muddat edi: *${fmtDate(hw.deadline)}*\n\n` +
      `Iltimos o'qituvchingiz bilan bog'laning.`,
      { parse_mode: 'Markdown' }
    );
    console.log(`[Overdue] ✅ Notified student ${student.id} for HW ${hw.id.slice(0, 8)}`);
  } catch (err) {
    console.error(`[Overdue] ❌ Student ${student.id}:`, err.message);
  }

  // → Teacher
  try {
    await bot.telegram.sendMessage(
      teacher.id,
      `🔴 *Muddat o'tdi — Vazifa topshirilmadi!*\n\n` +
      `🎓 O'quvchi: *${student.first_name} ${student.last_name || ''}*\n` +
      (student.username ? `👤 @${student.username}\n` : '') +
      `🆔 \`${student.id}\`\n` +
      `📅 Muddat edi: *${fmtDate(hw.deadline)}*`,
      { parse_mode: 'Markdown' }
    );
    console.log(`[Overdue] ✅ Notified teacher ${teacher.id} for HW ${hw.id.slice(0, 8)}`);
  } catch (err) {
    console.error(`[Overdue] ❌ Teacher ${teacher.id}:`, err.message);
  }
}

module.exports = { startReminderService };
