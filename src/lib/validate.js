/**
 * 前端校验 —— 与 functions/api/_lib/validate.js 规则保持一致。
 * 这里只为「少发一次注定失败的请求」，服务端仍会独立校验一遍。
 */

export const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5]{3,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;

export function checkUsername(username) {
  if (!USERNAME_RE.test(String(username ?? ''))) {
    return '用户名需为 3–20 位，只能用中英文、数字、下划线';
  }
  return null;
}

export function checkPassword(password) {
  const s = String(password ?? '');
  if (s.length < PASSWORD_MIN) return `密码至少 ${PASSWORD_MIN} 位`;
  if (s.length > PASSWORD_MAX) return `密码最多 ${PASSWORD_MAX} 位`;
  return null;
}

export function checkInviteCode(code) {
  if (!/^[A-Za-z0-9_-]{4,32}$/.test(String(code ?? ''))) return '邀请码格式不正确';
  return null;
}

/** 按顺序跑一组校验器，返回第一个错误 */
export function firstError(...messages) {
  return messages.find((m) => m) ?? null;
}
