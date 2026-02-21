-- ============================================
-- Running Coach App - Database Schema
-- SQLite Database Schema v1.0
-- ============================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    garmin_user_id TEXT UNIQUE,
    subscription_tier TEXT NOT NULL DEFAULT 'free',
    subscription_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    preferences TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_garmin_id ON users(garmin_user_id);

-- ============================================
-- Run Activities Table
-- ============================================
CREATE TABLE IF NOT EXISTS run_activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    garmin_activity_id TEXT UNIQUE NOT NULL,
    activity_date TIMESTAMP NOT NULL,
    distance_meters REAL,
    duration_seconds INTEGER,
    avg_pace_min_per_km REAL,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    avg_cadence INTEGER,
    avg_power REAL,
    elevation_gain_meters REAL,
    run_type TEXT,
    raw_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_run_activities_user_date 
    ON run_activities(user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_run_activities_garmin_id 
    ON run_activities(garmin_activity_id);
CREATE INDEX IF NOT EXISTS idx_run_activities_run_type 
    ON run_activities(run_type);

-- ============================================
-- Fitness Metric Snapshots Table
-- ============================================
CREATE TABLE IF NOT EXISTS fitness_metric_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    snapshot_date TIMESTAMP NOT NULL,
    vo2_max REAL,
    training_load REAL,
    recovery_time_hours INTEGER,
    fitness_age INTEGER,
    raw_metrics TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fitness_snapshots_user_date 
    ON fitness_metric_snapshots(user_id, snapshot_date DESC);

-- ============================================
-- Analysis Reports Table
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    report_type TEXT NOT NULL,
    activity_id TEXT,
    analysis_date TIMESTAMP NOT NULL,
    agent_outputs TEXT NOT NULL,
    coaching_narrative TEXT,
    key_insights TEXT,
    version TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (activity_id) REFERENCES run_activities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_user_date 
    ON analysis_reports(user_id, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_activity 
    ON analysis_reports(activity_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_type 
    ON analysis_reports(report_type);

-- ============================================
-- Training Plans Table
-- ============================================
CREATE TABLE IF NOT EXISTS training_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_type TEXT NOT NULL,
    goal_distance TEXT NOT NULL,
    goal_date DATE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    phases TEXT NOT NULL,
    weekly_structure TEXT NOT NULL,
    safety_constraints TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    version TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_training_plans_user_status 
    ON training_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_training_plans_goal_date 
    ON training_plans(goal_date);

-- ============================================
-- Subscription Tables
-- ============================================
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

-- ============================================
-- Agent Execution Logs Table (Observability)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_execution_logs (
    id TEXT PRIMARY KEY,
    report_id TEXT,
    agent_name TEXT NOT NULL,
    execution_start TIMESTAMP NOT NULL,
    execution_end TIMESTAMP,
    status TEXT NOT NULL,
    input_data TEXT,
    output_data TEXT,
    error_message TEXT,
    prompt_version TEXT,
    model_version TEXT,
    token_usage TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES analysis_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_report 
    ON agent_execution_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_name 
    ON agent_execution_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_logs_status 
    ON agent_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_agent_logs_execution_start 
    ON agent_execution_logs(execution_start DESC);

-- ============================================
-- Conversation Memory Tables
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP,
    last_intent TEXT,
    last_agent TEXT
);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
    ON conversation_messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversation_summaries (
    conversation_id TEXT PRIMARY KEY,
    summary_text TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_cache (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    intent_type TEXT NOT NULL,
    agent TEXT,
    analysis_text TEXT NOT NULL,
    analysis_payload TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_conversation
    ON analysis_cache(conversation_id, created_at DESC);

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_training_plans_timestamp 
    AFTER UPDATE ON training_plans
    FOR EACH ROW
    BEGIN
        UPDATE training_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- ============================================
-- Database Metadata
-- ============================================
CREATE TABLE IF NOT EXISTS schema_version (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT OR IGNORE INTO schema_version (version, description) 
VALUES ('1.0.0', 'Initial schema with users, activities, fitness metrics, analysis reports, training plans, and agent logs');

INSERT OR IGNORE INTO schema_version (version, description)
VALUES ('1.2.0', 'Added subscription tiering and usage tracking tables');

-- ============================================
-- Views for Common Queries
-- ============================================

-- Recent activities with user info
CREATE VIEW IF NOT EXISTS v_recent_activities AS
SELECT 
    ra.*,
    u.email as user_email
FROM run_activities ra
JOIN users u ON ra.user_id = u.id
ORDER BY ra.activity_date DESC;

-- Active training plans with user info
CREATE VIEW IF NOT EXISTS v_active_training_plans AS
SELECT 
    tp.*,
    u.email as user_email
FROM training_plans tp
JOIN users u ON tp.user_id = u.id
WHERE tp.status = 'active'
ORDER BY tp.goal_date ASC;

-- Latest fitness metrics per user
CREATE VIEW IF NOT EXISTS v_latest_fitness_metrics AS
SELECT 
    fms.*,
    u.email as user_email
FROM fitness_metric_snapshots fms
JOIN users u ON fms.user_id = u.id
WHERE fms.snapshot_date = (
    SELECT MAX(snapshot_date) 
    FROM fitness_metric_snapshots 
    WHERE user_id = fms.user_id
);

-- ============================================
-- End of Schema
-- ============================================

-- Made with Bob
