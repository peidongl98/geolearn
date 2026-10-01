/**
 * POST /api/logout —— 注销当前设备的会话。
 */
import { withCookie, ok } from './_lib/http.js';
import { destroySession, clearSessionCookie } from './_lib/session.js';

export async function onRequestPost({ request, env }) {
  await destroySession(env, request);
  return withCookie(ok(), clearSessionCookie());
}
