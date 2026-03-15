'use strict';
const moment = require('moment-timezone');
require('dotenv').config();

const TZ = process.env.TIMEZONE || 'Asia/Tashkent';

/** Format date nicely */
function fmtDate(date) {
  return moment(date).tz(TZ).format('DD.MM.YYYY HH:mm');
}

/** Human-readable time remaining */
function fmtTimeLeft(deadline) {
  const diff = moment(deadline).diff(moment());
  if (diff <= 0) return '⛔ Muddat o\'tgan';
  const d = moment.duration(diff);
  const h = Math.floor(d.asHours());
  const m = d.minutes();
  if (h >= 24) return `${Math.floor(h / 24)} kun ${h % 24} soat ${m} daqiqa`;
  return `${h} soat ${m} daqiqa`;
}

/** Add N hours from now → ISO string */
function deadlineFromHours(hours) {
  return moment().tz(TZ).add(hours, 'hours').toISOString();
}

/** Parse custom date "25.12.2024 18:00" */
function parseDate(str) {
  const fmts = ['DD.MM.YYYY HH:mm', 'DD.MM.YYYY', 'YYYY-MM-DD HH:mm'];
  const m = moment.tz(str.trim(), fmts, true, TZ);
  if (!m.isValid()) return null;
  if (m.isBefore(moment())) return null;
  return m.toISOString();
}

/** Extract file info from a message */
function extractFile(msg) {
  if (msg.document) return { file_id: msg.document.file_id, file_type: 'document' };
  if (msg.photo)    return { file_id: msg.photo[msg.photo.length - 1].file_id, file_type: 'photo' };
  if (msg.audio)    return { file_id: msg.audio.file_id, file_type: 'audio' };
  if (msg.video)    return { file_id: msg.video.file_id, file_type: 'video' };
  if (msg.voice)    return { file_id: msg.voice.file_id, file_type: 'voice' };
  return null;
}

/** Full display name */
function fullName(u) {
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ');
  return u.username ? `${n} (@${u.username})` : n;
}

/** Status badge */
function statusBadge(s) {
  return { pending: '⏳ Kutilmoqda', submitted: '✅ Topshirildi', overdue: '🔴 Muddat o\'tgan' }[s] || s;
}

/** Write a log entry (fire-and-forget) */
async function writeLog(supabase, { homework_id, action, actor_id = null, metadata = {} }) {
  try {
    await supabase.from('logs').insert({ homework_id, action, actor_id, metadata });
  } catch (error) {
    // Silently ignore log errors
  }
}

/** Send the right Telegram media type */
async function sendMedia(telegram, chatId, file_id, file_type, caption) {
  const opts = caption ? { caption, parse_mode: 'Markdown' } : {};
  switch (file_type) {
    case 'document': return telegram.sendDocument(chatId, file_id, opts);
    case 'photo':    return telegram.sendPhoto(chatId, file_id, opts);
    case 'audio':    return telegram.sendAudio(chatId, file_id, opts);
    case 'video':    return telegram.sendVideo(chatId, file_id, opts);
    case 'voice':    return telegram.sendVoice(chatId, file_id, opts);
    default:         return telegram.sendDocument(chatId, file_id, opts);
  }
}

module.exports = {
  fmtDate, fmtTimeLeft, deadlineFromHours, parseDate,
  extractFile, fullName, statusBadge, writeLog, sendMedia,
};
