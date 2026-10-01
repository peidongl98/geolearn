/**
 * POST /api/admin/cleanup —— 惰性清理（仅管理员，手动触发）
 *
 * 1. 失效满 7 天的邀请码 → 物理删除（invite_uses 留痕不删）
 * 2. 已过期的会话 → 删除
 *
 * 不做定时任务：Cloudflare Pages 上没有方便的 cron，改成管理台按钮手动触发，
 * 每次进管理台可顺手点一下。
 */
import { ok } from '../_lib/http.js';
import { requireAdmin } from '../_lib/guard.js';
import { purgeExpiredSessions } from '../_lib/session.js';
import { writeAudit } from '../_lib/audit.js';

/** 失效后保留天数，到期才物理删除 */
export const INVITE_PURGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export async function onRequestPost({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return g.error;

  const cutoff = Date.now() - INVITE_PURGE_AFTER_MS;

  const invites = await env.DB.prepare(
    "DELETE FROM invites WHERE status = 'expired' AND expired_at IS NOT NULL AND expired_at <= ?",
  )
    .bind(cutoff)
    .run();

  const sessions = await purgeExpiredSessions(env);

  const result = {
    invitesDeleted: invites.meta?.changes ?? 0,
    sessionsDeleted: sessions,
    cutoff,
  };

  await writeAudit(env, {
    adminId: g.user.id,
    action: 'system.cleanup',
    targetType: 'system',
    targetId: null,
    detail: `invites=${result.invitesDeleted} sessions=${result.sessionsDeleted}`,
  });

  return ok(result);
}
