/**
 * 守卫中间件 —— 全站唯一的一道门。
 *
 * 关键点 1：Pages Functions 的根 _middleware 运行在静态资源之前，
 *   所以它**能拦住静态 HTML**。Astro 因此可以保持纯静态输出，
 *   受保护的章节页在未登录时根本拿不到内容，而不是「先给页面再前端跳转」。
 *
 * 关键点 2（实测定过才敢这么写）：本项目在存在 Functions 时，
 *   未匹配任何静态资源的请求会被平台回落到根 index.html 并返回 **200**。
 *   如果只写「哪些路径要登录」，那么 `/随便一个路径` 就能拿到首页 HTML —— 守卫白做。
 *   所以这里改成**显式分类**：只放行 api / 静态资源 / 登录注册页，
 *   其余一律 404，绝不走回落。
 *
 * ⚠️ 这份路径表与前端 src/config/api.js 是一对，改一边记得改另一边。
 */
import { loadSession, sessionCookie } from './api/_lib/session.js';
import { withCookie } from './api/_lib/http.js';
import { notFoundResponse } from './_lib/not-found.js';

/** 需要登录的页面 */
const GUARDED_EXACT = new Set(['/', '/index.html']);
const GUARDED_PREFIXES = ['/chapter', '/admin'];
/** 需要管理员身份的页面 */
const ADMIN_PREFIXES = ['/admin'];

/** 无需登录的页面（含它们的显式入口） */
const PUBLIC_PAGES = new Set([
  '/login',
  '/login/',
  '/login/index.html',
  '/register',
  '/register/',
  '/register/index.html',
]);

/** 无需登录的静态文件后缀 —— 给以后往 public/ 里放图片字体留口子 */
const STATIC_EXT_RE =
  /\.(js|mjs|css|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|txt|xml|webmanifest|json)$/i;

const LOGIN_PATH = '/login';

/** 'api' | 'asset' | 'public' | 'guarded' | 'unknown' */
function classify(pathname) {
  if (pathname === '/api' || pathname.startsWith('/api/')) return 'api';
  if (pathname.startsWith('/_astro/')) return 'asset';
  if (GUARDED_EXACT.has(pathname)) return 'guarded';
  if (GUARDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return 'guarded';
  if (PUBLIC_PAGES.has(pathname)) return 'public';
  if (STATIC_EXT_RE.test(pathname)) return 'asset';
  return 'unknown';
}

function redirectTo(path) {
  return new Response(null, { status: 302, headers: { location: path } });
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const kind = classify(pathname);

  if (kind === 'api' || kind === 'public') return next();

  if (kind === 'asset') {
    const res = await next();
    // 平台会把「找不到的路径」回落成 index.html 并返回 200。
    // 请求的是 js/css/图片却拿回 HTML，说明这个资源其实不存在 → 改判 404，
    // 免得把一坨 HTML 当 JS/CSS 发给浏览器。
    const contentType = res.headers.get('content-type') ?? '';
    if (res.status === 200 && contentType.includes('text/html')) {
      return notFoundResponse(pathname);
    }
    return res;
  }

  if (kind === 'unknown') return notFoundResponse(pathname);

  /* ---- 以下都是受保护页面 ---- */
  const session = await loadSession(env, request);
  if (!session) {
    return redirectTo(`${LOGIN_PATH}?next=${encodeURIComponent(pathname + url.search)}`);
  }

  if (ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    if (!session.user.isAdmin) return redirectTo('/?denied=admin');
  }

  const response = await next();
  // 会话被续期时，顺手把 Cookie 的过期时间也往后推
  return session.renewed ? withCookie(response, sessionCookie(session.token)) : response;
}
