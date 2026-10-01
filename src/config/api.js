/**
 * 后端接口路径 —— 全站唯一来源。
 * 后端路由一旦调整（例如 /api/login → /api/auth/login），只改本文件，
 * 前端所有调用点自动跟随。
 */
export const API = {
  register: '/api/register',
  login: '/api/login',
  logout: '/api/logout',
  session: '/api/session',

  admin: {
    users: '/api/admin/users',
    invites: '/api/admin/invites',
    logs: '/api/admin/logs',
    cleanup: '/api/admin/cleanup',
  },
};

/** 需要登录才能访问的页面前缀（与 functions/_middleware.js 的守卫列表保持一致） */
export const GUARDED_PREFIXES = ['/chapter', '/admin'];

/** 未登录时的落地页 */
export const LOGIN_PATH = '/login';
