import { databaseService } from './database/database-service.js';
import { logger } from '../utils/logger.js';
import type { RunnerProfileContext } from './persona-agent.js';

export interface UserProfileRecord {
  user_id: string;
  profile_json: string;
  history_summary: string | null;
  updated_at: string;
}

class UserProfileManager {
  private initialized = false;

  private ensureSchema(): void {
    if (this.initialized) return;

    const schemaSql = `
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id TEXT PRIMARY KEY,
        profile_json TEXT NOT NULL,
        history_summary TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_profile_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        summary_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_user_profile_history_user
        ON user_profile_history(user_id, created_at DESC);
    `;

    databaseService.exec(schemaSql);
    this.initialized = true;
  }

  private getUserProfile(userId: string): UserProfileRecord | undefined {
    this.ensureSchema();
    return databaseService.get<UserProfileRecord>(
      `SELECT user_id, profile_json, history_summary, updated_at
       FROM user_profiles WHERE user_id = ?`,
      [userId]
    );
  }

  updateFromConversation(
    userId: string,
    conversationId: string,
    summaryText?: string,
    personaContext?: RunnerProfileContext
  ): void {
    this.ensureSchema();

    const existing = this.getUserProfile(userId);
    const profileJson = existing?.profile_json ? JSON.parse(existing.profile_json) : {};
    const mergedProfile = personaContext ? { ...profileJson, persona: personaContext } : profileJson;

    if (summaryText) {
      const existingHistory = databaseService.get<{ id: string }>(
        `SELECT id FROM user_profile_history
         WHERE user_id = ? AND conversation_id = ? AND summary_text = ?
         LIMIT 1`,
        [userId, conversationId, summaryText]
      );
      if (!existingHistory) {
        databaseService.run(
          `INSERT INTO user_profile_history (id, user_id, conversation_id, summary_text)
           VALUES (?, ?, ?, ?)`,
          [databaseService.generateId(), userId, conversationId, summaryText]
        );
      }
    }

    const historyRows = databaseService.all<{ summary_text: string }>(
      `SELECT summary_text FROM user_profile_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );
    const historySummary = historyRows.length
      ? historyRows.map(row => row.summary_text).reverse().join('\n---\n')
      : existing?.history_summary || null;

    databaseService.run(
      `INSERT INTO user_profiles (user_id, profile_json, history_summary)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         profile_json = excluded.profile_json,
         history_summary = excluded.history_summary,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(mergedProfile), historySummary]
    );
  }

  getUserProfileContext(userId: string): { history_summary?: string; profile?: any } | undefined {
    this.ensureSchema();
    const record = this.getUserProfile(userId);
    if (!record) return undefined;
    let profile: any = {};
    try {
      profile = record.profile_json ? JSON.parse(record.profile_json) : {};
    } catch (error) {
      logger.warn('Failed to parse user profile JSON', { error });
      profile = {};
    }
    return {
      history_summary: record.history_summary || undefined,
      profile,
    };
  }
}

export const userProfileManager = new UserProfileManager();

// Made with Bob
