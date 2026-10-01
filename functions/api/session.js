/**
 * GET /api/session —— 查当前登录态。前端守卫与页面初始化都靠它。
 *
 * 约定：**永远返回 200**。未登录时 user = null。
 * 这样浏览器不会因为一个 401 在控制台留下红色报错，前端也不必把
 * 「没登录」当成错误分支来处理。
 */
import { withCookie, ok } from './_lib/http.js';
import { loadSession, sessionCookie } from './_lib/session.js';

export async function onRequestGet({ request, env }) {
  const s = await loadSession(env, request);
  if (!s) return ok({ user: null });

  const res = ok({ user: s.user });
  // 续期后同步刷新 Cookie 的过期时间，否则「同设备免登录」会在 30 天硬到期
  return s.renewed ? withCookie(res, sessionCookie(s.token)) : res;
}
