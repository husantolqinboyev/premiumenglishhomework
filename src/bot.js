'use strict';
require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');

// ── Infra ──────────────────────────────────────────────────────
const supabase = require('./database/supabase');
const { authMiddleware } = require('./middleware/auth');
const { startReminderService } = require('./services/reminder');
const { clearAll } = require('./utils/state');
const { adminMenu, teacherMenu, studentMenu } = require('./utils/keyboards');

// ── Handlers ───────────────────────────────────────────
const admin = require('./handlers/admin');
const teacher = require('./handlers/teacher');
const student = require('./handlers/student');

// ── Validation ─────────────────────────────────────────────────
if (!process.env.BOT_TOKEN) {
  console.error('❌  BOT_TOKEN is missing in .env'); process.exit(1);
}

// ══════════════════════════════════════════════════════════════
//  BOT
// ══════════════════════════════════════════════════════════════
const token = process.env.BOT_TOKEN;
const bot = new Telegraf(token);

// ── Global auth ────────────────────────────────────────────────
bot.use(authMiddleware);

// ══════════════════════════════════════════════════════════════
//  /start  &  /menu
// ══════════════════════════════════════════════════════════════
const routeStart = async (ctx) => {
  const role = ctx.user?.role;
  if (role === 'admin')   return admin.adminStart(ctx);
  if (role === 'teacher') return teacher.teacherStart(ctx);
  if (role === 'student') return student.studentStart(ctx);
};
bot.start(routeStart);
bot.command('menu', routeStart);

// ══════════════════════════════════════════════════════════════
//  ADMIN — Reply keyboard handlers
// ══════════════════════════════════════════════════════════════
bot.hears("👨‍💼 Admin yaratish", guard('admin', admin.createAdmin));
bot.hears("👨‍🏫 O'qituvchi qo'shish", guard('admin', admin.startAddTeacher));
bot.hears("🎓 O'quvchi qo'shish",     guard('admin', admin.startAddStudent));
bot.hears("🏷 Guruh yaratish",        guard('admin', admin.startCreateGroup));
bot.hears("📋 Guruhlar ro'yxati",     guard('admin', admin.listGroups));
bot.hears("🔗 O'quvchini guruhga biriktirish", guard('admin', admin.startAssignStudentToGroup));
bot.hears("📋 O'qituvchilar ro'yxati", guard('admin', admin.listTeachers));
bot.hears("� O'quvchilar ro'yxati",   guard('admin', admin.listStudents));
bot.hears('📊 Statistika',             guard('admin', admin.showStats));

// ══════════════════════════════════════════════════════════════
//  TEACHER — Reply keyboard handlers
// ══════════════════════════════════════════════════════════════
bot.hears('📝 Vazifa berish',           guard('teacher', teacher.startAssign));
bot.hears('📝 Guruhga vazifa berish',    guard('teacher', teacher.startAssignGroup));
bot.hears("📂 Mening o'quvchilarim",    guard('teacher', teacher.myStudents));
bot.hears('📂 Guruhlarim',              guard('teacher', teacher.myGroups));
bot.hears('➕ Guruh yaratish',           guard('teacher', teacher.createGroup));
bot.hears('✏️ Guruhni tahrirlash',        guard('teacher', teacher.editGroup));
bot.hears('👥 Guruhga o\'quvchi qo\'shish', guard('teacher', teacher.addStudentToGroup));
bot.hears('🗑 Guruhdan o\'quvchi olib tashlash', guard('teacher', teacher.removeStudentFromGroup));
bot.hears('📊 Vazifalar holati',        guard('teacher', teacher.homeworkStatus));
bot.hears('✅ Topshirilgan vazifalar',  guard('teacher', teacher.submittedHomeworks));
bot.hears('🪙 Coin berish',             guard('teacher', teacher.startCoinGiving));

// ══════════════════════════════════════════════════════════════
//  STUDENT — Reply keyboard handlers
// ══════════════════════════════════════════════════════════════
bot.hears("📚 Mening vazifalarim",   guard('student', student.myHomeworks));
bot.hears("📊 Mening natijalarim",   guard('student', student.myCoins));

// ══════════════════════════════════════════════════════════════
//  CALLBACK QUERY ROUTER
// ══════════════════════════════════════════════════════════════
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery?.data || '';
  const uid  = ctx.from.id;
  const role = ctx.user?.role;

  // ── Universal cancel ────────────────────────────────────────
  if (data === 'cancel') {
    await ctx.answerCbQuery('❌ Bekor qilindi');
    clearAll(uid);
    const menus = { admin: adminMenu, teacher: teacherMenu, student: studentMenu };
    const fn = menus[role];
    return ctx.reply('❌ Amal bekor qilindi.', fn ? fn() : {});
  }

  // ── Admin: teacher assignment ───────────────────────────────
  if (data.startsWith('assign_teacher:') && role === 'admin') {
    return admin.handleAssignTeacher(ctx);
  }

  // ── Admin: group teacher assignment ─────────────────────────
  if (data.startsWith('assign_group_teacher:') && role === 'admin') {
    return admin.handleAssignGroupTeacher(ctx);
  }

  // ── Admin: pick student for group ───────────────────────────
  if (data.startsWith('pick_student_for_group:') && role === 'admin') {
    return admin.handlePickStudentForGroup(ctx);
  }

  // ── Admin: assign group to student ───────────────────────────
  if (data.startsWith('assign_group_to_student:') && role === 'admin') {
    return admin.handleAssignGroupToStudent(ctx);
  }

  // ── Admin: student action ─────────────────────────────────────
  if (data.startsWith('student_action:') && role === 'admin') {
    return admin.handleStudentAction(ctx);
  }

  // ── Admin: edit student ───────────────────────────────────────
  if (data.startsWith('edit_student:') && role === 'admin') {
    return admin.handleEditStudent(ctx);
  }

  // ── Admin: assign student group ───────────────────────────────
  if (data.startsWith('assign_student_group:') && role === 'admin') {
    return admin.handleAssignStudentGroup(ctx);
  }

  // ── Admin: delete student ───────────────────────────────────
  if (data.startsWith('delete_student:') && role === 'admin') {
    return admin.handleDeleteStudent(ctx);
  }

  // ── Admin: student stats ─────────────────────────────────────
  if (data.startsWith('student_stats:') && role === 'admin') {
    return admin.handleStudentStats(ctx);
  }

  // ── Admin: student pagination ───────────────────────────────
  if (data.startsWith('student_page:') && role === 'admin') {
    return admin.handleStudentPage(ctx);
  }

  // ── Admin: teacher action ────────────────────────────────────
  if (data.startsWith('teacher_action:') && role === 'admin') {
    return admin.handleTeacherAction(ctx);
  }

  // ── Admin: teacher pagination ───────────────────────────────
  if (data.startsWith('teacher_page:') && role === 'admin') {
    return admin.handleTeacherPage(ctx);
  }

  // ── Teacher: student picked ─────────────────────────────────
  if (data.startsWith('pick_student:') && role === 'teacher') {
    return teacher.onPickStudent(ctx);
  }

  // ── Teacher: group picked ───────────────────────────────────
  if (data.startsWith('pick_group:') && role === 'teacher') {
    return teacher.onPickGroup(ctx);
  }

  // ── Teacher: view group submissions ─────────────────────────
  if (data.startsWith('view_group_submissions:') && role === 'teacher') {
    return teacher.onViewGroupSubmissions(ctx);
  }

  // ── Teacher: coin giving ───────────────────────────────────
  if (data.startsWith('confirm_coin') && role === 'teacher') {
    return teacher.onCoinConfirm(ctx);
  }

  if (data.startsWith('cancel_coin') && role === 'teacher') {
    return teacher.onCoinCancel(ctx);
  }

  if (data.startsWith('give_coin_student:') && role === 'teacher') {
    return teacher.onCoinStudentSelect(ctx);
  }

  // ── Teacher: homework review ───────────────────────────────
  if (data.startsWith('accept_homework:') && role === 'teacher') {
    return teacher.onAcceptHomework(ctx);
  }

  if (data.startsWith('reject_homework:') && role === 'teacher') {
    return teacher.onRejectHomework(ctx);
  }

  if (data.startsWith('comment_homework:') && role === 'teacher') {
    return teacher.onCommentHomework(ctx);
  }

  // ── Teacher: edit group ─────────────────────────────────────
  if (data.startsWith('edit_group:') && role === 'teacher') {
    return teacher.onEditGroup(ctx);
  }

  // ── Teacher: add student to group ───────────────────────────
  if (data.startsWith('add_student_group:') && role === 'teacher') {
    return teacher.onAddStudentGroup(ctx);
  }

  // ── Teacher: add specific student to group ───────────────────
  if (data.startsWith('add_student_to_group:') && role === 'teacher') {
    return teacher.onAddStudentToGroup(ctx);
  }

  // ── Teacher: remove student from group ───────────────────────
  if (data.startsWith('remove_student_group:') && role === 'teacher') {
    return teacher.onRemoveStudentGroup(ctx);
  }

  // ── Teacher: remove specific student ─────────────────────────
  if (data.startsWith('remove_student:') && role === 'teacher') {
    return teacher.onRemoveStudent(ctx);
  }

  // ── Teacher: deadline picked ────────────────────────────────
  if (data.startsWith('dl_') && role === 'teacher') {
    return teacher.onDeadlinePick(ctx);
  }

  // ── Student: submit homework ────────────────────────────────
  if (data.startsWith('submit:') && role === 'student') {
    return student.onSubmitCallback(ctx);
  }

  // ── Student: confirm submission ─────────────────────────────
  if (data.startsWith('confirm:') && role === 'student') {
    return student.onConfirmSubmit(ctx);
  }

  // Unknown
  await ctx.answerCbQuery('⚠️ Noma\'lum amal');
});

// ══════════════════════════════════════════════════════════════
//  MEDIA / FILE HANDLER
// ══════════════════════════════════════════════════════════════
const mediaTypes = ['document', 'photo', 'audio', 'video', 'voice'];

mediaTypes.forEach((type) => {
  bot.on(type, async (ctx) => {
    const role = ctx.user?.role;
    if (role === 'teacher') return teacher.onTeacherFile(ctx);
    if (role === 'student') return student.onStudentFile(ctx);
  });
});

// ══════════════════════════════════════════════════════════════
//  TEXT MESSAGE — conversation state machine
// ══════════════════════════════════════════════════════════════
bot.on('text', async (ctx) => {
  const text = ctx.message?.text || '';
  // Skip commands (already handled)
  if (text.startsWith('/')) return;

  // Skip reply-keyboard buttons (already handled by .hears)
  // Just delegate to role handlers
  const role = ctx.user?.role;
  if (role === 'admin')   return admin.handleAdminText(ctx);
  if (role === 'teacher') return teacher.handleTeacherText(ctx);
  // (students don't have text-based conversation steps currently)
});

// ══════════════════════════════════════════════════════════════
//  GLOBAL ERROR HANDLER
// ══════════════════════════════════════════════════════════════
bot.catch(async (err, ctx) => {
  console.error(`[GlobalError] ${ctx.updateType}:`, err.message, err.stack);
  try {
    await ctx.reply('⚠️ Kutilmagan xatolik yuz berdi. Qayta urinib ko\'ring yoki /start bosing.');
  } catch (_) {}
});

// ══════════════════════════════════════════════════════════════
//  LAUNCH
// ══════════════════════════════════════════════════════════════
(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   🎓 EduFlow Bot — Starting...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Test DB connection
  const { error } = await supabase.from('users').select('id').limit(1);
  if (error) {
    console.error('❌  Supabase connection failed:', error.message);
    process.exit(1);
  }
  console.log('✅  Supabase connected');

  // Start background reminder cron
  startReminderService(bot);

  // Launch Telegram bot (long polling)
  await bot.launch();
  console.log('✅  Bot launched successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Graceful shutdown
  const stop = (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down...`);
    bot.stop(signal);
    process.exit(0);
  };
  process.once('SIGINT',  () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
})();

// ──────────────────────────────────────────────────────────────
//  HEALTH CHECK SERVER (for Render)
// ──────────────────────────────────────────────────────────────
const healthApp = express();

healthApp.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

healthApp.get('/', (req, res) => {
  res.status(200).json({
    message: 'EduFlow Bot is running',
    status: 'healthy'
  });
});

healthApp.get('/ping', (req, res) => {
  res.status(200).json({
    pong: true,
    timestamp: new Date().toISOString()
  });
});

// Start health server
const HEALTH_PORT = process.env.HEALTH_PORT || 3000;
healthApp.listen(HEALTH_PORT, () => {
  console.log(`🚀 Health check server running on port ${HEALTH_PORT}`);
  console.log(`📊 Health endpoint: http://localhost:${HEALTH_PORT}/health`);
});

// ──────────────────────────────────────────────────────────────
//  SELF-PING FUNCTION (keep bot alive)
// ──────────────────────────────────────────────────────────────
function startSelfPing() {
  const pingInterval = process.env.PING_INTERVAL || 300000; // 5 minutes
  const renderUrl = process.env.RENDER_URL;
  
  setInterval(() => {
    try {
      // Ping bot itself using Render URL
      if (renderUrl) {
        const https = require('https');
        const req = https.get(`${renderUrl}/health`, (res) => {
          console.log(`🏓 Self-ping sent to ${renderUrl}/health at ${new Date().toISOString()}`);
          console.log(`📊 Response: ${res.statusCode}`);
        });
        
        req.on('error', (error) => {
          console.error('❌ Self-ping request failed:', error.message);
        });
        
        req.setTimeout(10000, () => {
          req.destroy();
          console.error('❌ Self-ping timeout after 10 seconds');
        });
      }
    } catch (error) {
      console.error('❌ Self-ping failed:', error.message);
    }
  }, pingInterval);
  
  console.log(`🔄 Self-ping started with ${pingInterval/1000} seconds interval`);
  console.log(`🌐 Render URL: ${renderUrl}`);
}

// Start self-ping if enabled
if (process.env.ENABLE_SELF_PING === 'true') {
  startSelfPing();
}

// ──────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
//  HELPER: role guard middleware factory
// ──────────────────────────────────────────────────────────────
function guard(role, fn) {
  return async (ctx) => {
    if (ctx.user?.role !== role) {
      return ctx.reply('🚫 Bu amalni bajarish uchun ruxsatingiz yo\'q.');
    }
    return fn(ctx);
  };
}
