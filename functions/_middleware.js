/**
 * 守卫中间件 —— 全站唯一的一道门。
 *
 * 关键点：Pages Functions 的根 _middleware 运行在静态资源之前，
 * 所以它**能拦住静态 HTML**。这样 Astro 保持纯静态输出，
 * 受保护的章节页在未登录时根本拿不到内容，而不是「先给页面再前端跳转」。
 *
 * 需要登录的页面：/  ·  /chapter/**  ·  /admin/**
 * 公开：/login  /register  /api/**  以及所有静态资源
 *
 * ⚠️ 这份路径表与前端 src/config/api.js 的 GUARDED_PREFIXES 是一对，
 *    改一边记得改另一边。
 */
import { loadSession, sessionCookie } from './api/_lib/session.js';
import { withCookie } from './api/_lib/http.js';

const GUARDED_EXACT = new Set(['/', '/index.html']);
const GUARDED_PREFIXES = ['/chapter', '/admin'];
const LOGIN_PATH = '/login';

function needsGuard(pathname) {
  if (GUARDED_EXACT.has(pathname)) return true;
  // 目录式输出的显式入口，例如 /chapter/1/1-1/index.html
  if (pathname.endsWith('/index.html')) return true;
  return GUARDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function redirectToLogin(url, pathname) {
  const target = `${LOGIN_PATH}?next=${encodeURIComponent(pathname + url.search)}`;
  return new Response(null, { status: 302, headers: { location: target } });
}

function redirectTo(path) {
  return new Response(null, { status: 302, headers: { location: path } });
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!needsGuard(pathname)) return next();

  const session = await loadSession(env, request);

  if (!session) return redirectToLogin(url, pathname);

  // /admin 只对管理员开放
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!session.user.isAdmin) return redirectTo('/?denied=admin');
  }

  const response = await next();
  // 会话被续期时，顺手把 Cookie 的过期时间也往后推
  return session.renewed ? withCookie(response, sessionCookie(session.token)) : response;
}
