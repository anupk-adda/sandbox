-- ============================================
-- Migration: Subscription Tiering & Usage
-- Adds subscription tier column and usage/history tables
-- ============================================

PRAGMA foreign_keys = ON;

-- Add subscription tier column to users table if missing
-- SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so this may fail if already applied.
ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_updated_at TIMESTAMP;

-- Subscription history table
CREATE TABLE IF NOT EXISTS subscription_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tier TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    payment_status TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_user 
    ON subscription_history(user_id, start_date DESC);

-- Subscription usage table (monthly query counts)
CREATE TABLE IF NOT EXISTS subscription_usage (
    user_id TEXT NOT NULL,
    month_key TEXT NOT NULL,
    query_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, month_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_user 
    ON subscription_usage(user_id, month_key DESC);

INSERT OR REPLACE INTO schema_version (version, description) 
VALUES ('1.2.0', 'Added subscription tiering and usage tracking');
