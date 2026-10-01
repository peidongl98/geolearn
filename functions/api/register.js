/**
 * POST /api/register
 * body: { username, password, inviteCode }
 * 流程：校验入参 → 校验邀请码可用 → 建号 → 邀请码计数 +1 → 用满自动失效 → 直接登录
 */
import { newId, hashPassword } from './_lib/crypto.js';
import { withCookie, readJson, ok, badRequest, fail, serverError } from './_lib/http.js';
import { createSession, sessionCookie } from './_lib/session.js';
import { writeAudit, writeLoginLog } from './_lib/audit.js';
import { checkUsername, checkPassword, checkInviteCode } from './_lib/validate.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (body === null) return badRequest('BAD_JSON', '请求格式不正确');

  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  const inviteCode = String(body.inviteCode ?? '').trim();

  for (const err of [checkUsername(username), checkPassword(password), checkInviteCode(inviteCode)]) {
    if (err) return badRequest('INVALID_INPUT', err);
  }

  const now = Date.now();

  /* ---- 1. 邀请码校验 ---- */
  const invite = await env.DB.prepare(
    'SELECT code, max_uses, used_count, expires_at, status FROM invites WHERE code = ?',
  )
    .bind(inviteCode)
    .first();

  if (!invite) return badRequest('INVITE_INVALID', '邀请码不存在');
  if (invite.status !== 'active') return badRequest('INVITE_EXPIRED', '邀请码已失效');
  if (invite.expires_at && invite.expires_at <= now) {
    return badRequest('INVITE_EXPIRED', '邀请码已过期');
  }
  if (invite.used_count >= invite.max_uses) {
    return badRequest('INVITE_EXHAUSTED', '邀请码已用尽');
  }

  /* ---- 2. 用户名占用检查 ---- */
  const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first();
  if (exists) return fail(409, 'USERNAME_TAKEN', '该用户名已被占用');

  /* ---- 3. 建号 + 邀请码计数（一个 batch，避免半途失败）---- */
  const userId = newId('usr');
  const passwordHash = await hashPassword(password);
  const exhausted = invite.used_count + 1 >= invite.max_uses;

  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO users (id, username, password_hash, is_admin, disabled, created_at) VALUES (?, ?, ?, 0, 0, ?)',
      ).bind(userId, username, passwordHash, now),
      env.DB.prepare(
        'INSERT INTO invite_uses (id, invite_code, user_id, used_at) VALUES (?, ?, ?, ?)',
      ).bind(newId('iu'), inviteCode, userId, now),
      env.DB.prepare(
        `UPDATE invites
            SET used_count = used_count + 1,
                status     = CASE WHEN used_count + 1 >= max_uses THEN 'expired' ELSE status END,
                expired_at = CASE WHEN used_count + 1 >= max_uses THEN ? ELSE expired_at END
          WHERE code = ?`,
      ).bind(now, inviteCode),
    ]);
  } catch (err) {
    // 并发下 UNIQUE(username) 冲突会落到这里
    return fail(409, 'REGISTER_FAILED', `注册失败：${err.message}`);
  }

  await writeAudit(env, {
    adminId: 'system',
    action: 'user.register',
    targetType: 'user',
    targetId: userId,
    detail: `邀请码 ${inviteCode}${exhausted ? '（用满已失效）' : ''}`,
  });

  /* ---- 4. 直接进入登录态 ---- */
  const { token } = await createSession(env, userId);
  await writeLoginLog(env, { userId, username, request, success: true });

  return withCookie(
    ok({ user: { id: userId, username, isAdmin: false } }),
    sessionCookie(token),
  );
}

export async function onRequestGet() {
  return badRequest('METHOD_NOT_ALLOWED', '请使用 POST');
}
