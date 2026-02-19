export type GoalDistance = '5k' | '10k' | 'half' | 'marathon';
export interface PlanSummary {
    planId: string;
    goalDistance: GoalDistance;
    goalDate: string;
    phase: string;
    weeklyFocus: string;
    personalizationReason?: string;
    isSubscribed?: boolean;
    nextWorkouts: Array<{
        date: string;
        name: string;
        effort: string;
    }>;
    actions: string[];
}
export interface WeeklyDetail {
    weekStart: string;
    weekEnd: string;
    days: Array<{
        date: string;
        name: string;
        intensity: string;
        why?: string;
        effort?: string;
    }>;
}
export interface WorkoutDetail {
    workoutId: string;
    name: string;
    target: {
        rpe?: string;
        hr_zone?: string;
        pace?: string;
    };
    warmup?: string;
    main?: string;
    cooldown?: string;
    coachCues: string[];
}
export interface AssistantPrompt {
    id: string;
    label: string;
    action: string;
    priority: number;
}
declare class TrainingPlanService {
    private initialized;
    private ensureSchema;
    private ensurePlanColumns;
    private toISODate;
    private getUserPreferences;
    private setUserPreferences;
    setSubscription(userId: string, active: boolean): void;
    isUserSubscribed(userId: string): boolean;
    private ensureUserExists;
    private addDays;
    private getWeekStart;
    private getPhase;
    private buildWorkoutTemplates;
    private buildWeekPlan;
    createPlan(input: {
        userId: string;
        goalDistance: GoalDistance;
        goalDate: string;
        daysPerWeek: number;
    }): {
        summary: PlanSummary;
        week: WeeklyDetail;
    };
    createPlanFromAgent(input: {
        userId: string;
        goalDistance: GoalDistance;
        goalDate: string;
        daysPerWeek: number;
        phase: string;
        weeklyFocus: string;
        personalizationReason?: string;
        week: WeeklyDetail;
    }): {
        summary: PlanSummary;
        week: WeeklyDetail;
    };
    getPlanSummary(planId: string): PlanSummary;
    getActivePlanForUser(userId: string): string | null;
    getWeekDetails(planId: string, weekStart: string): WeeklyDetail;
    getCurrentWeek(planId: string): WeeklyDetail;
    getWorkoutDetail(workoutId: string): WorkoutDetail;
    getPromptsForUser(userId: string): AssistantPrompt[];
}
export declare const trainingPlanService: TrainingPlanService;
export {};
//# sourceMappingURL=training-plan-service.d.ts.map