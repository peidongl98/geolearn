#!/usr/bin/env node
/**
 * 建立 / 重置管理员账号。
 *
 * 用法：
 *   node scripts/create-admin.mjs <用户名> <密码>            # 线上 D1
 *   node scripts/create-admin.mjs <用户名> <密码> --local    # 本地 D1
 *
 * 说明：
 *   - 按约定管理员不由注册流程产生，必须用本脚本写入。
 *   - 同用户名重复执行 = 重置密码并恢复管理员身份（幂等，可用于找回）。
 *   - 密码哈希算法与 functions/api/_lib/crypto.js 完全一致（PBKDF2-SHA256 10000 次）。
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DB_NAME = 'geolearn-db';
const PBKDF2_ITERATIONS = 10_000;
const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5]{3,20}$/;

const WRANGLER =
  process.env.WRANGLER ||
  'C:/Users/l5353/.workbuddy/binaries/node/workspace/node_modules/wrangler/bin/wrangler.js';

/* ------------------------------------------------------------------ 工具 */

const enc = new TextEncoder();

function toB64(buf) {
  return Buffer.from(new Uint8Array(buf)).toString('base64');
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(bits)}`;
}

function randomHex(bytes) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const sqlQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

function runWrangler(args) {
  const result = spawnSync(process.execPath, [WRANGLER, ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\n✗ wrangler 执行失败（退出码 ${result.status}）`);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ 主流程 */

const [username, password] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const local = process.argv.includes('--local');
const scope = local ? '--local' : '--remote';

if (!username || !password) {
  console.error('用法：node scripts/create-admin.mjs <用户名> <密码> [--local]');
  process.exit(2);
}
if (!USERNAME_RE.test(username)) {
  console.error('✗ 用户名需为 3–20 位，只能用中英文、数字、下划线');
  process.exit(2);
}
if (password.length < 8) {
  console.error('✗ 密码至少 8 位');
  process.exit(2);
}

if (!local && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)) {
  console.error('✗ 缺少 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 环境变量');
  process.exit(2);
}

const id = `usr_${randomHex(9)}`;
const hash = await hashPassword(password);

const sql = `INSERT INTO users (id, username, password_hash, is_admin, disabled, created_at)
VALUES (${sqlQuote(id)}, ${sqlQuote(username)}, ${sqlQuote(hash)}, 1, 0, ${Date.now()})
ON CONFLICT(username) DO UPDATE SET
  password_hash = excluded.password_hash,
  is_admin      = 1,
  disabled      = 0;
`;

const dir = mkdtempSync(join(tmpdir(), 'geolearn-admin-'));
const file = join(dir, 'admin.sql');
writeFileSync(file, sql, 'utf8');

console.log(`→ 写入管理员 ${username}（${local ? '本地库' : '线上库'}）`);
runWrangler(['d1', 'execute', DB_NAME, scope, `--file=${file}`, '--yes']);
rmSync(dir, { recursive: true, force: true });

// 回读核验，避免「以为写成功」
console.log('\n→ 回读核验');
runWrangler([
  'd1',
  'execute',
  DB_NAME,
  scope,
  `--command=SELECT id, username, is_admin, disabled, created_at FROM users WHERE username = ${sqlQuote(username)}`,
  '--yes',
]);
