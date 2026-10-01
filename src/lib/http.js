/**
 * 前端唯一的网络出口 —— 所有接口调用都经过这里。
 * 路径来自 src/config/api.js，改后端路由不需要动任何组件。
 */
import { API } from '../config/api.js';

export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request(url, { method = 'GET', body, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new ApiError('NETWORK', err.name === 'AbortError' ? '请求超时，请重试' : '网络异常，请检查连接');
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 非 JSON 响应，下面统一报错 */
  }

  if (!res.ok || !data || data.ok !== true) {
    throw new ApiError(
      data?.error?.code ?? `HTTP_${res.status}`,
      data?.error?.message ?? '请求失败，请稍后重试',
      res.status,
    );
  }
  return data;
}

const qs = (params) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

/** 业务接口集合 —— 组件只调这里的方法 */
export const api = {
  /* ---------------- 守卫 ---------------- */
  session: () => request(API.session),
  login: (username, password) => request(API.login, { method: 'POST', body: { username, password } }),
  register: (username, password, inviteCode) =>
    request(API.register, { method: 'POST', body: { username, password, inviteCode } }),
  logout: () => request(API.logout, { method: 'POST' }),

  /* ---------------- 管理台 ---------------- */
  admin: {
    listUsers: (params) => request(API.admin.users + qs(params)),
    createUser: (payload) => request(API.admin.users, { method: 'POST', body: payload }),
    updateUser: (payload) => request(API.admin.users, { method: 'PATCH', body: payload }),
    deleteUser: (id) => request(`${API.admin.users}${qs({ id })}`, { method: 'DELETE' }),

    listInvites: (params) => request(API.admin.invites + qs(params)),
    createInvite: (payload) => request(API.admin.invites, { method: 'POST', body: payload }),
    updateInvite: (payload) => request(API.admin.invites, { method: 'PATCH', body: payload }),
    deleteInvite: (code) => request(`${API.admin.invites}${qs({ code })}`, { method: 'DELETE' }),

    listLogs: (params) => request(API.admin.logs + qs(params)),
    cleanup: () => request(API.admin.cleanup, { method: 'POST' }),
  },
};
