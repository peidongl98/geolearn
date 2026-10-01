/**
 * 审计与登录日志。
 * 原则：写日志失败绝不允许影响主流程 —— 全部 try/catch 吞掉。
 */
import { newId } from './crypto.js';

export async function writeAudit(env, { adminId, action, targetType = null, targetId = null, detail = null }) {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_log (id, admin_id, action, target_type, target_id, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(newId('log'), adminId, action, targetType, targetId, detail, Date.now())
      .run();
  } catch {
    /* ignore */
  }
}

export async function writeLoginLog(env, { userId = null, username = null, request, success }) {
  try {
    await env.DB.prepare(
      `INSERT INTO login_log (id, user_id, username, ip, user_agent, success, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        newId('ll'),
        userId,
        username,
        request.headers.get('cf-connecting-ip') ?? '',
        (request.headers.get('user-agent') ?? '').slice(0, 300),
        success ? 1 : 0,
        Date.now(),
      )
      .run();
  } catch {
    /* ignore */
  }
}
