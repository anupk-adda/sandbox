import { databaseService } from './database/database-service.js';
import { DEFAULT_TIER, SUBSCRIPTION_TIERS, SubscriptionTier } from '../config/subscription-tiers.js';
import { logger } from '../utils/logger.js';

interface TierStatus {
  tier: SubscriptionTier;
  limits: {
    maxPlans: number;
    maxQueriesPerMonth: number;
  };
}

interface UsageStatus {
  monthKey: string;
  queryCount: number;
  remainingQueries: number;
}

class SubscriptionService {
  private initialized = false;

  private ensureSchema(): void {
    if (this.initialized) return;

    try {
      const columns = databaseService.all<{ name: string }>('PRAGMA table_info(users)');
      const columnNames = new Set(columns.map(col => col.name));

      if (!columnNames.has('subscription_tier')) {
        databaseService.exec("ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free'");
      }

      if (!columnNames.has('subscription_updated_at')) {
        databaseService.exec('ALTER TABLE users ADD COLUMN subscription_updated_at TIMESTAMP');
      }

      databaseService.exec(`
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
      `);

      this.initialized = true;
    } catch (error) {
      logger.warn('Failed to ensure subscription schema', { error });
    }
  }

  private getMonthKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private normalizeTier(rawTier?: string): SubscriptionTier {
    if (rawTier === 'premium') return 'premium';
    return DEFAULT_TIER;
  }

  getTierStatus(userId: string): TierStatus {
    this.ensureSchema();

    const row = databaseService.get<{ subscription_tier?: string }>(
      'SELECT subscription_tier FROM users WHERE id = ?',
      [userId]
    );

    const tier = this.normalizeTier(row?.subscription_tier);
    const config = SUBSCRIPTION_TIERS[tier];
    return {
      tier,
      limits: {
        maxPlans: config.maxPlans,
        maxQueriesPerMonth: config.maxQueriesPerMonth,
      },
    };
  }

  setUserTier(userId: string, tier: SubscriptionTier, paymentStatus = 'manual'): void {
    this.ensureSchema();

    databaseService.run(
      'UPDATE users SET subscription_tier = ?, subscription_updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [tier, userId]
    );

    const historyId = databaseService.generateId();
    databaseService.run(
      `INSERT INTO subscription_history (id, user_id, tier, start_date, payment_status)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)`
      , [historyId, userId, tier, paymentStatus]
    );
  }

  getUsageStatus(userId: string): UsageStatus {
    this.ensureSchema();
    const monthKey = this.getMonthKey();
    const row = databaseService.get<{ query_count: number }>(
      'SELECT query_count FROM subscription_usage WHERE user_id = ? AND month_key = ?',
      [userId, monthKey]
    );

    const tierStatus = this.getTierStatus(userId);
    const limit = tierStatus.limits.maxQueriesPerMonth;
    const current = row?.query_count ?? 0;

    return {
      monthKey,
      queryCount: current,
      remainingQueries: limit < 0 ? -1 : Math.max(0, limit - current),
    };
  }

  canCreatePlan(userId: string): { allowed: boolean; activePlans: number; limit: number; tier: SubscriptionTier } {
    this.ensureSchema();

    const tierStatus = this.getTierStatus(userId);
    const limit = tierStatus.limits.maxPlans;
    if (limit < 0) {
      return { allowed: true, activePlans: 0, limit, tier: tierStatus.tier };
    }

    const row = databaseService.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM training_plans WHERE user_id = ? AND status = 'active'",
      [userId]
    );
    const activePlans = row?.count ?? 0;
    return {
      allowed: activePlans < limit,
      activePlans,
      limit,
      tier: tierStatus.tier,
    };
  }

  checkAndConsumeQuery(userId: string): { allowed: boolean; remaining: number; limit: number; tier: SubscriptionTier } {
    this.ensureSchema();

    const tierStatus = this.getTierStatus(userId);
    const limit = tierStatus.limits.maxQueriesPerMonth;
    if (limit < 0) {
      return { allowed: true, remaining: -1, limit, tier: tierStatus.tier };
    }

    const monthKey = this.getMonthKey();

    return databaseService.transaction(() => {
      const row = databaseService.get<{ query_count: number }>(
        'SELECT query_count FROM subscription_usage WHERE user_id = ? AND month_key = ?',
        [userId, monthKey]
      );
      const current = row?.query_count ?? 0;

      if (current >= limit) {
        return { allowed: false, remaining: 0, limit, tier: tierStatus.tier };
      }

      const next = current + 1;
      if (row) {
        databaseService.run(
          'UPDATE subscription_usage SET query_count = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND month_key = ?',
          [next, userId, monthKey]
        );
      } else {
        databaseService.run(
          'INSERT INTO subscription_usage (user_id, month_key, query_count) VALUES (?, ?, ?)',
          [userId, monthKey, next]
        );
      }

      return {
        allowed: true,
        remaining: Math.max(0, limit - next),
        limit,
        tier: tierStatus.tier,
      };
    });
  }
}

export const subscriptionService = new SubscriptionService();
