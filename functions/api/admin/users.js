/**
 * /api/admin/users —— 用户管理（仅管理员）
 *
 * GET    ?q=&page=&pageSize=      列表
 * POST   { username, password, isAdmin }     新增
 * PATCH  { id, action, value }               改名 / 重置密码 / 禁用 / 启用 / 提降权
 * DELETE ?id=                                删除
 *
 * 自锁保护：不允许删除/禁用自己，不允许把自己降权，不允许删掉最后一个管理员。
 */
import { newId, hashPassword } from '../_lib/crypto.js';
import { readJson, ok, badRequest, notFound, fail } from '../_lib/http.js';
import { requireAdmin } from '../_lib/guard.js';
import { destroyAllSessions } from '../_lib/session.js';
import { writeAudit } from '../_lib/audit.js';
import { checkUsername, checkPassword } from '../_lib/validate.js';

const PUBLIC_COLS = 'id, username, is_admin, disabled, created_at, last_login_at';

export async function onRequestGet({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return g.error;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get('pageSize') ?? 20) || 20));
  const offset = (page - 1) * pageSize;

  const where = q ? 'WHERE username LIKE ?' : '';
  const args = q ? [`%${q}%`] : [];

  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users ${where}`)
    .bind(...args)
    .first();
  const { results } = await env.DB.prepare(
    `SELECT ${PUBLIC_COLS} FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...args, pageSize, offset)
    .all();

  return ok({ users: results ?? [], total: totalRow?.n ?? 0, page, pageSize });
}

export async function onRequestPost({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return g.error;

  const body = await readJson(request);
  if (body === null) return badRequest('BAD_JSON', '请求格式不正确');

  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  const isAdmin = body.isAdmin ? 1 : 0;

  for (const err of [checkUsername(username), checkPassword(password)]) {
    if (err) return badRequest('INVALID_INPUT', err);
  }

  const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (exists) return fail(409, 'USERNAME_TAKEN', '该用户名已被占用');

  const id = newId('usr');
  await env.DB.prepare(
    'INSERT INTO users (id, username, password_hash, is_admin, disabled, created_at) VALUES (?, ?, ?, ?, 0, ?)',
  )
    .bind(id, username, await hashPassword(password), isAdmin, Date.now())
    .run();

  await writeAudit(env, {
    adminId: g.user.id,
    action: 'user.create',
    targetType: 'user',
    targetId: id,
    detail: `username=${username} admin=${isAdmin ? 1 : 0}`,
  });

  return ok({ id });
}

export async function onRequestPatch({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return g.error;

  const body = await readJson(request);
  if (body === null) return badRequest('BAD_JSON', '请求格式不正确');

  const id = String(body.id ?? '');
  const action = String(body.action ?? '');
  const value = body.value;

  const target = await env.DB.prepare('SELECT id, username, is_admin, disabled FROM users WHERE id = ?')
    .bind(id)
    .first();
  if (!target) return notFound('用户不存在');

  const isSelf = target.id === g.user.id;

  switch (action) {
    case 'rename': {
      const username = String(value ?? '').trim();
      const err = checkUsername(username);
      if (err) return badRequest('INVALID_INPUT', err);
      const dup = await env.DB.prepare('SELECT id FROM users WHERE username = ? AND id <> ?')
        .bind(username, id)
        .first();
      if (dup) return fail(409, 'USERNAME_TAKEN', '该用户名已被占用');
      await env.DB.prepare('UPDATE users SET username = ? WHERE id = ?').bind(username, id).run();
      break;
    }

    case 'resetPassword': {
      const password = String(value ?? '');
      const err = checkPassword(password);
      if (err) return badRequest('INVALID_INPUT', err);
      await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .bind(await hashPassword(password), id)
        .run();
      // 改密后踢掉该用户所有设备的登录态
      await destroyAllSessions(env, id);
      break;
    }

    case 'setDisabled': {
      const disabled = value ? 1 : 0;
      if (isSelf && disabled) return badRequest('SELF_LOCK', '不能禁用自己的账号');
      await env.DB.prepare('UPDATE users SET disabled = ? WHERE id = ?').bind(disabled, id).run();
      if (disabled) await destroyAllSessions(env, id);
      break;
    }

    case 'setAdmin': {
      const isAdmin = value ? 1 : 0;
      if (isSelf && !isAdmin) return badRequest('SELF_LOCK', '不能取消自己的管理员权限');
      if (!isAdmin) {
        const admins = await env.DB.prepare(
          'SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND disabled = 0',
        ).first();
        if ((admins?.n ?? 0) <= 1) return badRequest('LAST_ADMIN', '至少要保留一名管理员');
      }
      await env.DB.prepare('UPDATE users SET is_admin = ? WHERE id = ?').bind(isAdmin, id).run();
      break;
    }

    default:
      return badRequest('UNKNOWN_ACTION', `不支持的操作：${action}`);
  }

  await writeAudit(env, {
    adminId: g.user.id,
    action: `user.${action}`,
    targetType: 'user',
    targetId: id,
    detail: action === 'resetPassword' ? '（密码已重置，未记录明文）' : `value=${JSON.stringify(value)}`,
  });

  return ok();
}

export async function onRequestDelete({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return g.error;

  const id = new URL(request.url).searchParams.get('id') ?? '';
  const target = await env.DB.prepare('SELECT id, username, is_admin FROM users WHERE id = ?')
    .bind(id)
    .first();
  if (!target) return notFound('用户不存在');

  if (target.id === g.user.id) return badRequest('SELF_LOCK', '不能删除自己的账号');

  if (target.is_admin) {
    const admins = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND disabled = 0',
    ).first();
    if ((admins?.n ?? 0) <= 1) return badRequest('LAST_ADMIN', '至少要保留一名管理员');
  }

  // 会话一并清掉；invite_uses / login_log 属于历史留痕，保留不删
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);

  await writeAudit(env, {
    adminId: g.user.id,
    action: 'user.delete',
    targetType: 'user',
    targetId: id,
    detail: `username=${target.username}`,
  });

  return ok();
}
