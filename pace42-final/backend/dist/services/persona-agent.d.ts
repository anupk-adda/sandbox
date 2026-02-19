export interface PersonaProfileRecord {
    conversation_id: string;
    profile_json: string;
    runner_history: string | null;
    runner_proficiency: string;
    proficiency_score: number;
    last_refreshed_at: string | null;
    proficiency_updated_at: string | null;
    created_at: string;
    updated_at: string;
}
export interface RunnerProfileContext {
    runner_profile: {
        proficiency: string;
        score: number;
        tags: string[];
        stats?: {
            avg_pace_min_per_km?: number;
            avg_hr?: number;
            avg_cadence?: number;
            avg_distance_km?: number;
        };
    };
    runner_history?: {
        summary: string;
        updated_at: string | null;
        charts?: any[];
    };
}
declare class PersonaAgent {
    private initialized;
    private ensureSchema;
    private getProfileRecord;
    private upsertProfileRecord;
    private scoreProficiencyFromQuestions;
    private labelForScore;
    private deriveStatsFromCharts;
    updateRunnerProficiency(conversationId: string): void;
    refreshRunnerHistoryIfStale(conversationId: string): Promise<void>;
    getProfileContext(conversationId: string): RunnerProfileContext | undefined;
    getLatestProfileContext(): RunnerProfileContext | undefined;
}
export declare const personaAgent: PersonaAgent;
export {};
//# sourceMappingURL=persona-agent.d.ts.map