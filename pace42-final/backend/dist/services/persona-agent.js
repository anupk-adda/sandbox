import { databaseService } from './database/database-service.js';
import { logger } from '../utils/logger.js';
import { agentClient } from './agent-client/agent-client.js';
class PersonaAgent {
    initialized = false;
    ensureSchema() {
        if (this.initialized)
            return;
        const schemaSql = `
      CREATE TABLE IF NOT EXISTS persona_profiles (
        conversation_id TEXT PRIMARY KEY,
        profile_json TEXT NOT NULL,
        runner_history TEXT,
        runner_proficiency TEXT NOT NULL DEFAULT 'beginner',
        proficiency_score REAL NOT NULL DEFAULT 25,
        last_refreshed_at TIMESTAMP,
        proficiency_updated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_persona_profiles_updated
        ON persona_profiles(updated_at DESC);
    `;
        databaseService.exec(schemaSql);
        this.initialized = true;
    }
    getProfileRecord(conversationId) {
        this.ensureSchema();
        return databaseService.get(`SELECT conversation_id, profile_json, runner_history, runner_proficiency,
              proficiency_score, last_refreshed_at, proficiency_updated_at,
              created_at, updated_at
       FROM persona_profiles WHERE conversation_id = ?`, [conversationId]);
    }
    upsertProfileRecord(conversationId, data) {
        this.ensureSchema();
        const existing = this.getProfileRecord(conversationId);
        const profileJson = data.profile_json ?? existing?.profile_json ?? JSON.stringify({});
        const runnerHistory = data.runner_history ?? existing?.runner_history ?? null;
        const runnerProficiency = data.runner_proficiency ?? existing?.runner_proficiency ?? 'beginner';
        const proficiencyScore = data.proficiency_score ?? existing?.proficiency_score ?? 25;
        const lastRefreshedAt = data.last_refreshed_at ?? existing?.last_refreshed_at ?? null;
        const proficiencyUpdatedAt = data.proficiency_updated_at ?? existing?.proficiency_updated_at ?? null;
        databaseService.run(`INSERT INTO persona_profiles (
         conversation_id, profile_json, runner_history, runner_proficiency,
         proficiency_score, last_refreshed_at, proficiency_updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         profile_json = excluded.profile_json,
         runner_history = excluded.runner_history,
         runner_proficiency = excluded.runner_proficiency,
         proficiency_score = excluded.proficiency_score,
         last_refreshed_at = excluded.last_refreshed_at,
         proficiency_updated_at = excluded.proficiency_updated_at,
         updated_at = CURRENT_TIMESTAMP`, [
            conversationId,
            profileJson,
            runnerHistory,
            runnerProficiency,
            proficiencyScore,
            lastRefreshedAt,
            proficiencyUpdatedAt,
        ]);
    }
    scoreProficiencyFromQuestions(questions) {
        const normalized = questions.join(' ').toLowerCase();
        const tags = new Set();
        let score = 20;
        const advanced = [
            'vo2', 'threshold', 'lactate', 'tempo', 'interval', 'marathon', 'half marathon',
            'race pace', 'zone 2', 'zone 3', 'cadence', 'stride', 'training load', 'garmin',
            'periodization', 'taper', 'negative split', 'heart rate drift'
        ];
        const intermediate = [
            'pace', 'distance', 'long run', 'easy run', 'progress', 'plan', 'recovery',
            'form', 'injury', 'hydration'
        ];
        const beginner = [
            'start running', 'beginner', 'couch to 5k', '5k plan', 'first run',
            'how often should i run', 'shoes'
        ];
        for (const key of advanced) {
            if (normalized.includes(key)) {
                score += 8;
                tags.add(key);
            }
        }
        for (const key of intermediate) {
            if (normalized.includes(key)) {
                score += 4;
                tags.add(key);
            }
        }
        for (const key of beginner) {
            if (normalized.includes(key)) {
                score -= 4;
                tags.add(key);
            }
        }
        score = Math.max(5, Math.min(95, score));
        return { score, tags: Array.from(tags).slice(0, 8) };
    }
    labelForScore(score) {
        if (score >= 70)
            return 'advanced';
        if (score >= 40)
            return 'intermediate';
        return 'beginner';
    }
    deriveStatsFromCharts(charts) {
        const stats = {};
        if (!Array.isArray(charts))
            return stats;
        const numericAverage = (values) => {
            if (!values.length)
                return undefined;
            const sum = values.reduce((acc, val) => acc + val, 0);
            return sum / values.length;
        };
        for (const chart of charts) {
            if (!chart || !Array.isArray(chart.series))
                continue;
            for (const series of chart.series) {
                const raw = Array.isArray(series.rawData) ? series.rawData : [];
                const avg = numericAverage(raw.filter((v) => typeof v === 'number'));
                if (avg === undefined)
                    continue;
                const label = String(series.label || '').toLowerCase();
                const unit = String(series.unit || '').toLowerCase();
                if ((label.includes('pace') || unit.includes('min/km')) && stats.avg_pace_min_per_km === undefined) {
                    stats.avg_pace_min_per_km = avg;
                }
                if ((label.includes('heart') || label.includes('hr') || unit.includes('bpm')) && stats.avg_hr === undefined) {
                    stats.avg_hr = avg;
                }
                if ((label.includes('cadence') || unit.includes('spm')) && stats.avg_cadence === undefined) {
                    stats.avg_cadence = avg;
                }
                if ((label.includes('distance') || unit.includes('km')) && stats.avg_distance_km === undefined) {
                    stats.avg_distance_km = avg;
                }
            }
        }
        return stats;
    }
    updateRunnerProficiency(conversationId) {
        this.ensureSchema();
        const rows = databaseService.all(`SELECT content FROM conversation_messages
       WHERE conversation_id = ? AND role = 'user'
       ORDER BY created_at DESC LIMIT 120`, [conversationId]);
        if (!rows.length)
            return;
        const questions = rows.map(row => row.content);
        const { score, tags } = this.scoreProficiencyFromQuestions(questions);
        const proficiency = this.labelForScore(score);
        const profile = {
            updated_at: new Date().toISOString(),
            tags,
        };
        this.upsertProfileRecord(conversationId, {
            profile_json: JSON.stringify(profile),
            runner_proficiency: proficiency,
            proficiency_score: score,
            proficiency_updated_at: new Date().toISOString(),
        });
    }
    async refreshRunnerHistoryIfStale(conversationId) {
        this.ensureSchema();
        const existing = this.getProfileRecord(conversationId);
        const lastRefreshed = existing?.last_refreshed_at ? new Date(existing.last_refreshed_at).getTime() : 0;
        const ageDays = lastRefreshed ? (Date.now() - lastRefreshed) / (1000 * 60 * 60 * 24) : Infinity;
        if (ageDays < 15)
            return;
        try {
            const analysis = await agentClient.analyzeFitnessTrend(10);
            const historyPayload = {
                summary: analysis.raw_analysis || analysis.analysis || '',
                charts: analysis.charts || analysis.chart_data || [],
            };
            const stats = this.deriveStatsFromCharts(historyPayload.charts || []);
            const inferredScore = stats.avg_pace_min_per_km
                ? stats.avg_pace_min_per_km < 5.5
                    ? 75
                    : stats.avg_pace_min_per_km < 6.5
                        ? 55
                        : 35
                : undefined;
            const inferredProficiency = inferredScore ? this.labelForScore(inferredScore) : undefined;
            const existing = this.getProfileRecord(conversationId);
            const profileJson = existing?.profile_json ? JSON.parse(existing.profile_json) : {};
            const mergedProfile = {
                ...profileJson,
                stats,
            };
            this.upsertProfileRecord(conversationId, {
                runner_history: JSON.stringify(historyPayload),
                last_refreshed_at: new Date().toISOString(),
                profile_json: JSON.stringify(mergedProfile),
                runner_proficiency: inferredProficiency || existing?.runner_proficiency || 'beginner',
                proficiency_score: inferredScore || existing?.proficiency_score || 25,
            });
        }
        catch (error) {
            logger.warn('PersonaAgent: failed to refresh runner history', { error });
        }
    }
    getProfileContext(conversationId) {
        this.ensureSchema();
        const record = this.getProfileRecord(conversationId);
        if (!record)
            return undefined;
        let profileData = {};
        try {
            profileData = record.profile_json ? JSON.parse(record.profile_json) : {};
        }
        catch {
            profileData = {};
        }
        let runnerHistory;
        if (record.runner_history) {
            try {
                runnerHistory = JSON.parse(record.runner_history);
            }
            catch {
                runnerHistory = undefined;
            }
        }
        return {
            runner_profile: {
                proficiency: record.runner_proficiency,
                score: record.proficiency_score,
                tags: Array.isArray(profileData.tags) ? profileData.tags : [],
                stats: profileData.stats,
            },
            runner_history: runnerHistory
                ? {
                    summary: runnerHistory.summary || '',
                    updated_at: record.last_refreshed_at,
                    charts: runnerHistory.charts || [],
                }
                : undefined,
        };
    }
    getLatestProfileContext() {
        this.ensureSchema();
        const record = databaseService.get(`SELECT conversation_id, profile_json, runner_history, runner_proficiency,
              proficiency_score, last_refreshed_at, proficiency_updated_at,
              created_at, updated_at
       FROM persona_profiles
       ORDER BY updated_at DESC
       LIMIT 1`);
        if (!record)
            return undefined;
        return this.getProfileContext(record.conversation_id);
    }
}
export const personaAgent = new PersonaAgent();
// Made with Bob
//# sourceMappingURL=persona-agent.js.map