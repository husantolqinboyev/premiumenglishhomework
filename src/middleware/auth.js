'use strict';
const supabase = require('../database/supabase');

/**
 * Runs on every update.
 * Fetches user from DB and attaches to ctx.user.
 * Blocks anyone not pre-registered.
 */
async function authMiddleware(ctx, next) {
  // Only check real user messages/callbacks
  const from = ctx.from;
  if (!from || from.is_bot) return next();

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', from.id)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      const msg =
        '🚫 *Kirish rad etildi!*\n\n' +
        'Siz EduFlow tizimida ro\'yxatdan o\'tmagan yoki bloklangansiз.\n\n' +
        'Iltimos, administrator bilan bog\'laning.';
      await ctx.reply(msg, { parse_mode: 'Markdown' });
      return; // Stop propagation
    }

    ctx.user = user;
    return next();
  } catch (err) {
    console.error('[AuthMiddleware]', err.message);
    await ctx.reply('⚠️ Ichki xatolik yuz berdi. Iltimos qayta urinib ko\'ring.');
  }
}

module.exports = { authMiddleware };
