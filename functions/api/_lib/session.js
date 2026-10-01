/**
 * 会话 —— Cookie 只放随机 token；D1 里存的是 token 的 SHA-256，不是 token 本身。
 * 这样即使数据库被读走，也无法直接拿去冒充用户。
 */
import { randomHex, sha256Hex } from './crypto.js';
import { readCookie, serializeCookie } from './http.js';

export const COOKIE_NAME = 'gl_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
/** 剩余有效期低于这个值时自动续期（同设备免登录） */
const RENEW_WHEN_REMAINING_MS = 20 * 24 * 60 * 60 * 1000;

export function sessionCookie(token) {
  return serializeCookie(COOKIE_NAME, token, { maxAge: SESSION_TTL_MS / 1000 });
}

export function clearSessionCookie() {
  return serializeCookie(COOKIE_NAME, '', { maxAge: 0 });
}

/** 建会话，返回要发给浏览器的原始 token */
export async function createSession(env, userId) {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(tokenHash, userId, now, now + SESSION_TTL_MS)
    .run();
  return { token, expiresAt: now + SESSION_TTL_MS };
}

async function dropByHash(env, tokenHash) {
  try {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(tokenHash).run();
  } catch {
    /* 清理失败不影响主流程 */
  }
}

export async function destroySession(env, request) {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return;
  await dropByHash(env, await sha256Hex(token));
}

/** 用户主动改密码/被禁用时，踢掉他所有设备 */
export async function destroyAllSessions(env, userId) {
  try {
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  } catch {
    /* ignore */
  }
}

/**
 * 解析当前请求的登录态。
 * @returns {Promise<null | { user:{id,username,isAdmin}, token:string, renewed:boolean }>}
 */
export async function loadSession(env, request) {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.expires_at, u.id AS user_id, u.username, u.is_admin, u.disabled
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`,
  )
    .bind(tokenHash)
    .first();

  if (!row) return null;

  const now = Date.now();
  if (row.expires_at <= now) {
    await dropByHash(env, tokenHash);
    return null;
  }
  // 被禁用的账号：连已有会话一起作废
  if (row.disabled) {
    await dropByHash(env, tokenHash);
    return null;
  }

  let renewed = false;
  if (row.expires_at - now < RENEW_WHEN_REMAINING_MS) {
    await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?')
      .bind(now + SESSION_TTL_MS, tokenHash)
      .run();
    renewed = true;
  }

  return {
    user: {
      id: row.user_id,
      username: row.username,
      isAdmin: !!row.is_admin,
    },
    token,
    renewed,
  };
}

/** 顺手清理已过期的会话行（管理台 cleanup 用） */
export async function purgeExpiredSessions(env) {
  const res = await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?')
    .bind(Date.now())
    .run();
  return res.meta?.changes ?? 0;
}
