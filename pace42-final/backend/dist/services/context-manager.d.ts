export interface ContextMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export interface ConversationContext {
    summary?: string;
    recent_messages?: ContextMessage[];
    last_analysis_text?: string;
    analysis_by_intent?: Record<string, string>;
    last_intent?: string;
    last_agent?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
}
declare class ContextManager {
    private initialized;
    private ensureSchema;
    private ensureAnalysisPayloadColumn;
    private ensureLocationColumns;
    private ensureUserIdColumn;
    getOrCreateConversation(sessionId?: string): string;
    recordMessage(conversationId: string, role: ContextMessage['role'], content: string): void;
    updateLocation(conversationId: string, latitude: number, longitude: number): void;
    setUserId(conversationId: string, userId: string): void;
    recordAnalysis(conversationId: string, intentType: string, agent: string | undefined, analysisText: string, analysisPayload?: Record<string, any>): void;
    getRecentAnalysisForIntent(conversationId: string, intentType: string, maxAgeMinutes: number): {
        analysis_text: string;
        agent: string | null;
        created_at: string;
        analysis_payload?: any;
    } | undefined;
    getContext(conversationId: string, messageLimit?: number): ConversationContext;
    private getOrCreateSummary;
    private buildSummary;
    private truncate;
}
export declare const contextManager: ContextManager;
export {};
//# sourceMappingURL=context-manager.d.ts.map