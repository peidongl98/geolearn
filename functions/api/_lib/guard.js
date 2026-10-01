/**
 * 鉴权守卫 —— 所有需要登录态的接口都用这里的两个函数，不要各写各的。
 */
import { forbidden, unauthorized } from './http.js';
import { loadSession } from './session.js';

/**
 * @returns {Promise<{error?:Response, user?, token?, renewed?}>}
 *   调用侧写法：const g = await requireAuth(env, request); if (g.error) return g.error;
 */
export async function requireAuth(env, request) {
  const s = await loadSession(env, request);
  if (!s) return { error: unauthorized() };
  return s;
}

export async function requireAdmin(env, request) {
  const s = await loadSession(env, request);
  if (!s) return { error: unauthorized() };
  if (!s.user.isAdmin) return { error: forbidden('需要管理员权限') };
  return s;
}
