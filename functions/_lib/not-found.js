/**
 * 404 页面 —— 由守卫中间件直接返回。
 *
 * 为什么不用 Astro 的 src/pages/404.astro：
 *   实测本项目（以及同一账号下其它 Pages 项目）在**存在 Functions 时**，
 *   未匹配任何静态资源的请求会被回落到根 index.html 并返回 200 ——
 *   这意味着未登录的人用 `/任意路径` 就能拿到首页 HTML，守卫等于被绕过。
 *   最省事且不依赖平台行为的解法：在中间件里自己判定「这个路径本来就不存在」，
 *   直接返回 404，不走回落。
 */
export function notFoundResponse(pathname = '') {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<title>页面不存在 · GeoLearn</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; min-height: 100svh; display: grid; place-content: center; gap: 12px;
    background: #0a0e14; color: #e8e8e8; text-align: center;
    font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  }
  h1 { margin: 0; font-size: 22px; font-weight: 600; }
  p { margin: 0; font-size: 14px; color: #8a8f98; }
  code { font-family: ui-monospace, Consolas, monospace; color: #5ba88c; word-break: break-all; }
  a { color: #7fc4a8; font-size: 14px; }
</style>
</head>
<body>
  <h1>页面不存在</h1>
  <p><code>${escapeHtml(pathname)}</code></p>
  <p><a href="/">回到首页</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
