/**
 * POST /api/login
 * body: { username, password }
 * 失败一律返回同一句话，不区分「用户不存在」和「密码错误」。
 */
import { verifyPassword } from './_lib/crypto.js';
import { withCookie, readJson, ok, badRequest, unauthorized } from './_lib/http.js';
import { createSession, sessionCookie } from './_lib/session.js';
import { writeLoginLog } from './_lib/audit.js';

const GENERIC_FAIL = '用户名或密码不正确';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (body === null) return badRequest('BAD_JSON', '请求格式不正确');

  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  if (!username || !password) return badRequest('INVALID_INPUT', '请填写用户名与密码');

  const user = await env.DB.prepare(
    'SELECT id, username, password_hash, is_admin, disabled FROM users WHERE username = ?',
  )
    .bind(username)
    .first();

  // 用户不存在也要走一次哈希，避免通过响应时间猜用户名
  const storedHash = user?.password_hash ?? 'pbkdf2$sha256$10000$AAAA$AAAA';
  const passwordOk = await verifyPassword(password, storedHash);

  if (!user || !passwordOk) {
    await writeLoginLog(env, { userId: user?.id ?? null, username, request, success: false });
    return unauthorized(GENERIC_FAIL);
  }

  if (user.disabled) {
    await writeLoginLog(env, { userId: user.id, username, request, success: false });
    return unauthorized('账号已被禁用，请联系管理员');
  }

  const now = Date.now();
  const { token } = await createSession(env, user.id);

  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(now, user.id).run();
  await writeLoginLog(env, { userId: user.id, username, request, success: true });

  return withCookie(
    ok({ user: { id: user.id, username: user.username, isAdmin: !!user.is_admin } }),
    sessionCookie(token),
  );
}

export async function onRequestGet() {
  return badRequest('METHOD_NOT_ALLOWED', '请使用 POST');
}
