/**
 * 输入校验 —— 用户名/密码/邀请码的规则集中在这里。
 * 前端有同名规则副本（src/lib/validate.js），两边改要一起改。
 */

export const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5]{3,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;

/** @returns {string|null} 错误消息，null 表示通过 */
export function checkUsername(username) {
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return '用户名需为 3–20 位，只能用中英文、数字、下划线';
  }
  return null;
}

export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return `密码至少 ${PASSWORD_MIN} 位`;
  }
  if (password.length > PASSWORD_MAX) {
    return `密码最多 ${PASSWORD_MAX} 位`;
  }
  return null;
}

export function checkInviteCode(code) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{4,32}$/.test(code)) {
    return '邀请码格式不正确';
  }
  return null;
}
