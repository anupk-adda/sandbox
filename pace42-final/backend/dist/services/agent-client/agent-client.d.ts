/**
 * Agent Service Client
 * Handles communication with the Python agent service
 */
export interface AgentAnalysis {
    agent: string;
    run_id?: string;
    analysis: string;
    raw_analysis?: string;
    has_splits?: boolean;
    has_hr_zones?: boolean;
    has_weather?: boolean;
    warning?: string;
    error?: string;
    charts?: any[];
    chart_data?: any[];
    weather?: any;
    run_samples?: any[];
    runSamples?: any[];
}
export interface AgentPlanResponse {
    summary: {
        goal_distance: string;
        goal_date: string;
        phase: string;
        weekly_focus: string;
        personalized_because?: string;
        next_workouts: Array<{
            date: string;
            name: string;
            effort?: string;
        }>;
    };
    week: {
        week_start: string;
        week_end: string;
        days: Array<{
            date: string;
            name: string;
            intensity: string;
            why?: string;
            effort?: string;
        }>;
    };
}
export interface AgentServiceConfig {
    baseUrl: string;
    timeout: number;
}
export declare class AgentClient {
    private baseUrl;
    private timeout;
    constructor(config?: Partial<AgentServiceConfig>);
    /**
     * Analyze the user's latest run
     */
    analyzeLastRun(): Promise<AgentAnalysis>;
    /**
     * Analyze the user's recent runs (last 3)
     */
    analyzeRecentRuns(): Promise<AgentAnalysis>;
    /**
     * Analyze the user's fitness trend (3 months)
     */
    analyzeFitnessTrend(numRuns?: number): Promise<AgentAnalysis>;
    /**
     * Ask the coach agent a general running question
     */
    askCoach(question: string): Promise<AgentAnalysis>;
    /**
     * Ask the coach Q&A agent with optional context
     */
    askCoachWithContext(question: string, context?: Record<string, any>, activityId?: string, options?: {
        force_answer?: boolean;
    }): Promise<AgentAnalysis>;
    /**
     * Get running conditions based on user location
     */
    getRunningConditions(latitude: number, longitude: number): Promise<AgentAnalysis>;
    /**
     * LLM-based intent classification
     */
    classifyIntent(message: string, context?: Record<string, any>): Promise<{
        type: string;
        confidence: number;
        requiresGarminData: boolean;
        rationale?: string;
    }>;
    /**
     * Generate an adaptive training plan using the agent service
     */
    generateTrainingPlan(payload: {
        goal_distance: string;
        target_date: string;
        days_per_week: number;
        runner_profile?: Record<string, any>;
        num_runs?: number;
    }): Promise<AgentPlanResponse>;
    /**
     * Health check for agent service
     */
    healthCheck(): Promise<boolean>;
    /**
     * Reset the Garmin MCP client singleton
     * Call this when a user disconnects their Garmin account
     */
    resetGarminClient(): Promise<{
        success: boolean;
        message?: string;
    }>;
}
export declare const agentClient: AgentClient;
//# sourceMappingURL=agent-client.d.ts.map