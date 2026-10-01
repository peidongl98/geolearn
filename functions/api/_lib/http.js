/**
 * HTTP 辅助 —— 统一响应格式与 Cookie 读写。
 *
 * 响应约定（前端 src/lib/http.js 按同一约定解析）：
 *   成功: { ok: true,  ...payload }
 *   失败: { ok: false, error: { code, message } }
 * 任何接口都不得直接 throw 给用户，必须返回上面的结构。
 */

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  // 鉴权接口一律不缓存
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function ok(payload = {}, init = {}) {
  return json({ ok: true, ...payload }, init);
}

export function fail(status, code, message) {
  return json({ ok: false, error: { code, message } }, { status });
}

/** 常用错误快捷方式 */
export const badRequest = (code, msg) => fail(400, code, msg);
export const unauthorized = (msg = '请先登录') => fail(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = '没有权限') => fail(403, 'FORBIDDEN', msg);
export const notFound = (msg = '资源不存在') => fail(404, 'NOT_FOUND', msg);
export const serverError = (msg = '服务器内部错误') => fail(500, 'INTERNAL', msg);

/** 安全地读 JSON body */
export async function readJson(request) {
  try {
    const text = await request.text();
    if (!text) return {};
    const data = JSON.parse(text);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return null; // null 代表 JSON 非法
  }
}

/* ------------------------------------------------------------------ Cookie */

/** 序列化一个 Set-Cookie 值 */
export function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${value}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  parts.push(`Path=${opts.path ?? '/'}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite ?? 'Lax'}`);
  return parts.join('; ');
}

/** 读某个 Cookie 的原始值 */
export function readCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

/** 把 Set-Cookie 追加到已有响应上（不覆盖原响应头） */
export function withCookie(response, cookieValue) {
  const headers = new Headers(response.headers);
  headers.append('set-cookie', cookieValue);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
