ALTER TABLE users ADD COLUMN role_updated_at TEXT;
ALTER TABLE users ADD COLUMN role_updated_by TEXT;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
