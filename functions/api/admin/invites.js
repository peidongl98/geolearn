/**
 * /api/admin/invites —— 邀请码管理（仅管理员）
 *
 * GET    ?status=&page=&pageSize=     列表（带关联用户数）
 * POST   { maxUses, validDays }       生成
 * PATCH  { code, action, maxUses, validDays }   修改 / 手动失效
 * DELETE ?code=                       删除
 *
 * 邀请码字符集去掉了 0/O/1/I/L 这类易混字符。
 */
import { randomHex } from '../_lib/crypto.js';
import { readJson, ok, badRequest, notFound, fail } from '../_lib/http.js';
import { requireAdmin } from '../_lib/guard.js';
import { writeAudit } from '../_lib/audit.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

function generateCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** 把「有效天数」换算成绝对到期时间；0 / 空 表示永不过期 */
function expiryFromDays(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Date.now() + Math.round(n) * DAY_MS;
}

/** 按当前时间判定邀请码是否已到期；已到期的顺手写回 expired */
async function normalizeExpiry(env, rows) {
  const now = Date.now();
  const stale = rows.filter(
    (r) => r.status === 'active' && r.expires_at && r.expires_at <= now,
  );
  if (stale.length) {
    await env.DB.batch(
      stale.map((r) =>
        env.DB.prepare(
          "UPDATE invites SET status = 'expired', expired_at = ? WHERE code = ? AND status = 'active'",
        ).bind(now, r.code),
      ),
    );
    for (const r of stale) {
      r.status = 'expired';
      r.expired_at = now;
    }
  }
  return rows;
}

export async function onRequestGet({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return g.error;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get('pageSize') ?? 20) || 20));
  const offset = (page - 1) * pageSize;

  const where = status ? 'WHERE i.status = ?' : '';
  const args = status ? [status] : [];

  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM invites i ${where}`)
    .bind(...args)
    .first();

  const { results } = await env.DB.prepare(
    `SELECT i.code, i.max_uses, i.used_count, i.expires_at, i.status, i.expired_at,
            i.created_at, i.created_by, u.username AS created_by_name,
            (SELECT COUNT(*) FROM invite_uses x WHERE x.invite_code = i.code) AS use_records
       FROM invites i
       LEFT JOIN users u ON u.id = i.created_by
       ${where}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?`,
  )
    .bind(...args, pageSize, offset)
    .all();

  const rows = await normalizeExpiry(env, results ?? []);

  return ok({ invites: rows, total: totalRow?.n ?? 0, page, pageSize });
}

export async function onRequestPost({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return g.error;

  const body = await readJson(request);
  if (body === null) return badRequest('BAD_JSON', '请求格式不正确');

  const maxUses = Number(body.maxUses ?? 1);
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 9999) {
    return badRequest('INVALID_INPUT', '最大次数需为 1–9999 的整数');
  }

  const expiresAt = expiryFromDays(body.validDays);

  // 极低概率撞码，重试若干次
  let code = '';
  for (let i = 0; i < 6; i++) {
    const candidate = generateCode();
    const dup = await env.DB.prepare('SELECT code FROM invites WHERE code = ?')
      .bind(candidate)
      .first();
    if (!dup) {
      code = candidate;
      break;
    }
  }
  if (!code) return fail(500, 'CODE_GEN_FAILED', '邀请码生成失败，请重试');

  await env.DB.prepare(
    `INSERT INTO invites (code, max_uses, used_count, expires_at, status, created_at, created_by)
     VALUES (?, ?, 0, ?, 'active', ?, ?)`,
  )
    .bind(code, maxUses, expiresAt, Date.now(), g.user.id)
    .run();

  await writeAudit(env, {
    adminId: g.user.id,
    action: 'invite.create',
    targetType: 'invite',
    targetId: code,
    detail: `maxUses=${maxUses} expiresAt=${expiresAt ?? 'never'}`,
  });

  return ok({ code });
}

export async function onRequestPatch({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return g.error;

  const body = await readJson(request);
  if (body === null) return badRequest('BAD_JSON', '请求格式不正确');

  const code = String(body.code ?? '');
  const action = String(body.action ?? '');

  const invite = await env.DB.prepare(
    'SELECT code, max_uses, used_count, status FROM invites WHERE code = ?',
  )
    .bind(code)
    .first();
  if (!invite) return notFound('邀请码不存在');

  if (action === 'expire') {
    if (invite.status !== 'active') return badRequest('NOT_ACTIVE', '该邀请码已失效');
    await env.DB.prepare(
      "UPDATE invites SET status = 'expired', expired_at = ? WHERE code = ?",
    )
      .bind(Date.now(), code)
      .run();
    await writeAudit(env, {
      adminId: g.user.id,
      action: 'invite.expire',
      targetType: 'invite',
      targetId: code,
      detail: '手动失效',
    });
    return ok();
  }

  if (action === 'update') {
    const maxUses = Number(body.maxUses ?? invite.max_uses);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 9999) {
      return badRequest('INVALID_INPUT', '最大次数需为 1–9999 的整数');
    }
    if (maxUses < invite.used_count) {
      return badRequest('INVALID_INPUT', `最大次数不能小于已使用次数（${invite.used_count}）`);
    }

    // validDays 省略 = 不改到期时间；显式给 0 = 改成永不过期
    const expiresAt =
      body.validDays === undefined ? undefined : expiryFromDays(body.validDays);

    // 改小到刚好用满时，同步标记失效
    const willExhaust = maxUses <= invite.used_count;
    const now = Date.now();

    await env.DB.prepare(
      `UPDATE invites
          SET max_uses   = ?,
              expires_at = CASE WHEN ? THEN expires_at ELSE ? END,
              status     = CASE WHEN ? THEN 'expired' ELSE status END,
              expired_at = CASE WHEN ? THEN ? ELSE expired_at END
        WHERE code = ?`,
    )
      .bind(
        maxUses,
        expiresAt === undefined ? 1 : 0,
        expiresAt ?? null,
        willExhaust && invite.status === 'active' ? 1 : 0,
        willExhaust && invite.status === 'active' ? 1 : 0,
        now,
        code,
      )
      .run();

    await writeAudit(env, {
      adminId: g.user.id,
      action: 'invite.update',
      targetType: 'invite',
      targetId: code,
      detail: `maxUses=${maxUses}${expiresAt === undefined ? '' : ` expiresAt=${expiresAt ?? 'never'}`}`,
    });
    return ok();
  }

  return badRequest('UNKNOWN_ACTION', `不支持的操作：${action}`);
}

export async function onRequestDelete({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return g.error;

  const code = new URL(request.url).searchParams.get('code') ?? '';
  const invite = await env.DB.prepare('SELECT code FROM invites WHERE code = ?').bind(code).first();
  if (!invite) return notFound('邀请码不存在');

  // invite_uses 是注册留痕，保留；这里只删邀请码本身
  await env.DB.prepare('DELETE FROM invites WHERE code = ?').bind(code).run();

  await writeAudit(env, {
    adminId: g.user.id,
    action: 'invite.delete',
    targetType: 'invite',
    targetId: code,
    detail: '',
  });

  return ok();
}
