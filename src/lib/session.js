/**
 * 客户端登录态 —— 只负责「向服务端问」和「做前端兜底跳转」。
 *
 * 真正的门在 functions/_middleware.js：未登录根本拿不到受保护的 HTML。
 * 这里的跳转只是兜底（例如页面从浏览器前进/后退缓存里被翻出来时）。
 */
import { api } from './http.js';
import { LOGIN_PATH } from '../config/api.js';

let cached = null;
let inflight = null;

/** 查当前登录用户；未登录时服务端返回 user = null（不是错误） */
export async function fetchUser({ force = false } = {}) {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;

  inflight = api
    .session()
    .then((res) => {
      cached = res.user ?? null;
      return cached;
    })
    .catch(() => {
      // 网络异常时保守当作未登录，交给服务端守卫兜底
      cached = null;
      return null;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function currentUser() {
  return cached;
}

export async function login(username, password) {
  const res = await api.login(username, password);
  cached = res.user;
  return res.user;
}

export async function register(username, password, inviteCode) {
  const res = await api.register(username, password, inviteCode);
  cached = res.user;
  return res.user;
}

export async function logout() {
  try {
    await api.logout();
  } finally {
    cached = null;
  }
}

/** 当前完整地址（登录后跳回） */
export function currentPath() {
  return typeof location === 'undefined' ? '/' : location.pathname + location.search;
}

export function goToLogin(next = currentPath()) {
  if (typeof location === 'undefined') return;
  location.replace(`${LOGIN_PATH}?next=${encodeURIComponent(next)}`);
}

/** 前端兜底守卫：未登录就送去登录页，返回是否放行 */
export async function ensureLoggedIn() {
  const user = await fetchUser();
  if (!user) {
    goToLogin();
    return null;
  }
  return user;
}

/** 管理台兜底守卫：非管理员打回首页 */
export async function ensureAdmin() {
  const user = await ensureLoggedIn();
  if (!user) return null;
  if (!user.isAdmin) {
    if (typeof location !== 'undefined') location.replace('/?denied=admin');
    return null;
  }
  return user;
}
