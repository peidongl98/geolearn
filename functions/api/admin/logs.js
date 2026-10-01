/**
 * /api/admin/logs —— 日志查询（仅管理员）
 *
 * GET ?type=audit                            操作日志
 * GET ?type=login&userId=&q=&onlyFail=1      登录记录（userId 用于「查看某个用户的登录记录」）
 */
import { ok, badRequest } from '../_lib/http.js';
import { requireAdmin } from '../_lib/guard.js';

function paging(url, defaultSize = 20) {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(5, Number(url.searchParams.get('pageSize') ?? defaultSize) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export async function onRequestGet({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return g.error;

  const url = new URL(request.url);
  const type = url.searchParams.get('type') ?? 'audit';
  const { page, pageSize, offset } = paging(url);

  if (type === 'audit') {
    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log').first();
    const { results } = await env.DB.prepare(
      `SELECT a.id, a.admin_id, a.action, a.target_type, a.target_id, a.detail, a.created_at,
              COALESCE(u.username, a.admin_id) AS admin_name
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.admin_id
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?`,
    )
      .bind(pageSize, offset)
      .all();
    return ok({ type, logs: results ?? [], total: total?.n ?? 0, page, pageSize });
  }

  if (type === 'login') {
    const userId = url.searchParams.get('userId') ?? '';
    const q = (url.searchParams.get('q') ?? '').trim();
    const onlyFail = url.searchParams.get('onlyFail') === '1';

    const clauses = [];
    const args = [];
    if (userId) {
      clauses.push('user_id = ?');
      args.push(userId);
    }
    if (q) {
      clauses.push('username LIKE ?');
      args.push(`%${q}%`);
    }
    if (onlyFail) clauses.push('success = 0');
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM login_log ${where}`)
      .bind(...args)
      .first();
    const { results } = await env.DB.prepare(
      `SELECT id, user_id, username, ip, user_agent, success, created_at
         FROM login_log ${where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
    )
      .bind(...args, pageSize, offset)
      .all();
    return ok({ type, logs: results ?? [], total: total?.n ?? 0, page, pageSize });
  }

  if (type === 'invite-uses') {
    const code = url.searchParams.get('code') ?? '';
    if (!code) return badRequest('MISSING_CODE', '缺少 code');

    const { results } = await env.DB.prepare(
      `SELECT x.id, x.invite_code, x.user_id, x.used_at,
              COALESCE(u.username, '（账号已删除）') AS username
         FROM invite_uses x
         LEFT JOIN users u ON u.id = x.user_id
        WHERE x.invite_code = ?
        ORDER BY x.used_at DESC
        LIMIT 200`,
    )
      .bind(code)
      .all();
    return ok({ type, logs: results ?? [], total: results?.length ?? 0, page: 1, pageSize: 200 });
  }

  return badRequest('UNKNOWN_TYPE', `不支持的日志类型：${type}`);
}
