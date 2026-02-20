-- ============================================
-- Migration: Auth Improvements
-- Adds password reset and refresh token support
-- ============================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================
-- Password Reset Tokens Table
-- ============================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user 
    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token 
    ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires 
    ON password_reset_tokens(expires_at);

-- ============================================
-- User Sessions Table (for tracking active sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    refresh_token_hash TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user 
    ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token 
    ON user_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires 
    ON user_sessions(expires_at);

-- ============================================
-- Add password history tracking (optional security feature)
-- ============================================
CREATE TABLE IF NOT EXISTS password_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_history_user 
    ON password_history(user_id, created_at DESC);

-- ============================================
-- Add user preferences JSON column if not exists
-- ============================================
-- Note: preferences column already exists in users table from original schema

-- ============================================
-- Add remember_me preference tracking
-- ============================================
-- This will be stored in the preferences JSON column
-- Example: {"remember_me": true, "session_duration": "30d"}

-- ============================================
-- Migration metadata
-- ============================================
INSERT OR REPLACE INTO schema_version (version, description) 
VALUES ('1.1.0', 'Added password reset tokens, user sessions, and password history tables');
