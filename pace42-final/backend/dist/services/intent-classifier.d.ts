/**
 * Intent Classifier
 * Determines user intent from natural language questions
 *
 * Routes to:
 * 1. Agent 1 (Current Run Analyzer) - "Analyze my last run"
 * 2. Agent 2 (Last Runs Comparator) - "Recommend my next run"
 * 3. Agent 3 (Fitness Trend Analyzer) - "Analyze my running progress"
 * 4. Coach Agent (General Questions) - All other running-related questions
 */
export interface Intent {
    type: 'last_run' | 'recent_runs' | 'fitness_trend' | 'weather' | 'training_plan' | 'general' | 'non_running' | 'profanity';
    confidence: number;
    requiresGarminData: boolean;
    keywords: string[];
}
export declare class IntentClassifier {
    private patterns;
    classify(message: string): Intent;
    classifyAsync(message: string, context?: Record<string, any>): Promise<Intent>;
    classifyWithRaw(message: string, context?: Record<string, any>): Promise<{
        intent: Intent;
        raw?: any;
    }>;
    private extractKeywords;
    getAgentEndpoint(intent: Intent): string;
}
export declare const intentClassifier: IntentClassifier;
//# sourceMappingURL=intent-classifier.d.ts.map