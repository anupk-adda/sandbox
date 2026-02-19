import { databaseService } from './database/database-service.js';
import { logger } from '../utils/logger.js';
const PHASE_FOCUS = {
    base: 'Aerobic base + consistency',
    build: 'Aerobic efficiency + pacing control',
    peak: 'Race-specific endurance + sharpening',
    taper: 'Freshness + confidence',
};
class TrainingPlanService {
    initialized = false;
    ensureSchema() {
        if (this.initialized)
            return;
        const schemaSql = `
      CREATE TABLE IF NOT EXISTS training_plan_weeks (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        focus_summary TEXT,
        target_volume TEXT,
        target_intensity_mix TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES training_plans(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS training_plan_workouts (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        week_id TEXT NOT NULL,
        scheduled_date DATE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        structure_json TEXT NOT NULL,
        targets_json TEXT NOT NULL,
        rationale TEXT,
        coach_cues_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES training_plans(id) ON DELETE CASCADE,
        FOREIGN KEY (week_id) REFERENCES training_plan_weeks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS training_plan_executions (
        id TEXT PRIMARY KEY,
        workout_id TEXT NOT NULL,
        completion_status TEXT NOT NULL,
        actual_metrics_json TEXT,
        feedback_json TEXT,
        adherence_score INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workout_id) REFERENCES training_plan_workouts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS training_plan_adaptations (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        change_summary TEXT NOT NULL,
        reason TEXT,
        impacted_workouts_json TEXT,
        delta_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES training_plans(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_training_plan_weeks_plan
        ON training_plan_weeks(plan_id, week_start DESC);

      CREATE INDEX IF NOT EXISTS idx_training_plan_workouts_plan
        ON training_plan_workouts(plan_id, scheduled_date ASC);

      CREATE INDEX IF NOT EXISTS idx_training_plan_workouts_week
        ON training_plan_workouts(week_id, scheduled_date ASC);
    `;
        databaseService.exec(schemaSql);
        this.ensurePlanColumns();
        this.initialized = true;
    }
    ensurePlanColumns() {
        try {
            const columns = databaseService.all('PRAGMA table_info(training_plans)');
            const columnNames = new Set(columns.map(col => col.name));
            if (!columnNames.has('current_phase')) {
                databaseService.exec('ALTER TABLE training_plans ADD COLUMN current_phase TEXT');
            }
            if (!columnNames.has('weekly_focus')) {
                databaseService.exec('ALTER TABLE training_plans ADD COLUMN weekly_focus TEXT');
            }
            if (!columnNames.has('days_per_week')) {
                databaseService.exec('ALTER TABLE training_plans ADD COLUMN days_per_week INTEGER');
            }
        }
        catch (error) {
            logger.warn('Failed to ensure training_plans columns', { error });
        }
    }
    toISODate(date) {
        return date.toISOString().slice(0, 10);
    }
    getUserPreferences(userId) {
        const record = databaseService.get(`SELECT preferences FROM users WHERE id = ?`, [userId]);
        if (!record?.preferences)
            return {};
        try {
            return JSON.parse(record.preferences);
        }
        catch {
            return {};
        }
    }
    setUserPreferences(userId, preferences) {
        databaseService.run(`UPDATE users SET preferences = ? WHERE id = ?`, [JSON.stringify(preferences), userId]);
    }
    setSubscription(userId, active) {
        this.ensureSchema();
        this.ensureUserExists(userId);
        const prefs = this.getUserPreferences(userId);
        prefs.plan_subscription = active;
        this.setUserPreferences(userId, prefs);
    }
    isUserSubscribed(userId) {
        this.ensureSchema();
        this.ensureUserExists(userId);
        const prefs = this.getUserPreferences(userId);
        return Boolean(prefs.plan_subscription);
    }
    ensureUserExists(userId) {
        const user = databaseService.get(`SELECT id FROM users WHERE id = ?`, [userId]);
        if (!user) {
            const email = `${userId}@local`;
            databaseService.run(`INSERT INTO users (id, email) VALUES (?, ?)`, [userId, email]);
        }
    }
    addDays(date, days) {
        const copy = new Date(date.getTime());
        copy.setDate(copy.getDate() + days);
        return copy;
    }
    getWeekStart(date) {
        const copy = new Date(date.getTime());
        const day = copy.getDay();
        const diff = (day + 6) % 7; // Monday = 0
        copy.setDate(copy.getDate() - diff);
        copy.setHours(0, 0, 0, 0);
        return copy;
    }
    getPhase(weeksToGoal) {
        if (weeksToGoal <= 3)
            return 'taper';
        if (weeksToGoal <= 6)
            return 'peak';
        if (weeksToGoal <= 12)
            return 'build';
        return 'base';
    }
    buildWorkoutTemplates(phase) {
        const qualityTemplateByPhase = {
            base: {
                name: 'Steady aerobic 20 min',
                type: 'tempo',
                effort: 'RPE 5-6',
                structure: {
                    warmup: '10 min easy',
                    main: '20 min steady aerobic',
                    cooldown: '10 min easy',
                },
                targets: { duration_minutes: 40, rpe: '5-6', hr_zone: '2-3' },
                rationale: 'Build aerobic efficiency without overloading.',
                coachCues: ['Hold a smooth, conversational effort', 'Stay relaxed and tall'],
            },
            build: {
                name: 'Tempo 3 x 8 min',
                type: 'tempo',
                effort: 'RPE 6-7',
                structure: {
                    warmup: '10 min easy + 4 x 20s strides',
                    main: '3 x 8 min tempo, 2 min easy jog recoveries',
                    cooldown: '10 min easy',
                },
                targets: { duration_minutes: 50, rpe: '6-7', hr_zone: '3-4' },
                rationale: 'Improve lactate control and pacing discipline.',
                coachCues: ['Keep effort steady, no surging', 'Relax shoulders, quick steps'],
            },
            peak: {
                name: 'Intervals 6 x 3 min',
                type: 'interval',
                effort: 'RPE 7-8',
                structure: {
                    warmup: '12 min easy + drills',
                    main: '6 x 3 min hard, 2 min easy jog recoveries',
                    cooldown: '10 min easy',
                },
                targets: { duration_minutes: 55, rpe: '7-8', hr_zone: '4-5' },
                rationale: 'Sharpen race-specific speed safely.',
                coachCues: ['Strong but controlled reps', 'Recover fully between efforts'],
            },
            taper: {
                name: 'Tempo 2 x 6 min',
                type: 'tempo',
                effort: 'RPE 6-7',
                structure: {
                    warmup: '10 min easy + 4 x 20s strides',
                    main: '2 x 6 min tempo, 2 min easy jog recoveries',
                    cooldown: '10 min easy',
                },
                targets: { duration_minutes: 40, rpe: '6-7', hr_zone: '3-4' },
                rationale: 'Maintain sharpness while reducing load.',
                coachCues: ['Stop while feeling strong', 'Keep cadence light'],
            },
        };
        return {
            easy: {
                name: '40 min easy',
                type: 'easy',
                effort: 'RPE 3-4',
                structure: {
                    warmup: '5 min easy',
                    main: '30 min easy',
                    cooldown: '5 min easy',
                },
                targets: { duration_minutes: 40, rpe: '3-4', hr_zone: '2' },
                rationale: 'Build aerobic base and promote recovery.',
                coachCues: ['Keep breathing easy', 'Stay relaxed and smooth'],
            },
            recovery: {
                name: '30 min recovery',
                type: 'recovery',
                effort: 'RPE 2-3',
                structure: {
                    warmup: '5 min easy',
                    main: '20 min very easy',
                    cooldown: '5 min easy',
                },
                targets: { duration_minutes: 30, rpe: '2-3', hr_zone: '1-2' },
                rationale: 'Reduce fatigue and absorb training.',
                coachCues: ['If in doubt, slow down', 'Keep strides short and light'],
            },
            strides: {
                name: '35 min easy + strides',
                type: 'easy',
                effort: 'RPE 3-4',
                structure: {
                    warmup: '10 min easy',
                    main: '20 min easy + 4 x 20s strides',
                    cooldown: '5 min easy',
                },
                targets: { duration_minutes: 35, rpe: '3-4', hr_zone: '2' },
                rationale: 'Reinforce running form with low stress.',
                coachCues: ['Smooth accelerations', 'Full recovery between strides'],
            },
            easyShort: {
                name: '25 min easy',
                type: 'easy',
                effort: 'RPE 3-4',
                structure: {
                    warmup: '5 min easy',
                    main: '15 min easy',
                    cooldown: '5 min easy',
                },
                targets: { duration_minutes: 25, rpe: '3-4', hr_zone: '2' },
                rationale: 'Maintain consistency without adding load.',
                coachCues: ['Keep it short and smooth'],
            },
            long: {
                name: 'Long run 75 min',
                type: 'long',
                effort: 'RPE 4-5',
                structure: {
                    warmup: '10 min easy',
                    main: '55 min steady',
                    cooldown: '10 min easy',
                },
                targets: { duration_minutes: 75, rpe: '4-5', hr_zone: '2-3' },
                rationale: 'Build endurance and durability.',
                coachCues: ['Start easy, finish steady', 'Fuel and hydrate as needed'],
            },
            quality: qualityTemplateByPhase[phase] || qualityTemplateByPhase.build,
        };
    }
    buildWeekPlan(weekStart, phase, daysPerWeek) {
        const templates = this.buildWorkoutTemplates(phase);
        const weekId = databaseService.generateId();
        const weekStartIso = this.toISODate(weekStart);
        const weekEndIso = this.toISODate(this.addDays(weekStart, 6));
        const slots = [
            { dayIndex: 6, template: templates.long },
            { dayIndex: 1, template: templates.easy },
            { dayIndex: 3, template: templates.quality },
            { dayIndex: 2, template: templates.recovery },
            { dayIndex: 5, template: templates.strides },
            { dayIndex: 4, template: templates.easyShort },
        ];
        const selectedSlots = slots.slice(0, Math.max(1, Math.min(daysPerWeek, slots.length)));
        const workouts = selectedSlots.map(slot => {
            const workoutDate = this.toISODate(this.addDays(weekStart, slot.dayIndex));
            return {
                workoutId: databaseService.generateId(),
                scheduledDate: workoutDate,
                template: slot.template,
            };
        });
        return { weekId, weekStart: weekStartIso, weekEnd: weekEndIso, workouts };
    }
    createPlan(input) {
        this.ensureSchema();
        this.ensureUserExists(input.userId);
        const now = new Date();
        const goalDateObj = new Date(input.goalDate);
        if (Number.isNaN(goalDateObj.getTime())) {
            throw new Error('Invalid goal date');
        }
        const diffMs = goalDateObj.getTime() - now.getTime();
        const weeksToGoal = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
        const phase = this.getPhase(weeksToGoal);
        const weeklyFocus = PHASE_FOCUS[phase] || PHASE_FOCUS.build;
        const planId = databaseService.generateId();
        const startDate = this.toISODate(now);
        const endDate = this.toISODate(goalDateObj);
        const weekStart = this.getWeekStart(now);
        const weekPlan = this.buildWeekPlan(weekStart, phase, input.daysPerWeek);
        databaseService.transaction(() => {
            databaseService.run(`UPDATE training_plans SET status = 'inactive' WHERE user_id = ? AND status = 'active'`, [input.userId]);
            databaseService.run(`INSERT INTO training_plans (
          id, user_id, plan_type, goal_distance, goal_date, start_date, end_date,
          phases, weekly_structure, safety_constraints, status, version,
          current_phase, weekly_focus, days_per_week
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`, [
                planId,
                input.userId,
                'assistant-first',
                input.goalDistance,
                input.goalDate,
                startDate,
                endDate,
                JSON.stringify({ current_phase: phase, weeks_to_goal: weeksToGoal }),
                JSON.stringify({ weekly_focus: weeklyFocus, personalization_reason: 'Based on your current training profile.' }),
                JSON.stringify({ max_weekly_change_pct: 10, max_intensity_change: 1 }),
                'v1',
                phase,
                weeklyFocus,
                input.daysPerWeek,
            ]);
            databaseService.run(`INSERT INTO training_plan_weeks (id, plan_id, week_start, week_end, focus_summary)
         VALUES (?, ?, ?, ?, ?)`, [
                weekPlan.weekId,
                planId,
                weekPlan.weekStart,
                weekPlan.weekEnd,
                weeklyFocus,
            ]);
            for (const workout of weekPlan.workouts) {
                databaseService.run(`INSERT INTO training_plan_workouts (
            id, plan_id, week_id, scheduled_date, name, type, structure_json,
            targets_json, rationale, coach_cues_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    workout.workoutId,
                    planId,
                    weekPlan.weekId,
                    workout.scheduledDate,
                    workout.template.name,
                    workout.template.type,
                    JSON.stringify(workout.template.structure),
                    JSON.stringify(workout.template.targets),
                    workout.template.rationale,
                    JSON.stringify(workout.template.coachCues),
                ]);
            }
        });
        const summary = this.getPlanSummary(planId);
        const week = this.getWeekDetails(planId, weekPlan.weekStart);
        return { summary, week };
    }
    createPlanFromAgent(input) {
        this.ensureSchema();
        this.ensureUserExists(input.userId);
        const now = new Date();
        const goalDateObj = new Date(input.goalDate);
        if (Number.isNaN(goalDateObj.getTime())) {
            throw new Error('Invalid goal date');
        }
        const planId = databaseService.generateId();
        const startDate = this.toISODate(now);
        const endDate = this.toISODate(goalDateObj);
        databaseService.transaction(() => {
            databaseService.run(`UPDATE training_plans SET status = 'inactive' WHERE user_id = ? AND status = 'active'`, [input.userId]);
            databaseService.run(`INSERT INTO training_plans (
          id, user_id, plan_type, goal_distance, goal_date, start_date, end_date,
          phases, weekly_structure, safety_constraints, status, version,
          current_phase, weekly_focus, days_per_week
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`, [
                planId,
                input.userId,
                'assistant-first',
                input.goalDistance,
                input.goalDate,
                startDate,
                endDate,
                JSON.stringify({ current_phase: input.phase }),
                JSON.stringify({
                    weekly_focus: input.weeklyFocus,
                    personalization_reason: input.personalizationReason || 'Based on your recent training trends.',
                }),
                JSON.stringify({ max_weekly_change_pct: 10, max_intensity_change: 1 }),
                'v1',
                input.phase,
                input.weeklyFocus,
                input.daysPerWeek,
            ]);
            const weekId = databaseService.generateId();
            databaseService.run(`INSERT INTO training_plan_weeks (id, plan_id, week_start, week_end, focus_summary)
         VALUES (?, ?, ?, ?, ?)`, [
                weekId,
                planId,
                input.week.weekStart,
                input.week.weekEnd,
                input.weeklyFocus,
            ]);
            for (const day of input.week.days) {
                if (day.intensity === 'rest' || day.name.toLowerCase() === 'rest') {
                    continue;
                }
                const rpeValue = day.effort
                    ? String(day.effort).replace(/rpe\s*/i, '').trim()
                    : undefined;
                databaseService.run(`INSERT INTO training_plan_workouts (
            id, plan_id, week_id, scheduled_date, name, type, structure_json,
            targets_json, rationale, coach_cues_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    databaseService.generateId(),
                    planId,
                    weekId,
                    day.date,
                    day.name,
                    day.intensity,
                    JSON.stringify({}),
                    JSON.stringify(rpeValue ? { rpe: rpeValue } : {}),
                    day.why || null,
                    JSON.stringify([]),
                ]);
            }
        });
        const summary = this.getPlanSummary(planId);
        const week = this.getWeekDetails(planId, input.week.weekStart);
        return { summary, week };
    }
    getPlanSummary(planId) {
        this.ensureSchema();
        const plan = databaseService.get(`SELECT id, user_id, goal_distance, goal_date, current_phase, weekly_focus, weekly_structure
       FROM training_plans WHERE id = ?`, [planId]);
        if (!plan) {
            throw new Error('Plan not found');
        }
        const todayIso = this.toISODate(new Date());
        const workouts = databaseService.all(`SELECT scheduled_date, name, targets_json
       FROM training_plan_workouts
       WHERE plan_id = ? AND scheduled_date >= ?
       ORDER BY scheduled_date ASC
       LIMIT 3`, [planId, todayIso]);
        const nextWorkouts = workouts.map(workout => {
            let targets = {};
            try {
                targets = workout.targets_json ? JSON.parse(workout.targets_json) : {};
            }
            catch {
                targets = {};
            }
            return {
                date: workout.scheduled_date,
                name: workout.name,
                effort: targets.rpe ? `RPE ${targets.rpe}` : 'Easy',
            };
        });
        let personalizationReason;
        if (plan.weekly_structure) {
            try {
                const weeklyStructure = JSON.parse(plan.weekly_structure);
                personalizationReason = weeklyStructure?.personalization_reason;
            }
            catch {
                personalizationReason = undefined;
            }
        }
        return {
            planId: plan.id,
            goalDistance: plan.goal_distance,
            goalDate: plan.goal_date,
            phase: plan.current_phase || 'build',
            weeklyFocus: plan.weekly_focus || PHASE_FOCUS.build,
            personalizationReason,
            isSubscribed: this.isUserSubscribed(plan.user_id),
            nextWorkouts,
            actions: ['show_full_plan', 'edit_goal', 'reschedule'],
        };
    }
    getActivePlanForUser(userId) {
        this.ensureSchema();
        const record = databaseService.get(`SELECT id FROM training_plans
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`, [userId]);
        return record?.id || null;
    }
    getWeekDetails(planId, weekStart) {
        this.ensureSchema();
        const week = databaseService.get(`SELECT id, week_start, week_end
       FROM training_plan_weeks
       WHERE plan_id = ? AND week_start = ?`, [planId, weekStart]);
        if (!week) {
            throw new Error('Week not found');
        }
        const workouts = databaseService.all(`SELECT scheduled_date, name, type, rationale
       FROM training_plan_workouts
       WHERE week_id = ?
       ORDER BY scheduled_date ASC`, [week.id]);
        const workoutMap = new Map();
        workouts.forEach(workout => {
            workoutMap.set(workout.scheduled_date, {
                name: workout.name,
                type: workout.type,
                rationale: workout.rationale || undefined,
            });
        });
        const days = [];
        const startDate = new Date(week.week_start);
        for (let i = 0; i < 7; i += 1) {
            const date = this.toISODate(this.addDays(startDate, i));
            const workout = workoutMap.get(date);
            if (workout) {
                days.push({
                    date,
                    name: workout.name,
                    intensity: workout.type,
                    why: workout.rationale,
                });
            }
            else {
                days.push({
                    date,
                    name: 'Rest',
                    intensity: 'rest',
                    why: 'Absorb training load',
                });
            }
        }
        return {
            weekStart: week.week_start,
            weekEnd: week.week_end,
            days,
        };
    }
    getCurrentWeek(planId) {
        this.ensureSchema();
        const todayIso = this.toISODate(new Date());
        const week = databaseService.get(`SELECT week_start FROM training_plan_weeks
       WHERE plan_id = ? AND week_start <= ?
       ORDER BY week_start DESC
       LIMIT 1`, [planId, todayIso]);
        if (week?.week_start) {
            return this.getWeekDetails(planId, week.week_start);
        }
        const fallback = databaseService.get(`SELECT week_start FROM training_plan_weeks
       WHERE plan_id = ?
       ORDER BY week_start DESC
       LIMIT 1`, [planId]);
        if (!fallback?.week_start) {
            throw new Error('Week not found');
        }
        return this.getWeekDetails(planId, fallback.week_start);
    }
    getWorkoutDetail(workoutId) {
        this.ensureSchema();
        const workout = databaseService.get(`SELECT id, name, structure_json, targets_json, coach_cues_json
       FROM training_plan_workouts WHERE id = ?`, [workoutId]);
        if (!workout) {
            throw new Error('Workout not found');
        }
        const structure = workout.structure_json ? JSON.parse(workout.structure_json) : {};
        const targets = workout.targets_json ? JSON.parse(workout.targets_json) : {};
        const coachCues = workout.coach_cues_json ? JSON.parse(workout.coach_cues_json) : [];
        return {
            workoutId: workout.id,
            name: workout.name,
            target: {
                rpe: targets.rpe,
                hr_zone: targets.hr_zone,
                pace: targets.pace_range,
            },
            warmup: structure.warmup,
            main: structure.main,
            cooldown: structure.cooldown,
            coachCues,
        };
    }
    getPromptsForUser(userId) {
        this.ensureSchema();
        const activePlanId = this.getActivePlanForUser(userId);
        if (!activePlanId)
            return [];
        if (!this.isUserSubscribed(userId))
            return [];
        return [
            {
                id: 'track_training',
                label: 'Track my training',
                action: 'track_training',
                priority: 1,
            },
        ];
    }
}
export const trainingPlanService = new TrainingPlanService();
// Made with Bob
//# sourceMappingURL=training-plan-service.js.map