/**
 * 加密原语 —— 只用 WebCrypto（Workers 原生，无第三方依赖）。
 *
 * 密码存储格式（自描述，便于日后提高强度而不破坏旧账号）：
 *   pbkdf2$sha256$<iterations>$<salt_b64>$<hash_b64>
 * verifyPassword 会从字符串里读 iterations，所以调高 ITERATIONS 不影响老用户登录。
 */

const enc = new TextEncoder();

/**
 * PBKDF2 迭代次数。
 * ⚠️ Workers Free 档单请求 CPU 上限 10ms，PBKDF2 是算 CPU 的。
 *    10000 次约数毫秒，是「安全性 vs 免费额度」的折中。
 *    升级到付费档后可改大（老账号仍能登录，见上面的自描述格式）。
 */
export const PBKDF2_ITERATIONS = 10_000;

function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 生成 n 字节随机数的 hex 串 */
export function randomHex(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 生成带前缀的业务 id，例如 usr_9f3a... */
export function newId(prefix) {
  return `${prefix}_${randomHex(9)}`;
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 常数时间字符串比较，避免计时侧信道 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(password, saltBytes, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    key,
    256,
  );
}

export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2(password, salt, iterations);
  return `pbkdf2$sha256$${iterations}$${toB64(salt)}$${toB64(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  let salt;
  try {
    salt = fromB64(parts[3]);
  } catch {
    return false;
  }
  const bits = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(toB64(bits), parts[4]);
}
