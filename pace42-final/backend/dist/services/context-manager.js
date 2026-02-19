import { databaseService } from './database/database-service.js';
import { logger } from '../utils/logger.js';
class ContextManager {
    initialized = false;
    ensureSchema() {
        if (this.initialized)
            return;
        const schemaSql = `
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_message_at TIMESTAMP,
        last_intent TEXT,
        last_agent TEXT,
        last_lat REAL,
        last_lon REAL
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
    `;
        databaseService.exec(schemaSql);
        this.ensureAnalysisPayloadColumn();
        this.ensureLocationColumns();
        this.ensureUserIdColumn();
        this.initialized = true;
    }
    ensureAnalysisPayloadColumn() {
        try {
            const columns = databaseService.all('PRAGMA table_info(analysis_cache)');
            const hasPayload = columns.some(col => col.name === 'analysis_payload');
            if (!hasPayload) {
                databaseService.exec('ALTER TABLE analysis_cache ADD COLUMN analysis_payload TEXT');
            }
        }
        catch (error) {
            logger.warn('Failed to ensure analysis_payload column', { error });
        }
    }
    ensureLocationColumns() {
        try {
            const columns = databaseService.all('PRAGMA table_info(conversations)');
            const hasLat = columns.some(col => col.name === 'last_lat');
            const hasLon = columns.some(col => col.name === 'last_lon');
            if (!hasLat) {
                databaseService.exec('ALTER TABLE conversations ADD COLUMN last_lat REAL');
            }
            if (!hasLon) {
                databaseService.exec('ALTER TABLE conversations ADD COLUMN last_lon REAL');
            }
        }
        catch (error) {
            logger.warn('Failed to ensure location columns', { error });
        }
    }
    ensureUserIdColumn() {
        try {
            const columns = databaseService.all('PRAGMA table_info(conversations)');
            const hasUserId = columns.some(col => col.name === 'user_id');
            if (!hasUserId) {
                databaseService.exec('ALTER TABLE conversations ADD COLUMN user_id TEXT');
            }
        }
        catch (error) {
            logger.warn('Failed to ensure user_id column', { error });
        }
    }
    getOrCreateConversation(sessionId) {
        this.ensureSchema();
        if (sessionId) {
            const existing = databaseService.get('SELECT id FROM conversations WHERE id = ?', [sessionId]);
            if (existing?.id) {
                databaseService.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId]);
                return sessionId;
            }
            databaseService.run('INSERT INTO conversations (id) VALUES (?)', [sessionId]);
            return sessionId;
        }
        const id = databaseService.generateId();
        databaseService.run('INSERT INTO conversations (id) VALUES (?)', [id]);
        return id;
    }
    recordMessage(conversationId, role, content) {
        this.ensureSchema();
        const id = databaseService.generateId();
        databaseService.run('INSERT INTO conversation_messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)', [id, conversationId, role, content]);
        databaseService.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP, last_message_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);
    }
    updateLocation(conversationId, latitude, longitude) {
        this.ensureSchema();
        databaseService.run('UPDATE conversations SET last_lat = ?, last_lon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [latitude, longitude, conversationId]);
    }
    setUserId(conversationId, userId) {
        this.ensureSchema();
        databaseService.run('UPDATE conversations SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId, conversationId]);
    }
    recordAnalysis(conversationId, intentType, agent, analysisText, analysisPayload) {
        this.ensureSchema();
        const id = databaseService.generateId();
        databaseService.run('INSERT INTO analysis_cache (id, conversation_id, intent_type, agent, analysis_text, analysis_payload) VALUES (?, ?, ?, ?, ?, ?)', [id, conversationId, intentType, agent || null, analysisText, analysisPayload ? JSON.stringify(analysisPayload) : null]);
        databaseService.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP, last_intent = ?, last_agent = ? WHERE id = ?', [intentType, agent || null, conversationId]);
    }
    getRecentAnalysisForIntent(conversationId, intentType, maxAgeMinutes) {
        this.ensureSchema();
        const row = databaseService.get(`SELECT analysis_text, agent, created_at
       , analysis_payload
       FROM analysis_cache
       WHERE conversation_id = ? AND intent_type = ?
       ORDER BY created_at DESC
       LIMIT 1`, [conversationId, intentType]);
        if (!row?.created_at)
            return undefined;
        const createdAt = new Date(row.created_at).getTime();
        if (Number.isNaN(createdAt))
            return undefined;
        const ageMinutes = (Date.now() - createdAt) / 60000;
        if (ageMinutes > maxAgeMinutes)
            return undefined;
        if (row?.analysis_payload) {
            try {
                return {
                    ...row,
                    analysis_payload: JSON.parse(row.analysis_payload)
                };
            }
            catch {
                return row;
            }
        }
        return row;
    }
    getContext(conversationId, messageLimit = 6) {
        this.ensureSchema();
        const messageCount = databaseService.get('SELECT COUNT(*) as count FROM conversation_messages WHERE conversation_id = ?', [conversationId])?.count || 0;
        const recentMessages = databaseService.all('SELECT role, content FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?', [conversationId, messageLimit]).reverse();
        const lastAnalysis = databaseService.get('SELECT analysis_text, intent_type, agent FROM analysis_cache WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1', [conversationId]);
        const locationRow = databaseService.get('SELECT last_lat, last_lon FROM conversations WHERE id = ?', [conversationId]);
        const analysisRows = databaseService.all('SELECT intent_type, analysis_text FROM analysis_cache WHERE conversation_id = ? ORDER BY created_at DESC', [conversationId]);
        const analysisByIntent = {};
        for (const row of analysisRows) {
            if (!analysisByIntent[row.intent_type]) {
                analysisByIntent[row.intent_type] = row.analysis_text;
            }
        }
        const summary = this.getOrCreateSummary(conversationId, messageCount, recentMessages, lastAnalysis?.analysis_text);
        return {
            summary,
            recent_messages: recentMessages,
            last_analysis_text: lastAnalysis?.analysis_text,
            analysis_by_intent: Object.keys(analysisByIntent).length ? analysisByIntent : undefined,
            last_intent: lastAnalysis?.intent_type,
            last_agent: lastAnalysis?.agent,
            location: locationRow && locationRow.last_lat && locationRow.last_lon
                ? { latitude: locationRow.last_lat, longitude: locationRow.last_lon }
                : undefined,
        };
    }
    getOrCreateSummary(conversationId, messageCount, recentMessages, lastAnalysisText) {
        if (messageCount <= recentMessages.length) {
            return undefined;
        }
        const existing = databaseService.get('SELECT summary_text, message_count FROM conversation_summaries WHERE conversation_id = ?', [conversationId]);
        if (existing && existing.message_count === messageCount) {
            return existing.summary_text;
        }
        const summary = this.buildSummary(messageCount, recentMessages, lastAnalysisText);
        databaseService.run(`INSERT INTO conversation_summaries (conversation_id, summary_text, message_count)
       VALUES (?, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         summary_text = excluded.summary_text,
         message_count = excluded.message_count,
         updated_at = CURRENT_TIMESTAMP`, [conversationId, summary, messageCount]);
        return summary;
    }
    buildSummary(messageCount, recentMessages, lastAnalysisText) {
        const parts = [];
        parts.push(`Session has ${messageCount} total messages.`);
        if (lastAnalysisText) {
            parts.push(`Last analysis: ${this.truncate(lastAnalysisText, 600)}`);
        }
        if (recentMessages.length) {
            parts.push('Recent exchange:');
            for (const msg of recentMessages.slice(-4)) {
                parts.push(`${msg.role}: ${this.truncate(msg.content, 180)}`);
            }
        }
        return parts.join('\n');
    }
    truncate(text, maxLength) {
        if (text.length <= maxLength)
            return text;
        return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
    }
}
export const contextManager = new ContextManager();
// Made with Bob
//# sourceMappingURL=context-manager.js.map