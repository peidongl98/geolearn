-- ============================================================================
-- GeoLearn D1 schema
-- 执行：npx wrangler d1 execute geolearn-db --remote --file=db/schema.sql
-- 本地：npx wrangler d1 execute geolearn-db --local  --file=db/schema.sql
--
-- 约定：
--   时间列一律 INTEGER（Unix 毫秒，Date.now()）
--   sessions.token 存的是**客户端 token 的 SHA-256**，不是 token 本身
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,          -- 格式 pbkdf2$sha256$<iter>$<salt>$<hash>
  is_admin INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  max_uses INTEGER NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,                   -- NULL = 永不过期
  status TEXT NOT NULL DEFAULT 'active', -- active | expired
  expired_at INTEGER,                   -- 失效时刻；满 7 天后物理删除
  created_at INTEGER NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS invite_uses (
  id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  used_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,               -- sha256(客户端 token)
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,               -- 'system' 表示系统自身动作
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  ip TEXT,
  user_agent TEXT,
  success INTEGER,
  created_at INTEGER NOT NULL
);

-- ---- 索引：按最常用的查询方向建 ----
CREATE INDEX IF NOT EXISTS idx_sessions_user      ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires   ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_invite_uses_code   ON invite_uses (invite_code);
CREATE INDEX IF NOT EXISTS idx_invite_uses_user   ON invite_uses (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created      ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_user         ON login_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_created      ON login_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_status     ON invites (status, expired_at);
