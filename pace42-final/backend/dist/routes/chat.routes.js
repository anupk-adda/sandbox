/**
 * Chat Routes
 * Handles user chat messages and routes to appropriate agents
 */
import { Router } from 'express';
import { intentClassifier } from '../services/intent-classifier.js';
import { agentClient } from '../services/agent-client/agent-client.js';
import { contextManager } from '../services/context-manager.js';
import { personaAgent } from '../services/persona-agent.js';
import { userProfileManager } from '../services/user-profile-manager.js';
import { trainingPlanService } from '../services/training-plan-service.js';
import { logger } from '../utils/logger.js';
const router = Router();
const DEFAULT_USER_ID = 'anup';
const MAX_TREND_RUNS = 8;
logger.info('Chat routes module loaded');
const isPersonalizedQuery = (message) => {
    const normalized = message.toLowerCase();
    const personalizedSignals = [
        'my ',
        'mine',
        'i ',
        'me ',
        'last run',
        'next run',
        'my run',
        'my workout',
        'my training',
        'my pace',
        'my heart',
        'my cadence',
        'my splits',
        'my vo2',
        'my garmin',
    ];
    return personalizedSignals.some(signal => normalized.includes(signal));
};
const typoNormalizationMap = [
    [/\bfartlake\b/gi, 'fartlek'],
    [/\btemp\s+run\b/gi, 'tempo run'],
];
const normalizeTypos = (message) => {
    let normalized = message;
    for (const [pattern, replacement] of typoNormalizationMap) {
        normalized = normalized.replace(pattern, replacement);
    }
    return normalized;
};
const isLikelyFollowUpRunning = (message, context) => {
    const normalized = message.toLowerCase().trim();
    if (!normalized)
        return false;
    const hasContext = Boolean(context.last_intent ||
        context.last_analysis_text ||
        context.summary ||
        (context.recent_messages && context.recent_messages.length));
    if (!hasContext)
        return false;
    if (normalized.length <= 4)
        return true;
    const followupStarters = ['yes', 'y', 'no', 'nah', 'ok', 'okay', 'so', 'what about', 'how about'];
    if (followupStarters.some(token => normalized.startsWith(token)))
        return true;
    const runningTerms = ['tempo', 'temp', 'fartlek', 'fartlake', 'interval', 'easy pace', 'long run', 'threshold'];
    if (runningTerms.some(term => normalized.includes(term)))
        return true;
    return false;
};
const hasRunningSignals = (text) => {
    const normalized = text.toLowerCase();
    const signals = [
        'pace', 'heart rate', 'hr', 'easy', 'tempo', 'interval', 'threshold',
        'plan', 'training', 'injury', 'run', 'workout', 'cadence', 'vo2', 'race'
    ];
    return signals.some(signal => normalized.includes(signal));
};
const isCoachableQuestion = (message) => {
    const normalized = message.toLowerCase();
    const patterns = [
        /easy pace/,
        /tempo pace/,
        /threshold pace/,
        /expected time/,
        /\b(5k|10k|half|half marathon|marathon)\b/,
        /training load/,
        /recommend my next run/,
        /next run/,
    ];
    return patterns.some(pattern => pattern.test(normalized));
};
const planDrafts = new Map();
const unsubscribeConfirmations = new Map();
const planDistanceAliases = [
    [/\b5k\b|\b5 km\b|\b5km\b/i, '5k'],
    [/\b10k\b|\b10 km\b|\b10km\b/i, '10k'],
    [/\bhalf\b|\bhalf marathon\b/i, 'half'],
    [/\bmarathon\b/i, 'marathon'],
];
const monthMap = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
};
const extractGoalDistance = (message) => {
    for (const [pattern, distance] of planDistanceAliases) {
        if (pattern.test(message)) {
            return distance;
        }
    }
    return undefined;
};
const extractDaysPerWeek = (message) => {
    const match = message.match(/\b(\d)\s*(days|day|x)?\s*(per|a)?\s*(week|wk)\b/i);
    if (match) {
        const value = Number(match[1]);
        if (Number.isFinite(value) && value > 0)
            return value;
    }
    return undefined;
};
const extractGoalDate = (message) => {
    const isoMatch = message.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (isoMatch) {
        return isoMatch[0];
    }
    const dayFirstMatch = message.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]{3,9})\s+(20\d{2})\b/);
    if (dayFirstMatch) {
        const day = Number(dayFirstMatch[1]);
        const monthKey = dayFirstMatch[2].toLowerCase();
        const year = Number(dayFirstMatch[3]);
        const month = monthMap[monthKey];
        if (month !== undefined && day > 0 && day <= 31) {
            const date = new Date(year, month, day);
            if (!Number.isNaN(date.getTime())) {
                return date.toISOString().slice(0, 10);
            }
        }
    }
    const monthMatch = message.match(/\b([a-zA-Z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/);
    if (monthMatch) {
        const monthKey = monthMatch[1].toLowerCase();
        const month = monthMap[monthKey];
        const day = Number(monthMatch[2]);
        const year = Number(monthMatch[3]);
        if (month !== undefined && day > 0 && day <= 31) {
            const date = new Date(year, month, day);
            if (!Number.isNaN(date.getTime())) {
                return date.toISOString().slice(0, 10);
            }
        }
    }
    const midMonthMatch = message.match(/\bmid\s+([a-zA-Z]{3,9})\b/);
    if (midMonthMatch) {
        const monthKey = midMonthMatch[1].toLowerCase();
        const month = monthMap[monthKey];
        const yearMatch = message.match(/\b(20\d{2})\b/);
        const thisYear = /\bthis year\b/i.test(message);
        const year = yearMatch ? Number(yearMatch[1]) : thisYear ? new Date().getFullYear() : undefined;
        if (month !== undefined && year) {
            const date = new Date(year, month, 15);
            if (!Number.isNaN(date.getTime())) {
                return date.toISOString().slice(0, 10);
            }
        }
    }
    return undefined;
};
const isPlanRequest = (message) => /\b(training plan|plan)\b/i.test(message);
const monthSignal = /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/i;
const hasPlanFollowupSignals = (message, extracted) => {
    if (extracted.goalDistance || extracted.goalDate || extracted.daysPerWeek)
        return true;
    if (isPlanRequest(message))
        return true;
    if (/\b(race|goal|training|days per week|day per week|week)\b/i.test(message))
        return true;
    if (monthSignal.test(message))
        return true;
    if (/^\s*\d+\s*(days?|x)?\s*(per\s*)?(week|wk)?\b/i.test(message))
        return true;
    return false;
};
const isPlanCreationSignal = (message, draft) => {
    if (isShowFullPlan(message)
        || isTrackTraining(message)
        || isSubscribePlan(message)
        || isUnsubscribePlan(message)
        || isConfirmUnsubscribe(message)
        || isCancelUnsubscribe(message)
        || isEditGoal(message)
        || isReschedulePlan(message)) {
        return false;
    }
    if (draft.goalDistance || draft.goalDate || draft.daysPerWeek)
        return true;
    return /\b(make|create|build|start|generate)\b.*\bplan\b/i.test(message);
};
const isShowFullPlan = (message) => /\b(show|see|view)\b.*\b(full plan|weekly plan|week plan)\b/i.test(message);
const isTrackTraining = (message) => /\btrack my training\b/i.test(message);
const isEditGoal = (message) => /\bedit goal\b/i.test(message);
const isReschedulePlan = (message) => /\breschedule\b/i.test(message);
const isSubscribePlan = (message) => /\bsubscribe\b/i.test(message);
const isUnsubscribePlan = (message) => /\bunsubscribe\b/i.test(message);
const isConfirmUnsubscribe = (message) => /\bconfirm unsubscribe\b/i.test(message) || /\byes\s*,?\s*unsubscribe\b/i.test(message);
const isCancelUnsubscribe = (message) => /\bcancel\b/i.test(message) || /\bkeep\b/i.test(message) || /\bno\b/i.test(message);
const buildPlanMissingPrompt = (draft) => {
    const missing = [];
    if (!draft.goalDistance)
        missing.push('goal distance (5K, 10K, Half, or Marathon)');
    if (!draft.goalDate)
        missing.push('target race date (YYYY-MM-DD)');
    if (!draft.daysPerWeek)
        missing.push('days per week you can run');
    if (missing.length === 1) {
        return `Great. What is your ${missing[0]}?`;
    }
    if (missing.length === 2) {
        return `Great. What is your ${missing[0]}, and ${missing[1]}?`;
    }
    return `Great. What is your ${missing.join(', and ')}?`;
};
const formatPlanIntro = (summary) => {
    const nextWorkout = summary.nextWorkouts[0];
    const nextLine = nextWorkout ? `Next run: ${nextWorkout.name} (${nextWorkout.effort})` : '';
    const goalLabel = summary.goalDistance === 'half'
        ? 'Half Marathon'
        : summary.goalDistance === 'marathon'
            ? 'Marathon'
            : summary.goalDistance.toUpperCase();
    return `Here’s your ${goalLabel} plan for ${summary.goalDate}. ` +
        `Current phase: ${summary.phase}. Focus this week: ${summary.weeklyFocus}. ${nextLine}`.trim();
};
const formatPace = (value) => {
    if (!value || !Number.isFinite(value))
        return undefined;
    const minutes = Math.floor(value);
    const seconds = Math.round((value - minutes) * 60);
    const padded = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${minutes}:${padded} min/km`;
};
const buildTrainingSummary = (charts) => {
    if (!Array.isArray(charts))
        return undefined;
    const distanceChart = charts.find(chart => String(chart?.id || '').includes('distance') || String(chart?.yLabel || '').includes('km'));
    const paceChart = charts.find(chart => String(chart?.id || '').includes('pace') || String(chart?.yLabel || '').includes('min/km'));
    const labels = distanceChart?.xLabels || paceChart?.xLabels || [];
    const distances = distanceChart?.series?.[0]?.data || [];
    const paces = paceChart?.series?.[0]?.data || [];
    if (!labels.length)
        return undefined;
    const runs = labels.map((label, idx) => ({
        label,
        distanceKm: typeof distances[idx] === 'number' ? Number(distances[idx].toFixed(2)) : undefined,
        pace: formatPace(typeof paces[idx] === 'number' ? paces[idx] : undefined),
    })).slice(0, 3);
    return { runs };
};
/**
 * POST /api/v1/chat
 * Main chat endpoint - receives user message and returns AI response
 */
router.post('/', async (req, res, next) => {
    logger.info('Chat POST handler called', { body: req.body });
    try {
        const { message, sessionId, location } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                error: 'Message is required and must be a string',
            });
        }
        const conversationId = contextManager.getOrCreateConversation(sessionId);
        contextManager.setUserId(conversationId, DEFAULT_USER_ID);
        if (location?.latitude && location?.longitude) {
            contextManager.updateLocation(conversationId, location.latitude, location.longitude);
        }
        contextManager.recordMessage(conversationId, 'user', message);
        personaAgent.updateRunnerProficiency(conversationId);
        const refreshRunnerHistory = !isPlanRequest(message);
        if (refreshRunnerHistory) {
            void personaAgent.refreshRunnerHistoryIfStale(conversationId);
        }
        logger.info('Chat request received', {
            message: message.substring(0, 100),
            sessionId: conversationId,
        });
        // Step 1: Classify intent (with context)
        const routingContext = contextManager.getContext(conversationId);
        userProfileManager.updateFromConversation(DEFAULT_USER_ID, conversationId, routingContext.summary, personaAgent.getProfileContext(conversationId));
        const contextPayload = {
            last_user_messages: (routingContext.recent_messages || [])
                .filter(msg => msg.role === 'user')
                .slice(-3)
                .map(msg => msg.content),
            last_assistant_messages: (routingContext.recent_messages || [])
                .filter(msg => msg.role === 'assistant')
                .slice(-3)
                .map(msg => msg.content),
            last_detected_intent: routingContext.last_intent,
            user_has_connected_data: Boolean(routingContext.last_analysis_text || routingContext.analysis_by_intent),
            summary: routingContext.summary,
            last_intent: routingContext.last_intent,
            last_agent: routingContext.last_agent,
        };
        const normalizedMessage = process.env.TYPO_NORMALIZATION_ENABLED === 'false'
            ? message
            : normalizeTypos(message);
        let planDraft = planDrafts.get(conversationId);
        const extractedPlanInfo = {
            goalDistance: extractGoalDistance(normalizedMessage),
            goalDate: extractGoalDate(normalizedMessage),
            daysPerWeek: extractDaysPerWeek(normalizedMessage),
        };
        if (planDraft && !hasPlanFollowupSignals(normalizedMessage, extractedPlanInfo)) {
            planDrafts.delete(conversationId);
        }
        planDraft = planDrafts.get(conversationId);
        if (unsubscribeConfirmations.get(conversationId)) {
            if (isConfirmUnsubscribe(normalizedMessage)) {
                unsubscribeConfirmations.delete(conversationId);
                trainingPlanService.setSubscription(DEFAULT_USER_ID, false);
                const activePlanId = trainingPlanService.getActivePlanForUser(DEFAULT_USER_ID);
                const summary = activePlanId ? trainingPlanService.getPlanSummary(activePlanId) : undefined;
                const response = {
                    response: 'You are unsubscribed. I can re-enable tracking anytime.',
                    sessionId: conversationId,
                    intent: 'training_plan',
                    requiresGarminData: false,
                    agent: 'Plan Coach',
                    confidence: 0.7,
                    planSummary: summary,
                    prompts: trainingPlanService.getPromptsForUser(DEFAULT_USER_ID),
                };
                contextManager.recordMessage(conversationId, 'assistant', response.response);
                return res.json(response);
            }
            if (isCancelUnsubscribe(normalizedMessage)) {
                unsubscribeConfirmations.delete(conversationId);
                const activePlanId = trainingPlanService.getActivePlanForUser(DEFAULT_USER_ID);
                const summary = activePlanId ? trainingPlanService.getPlanSummary(activePlanId) : undefined;
                const response = {
                    response: 'Got it. You are still subscribed and tracking is unchanged.',
                    sessionId: conversationId,
                    intent: 'training_plan',
                    requiresGarminData: false,
                    agent: 'Plan Coach',
                    confidence: 0.7,
                    planSummary: summary,
                    prompts: trainingPlanService.getPromptsForUser(DEFAULT_USER_ID),
                };
                contextManager.recordMessage(conversationId, 'assistant', response.response);
                return res.json(response);
            }
            const response = {
                response: 'Before I unsubscribe you, please reply "Confirm unsubscribe" or "Cancel".',
                sessionId: conversationId,
                intent: 'training_plan',
                requiresGarminData: false,
                agent: 'Plan Coach',
                confidence: 0.6,
            };
            contextManager.recordMessage(conversationId, 'assistant', response.response);
            return res.json(response);
        }
        if (isShowFullPlan(normalizedMessage)) {
            const activePlanId = trainingPlanService.getActivePlanForUser(DEFAULT_USER_ID);
            if (!activePlanId) {
                const response = {
                    response: 'I don’t see an active plan yet. Tell me your goal distance and race date to get started.',
                    sessionId: conversationId,
                    intent: 'training_plan',
                    requiresGarminData: false,
                    agent: 'Plan Coach',
                    confidence: 0.6,
                };
                contextManager.recordMessage(conversationId, 'assistant', response.response);
                return res.json(response);
            }
            const summary = trainingPlanService.getPlanSummary(activePlanId);
            const week = trainingPlanService.getCurrentWeek(activePlanId);
            const response = {
                response: `Here’s your full week (${week.weekStart} to ${week.weekEnd}).`,
                sessionId: conversationId,
                intent: 'training_plan',
                requiresGarminData: false,
                agent: 'Plan Coach',
                confidence: 0.85,
                planSummary: summary,
                weeklyDetail: week,
                prompts: trainingPlanService.getPromptsForUser(DEFAULT_USER_ID),
            };
            contextManager.recordMessage(conversationId, 'assistant', response.response);
            return res.json(response);
        }
        if (isTrackTraining(normalizedMessage)) {
            const activePlanId = trainingPlanService.getActivePlanForUser(DEFAULT_USER_ID);
            if (!activePlanId) {
                const response = {
                    response: 'I don’t see an active plan yet. Tell me your goal distance and race date to get started.',
                    sessionId: conversationId,
                    intent: 'training_plan',
                    requiresGarminData: false,
                    agent: 'Plan Coach',
                    confidence: 0.6,
                };
                contextManager.recordMessage(conversationId, 'assistant', response.response);
                return res.json(response);
            }
            const summary = trainingPlanService.getPlanSummary(activePlanId);
            const analysis = await agentClient.analyzeFitnessTrend(2);
            const charts = analysis.charts || analysis.chart_data || [];
            const trainingSummary = buildTrainingSummary(charts);
            const response = {
                response: 'Here’s your recent plan-focused training snapshot.',
                sessionId: conversationId,
                intent: 'training_plan',
                requiresGarminData: true,
                agent: analysis.agent || 'Plan Coach',
                confidence: 0.8,
                planSummary: summary,
                charts,
                trainingSummary,
                prompts: trainingPlanService.getPromptsForUser(DEFAULT_USER_ID),
            };
            contextManager.recordMessage(conversationId, 'assistant', response.response);
            return res.json(response);
        }
        if (isSubscribePlan(normalizedMessage)) {
            trainingPlanService.setSubscription(DEFAULT_USER_ID, true);
            const activePlanId = trainingPlanService.getActivePlanForUser(DEFAULT_USER_ID);
            const summary = activePlanId ? trainingPlanService.getPlanSummary(activePlanId) : undefined;
            const response = {
                response: 'You’re all set. Tracking is enabled for your plan.',
                sessionId: conversationId,
                intent: 'training_plan',
                requiresGarminData: false,
                agent: 'Plan Coach',
                confidence: 0.7,
                planSummary: summary,
                prompts: trainingPlanService.getPromptsForUser(DEFAULT_USER_ID),
            };
            contextManager.recordMessage(conversationId, 'assistant', response.response);
            return res.json(response);
        }
        if (isUnsubscribePlan(normalizedMessage)) {
            unsubscribeConfirmations.set(conversationId, true);
            const activePlanId = trainingPlanService.getActivePlanForUser(DEFAULT_USER_ID);
            const summary = activePlanId ? trainingPlanService.getPlanSummary(activePlanId) : undefined;
            const response = {
                response: 'Are you sure you want to unsubscribe? Reply "Confirm unsubscribe" to remove tracking or "Cancel" to keep it.',
                sessionId: conversationId,
                intent: 'training_plan',
                requiresGarminData: false,
                agent: 'Plan Coach',
                confidence: 0.7,
                planSummary: summary,
                prompts: trainingPlanService.getPromptsForUser(DEFAULT_USER_ID),
            };
            contextManager.recordMessage(conversationId, 'assistant', response.response);
            return res.json(response);
        }
        if (isEditGoal(normalizedMessage)) {
            planDrafts.set(conversationId, {});
            const response = {
                response: 'Sure. What is your new goal distance and target race date?',
                sessionId: conversationId,
                intent: 'training_plan',
                requiresGarminData: false,
                agent: 'Plan Coach',
                confidence: 0.7,
            };
            contextManager.recordMessage(conversationId, 'assistant', response.response);
            return res.json(response);
        }
        if (isReschedulePlan(normalizedMessage)) {
            const response = {
                response: 'Which workout should I move, and what day would you prefer?',
                sessionId: conversationId,
                intent: 'training_plan',
                requiresGarminData: false,
                agent: 'Plan Coach',
                confidence: 0.7,
            };
            contextManager.recordMessage(conversationId, 'assistant', response.response);
            return res.json(response);
        }
        const activePlanDraft = planDraft;
        const planSignalDraft = {
            goalDistance: activePlanDraft?.goalDistance || extractedPlanInfo.goalDistance,
            goalDate: activePlanDraft?.goalDate || extractedPlanInfo.goalDate,
            daysPerWeek: activePlanDraft?.daysPerWeek || extractedPlanInfo.daysPerWeek,
        };
        const shouldStartPlanFlow = Boolean(planDraft) || isPlanCreationSignal(normalizedMessage, planSignalDraft);
        let classification = null;
        if (!planDraft) {
            const classifyWithContext = process.env.CONTEXT_AWARE_INTENT_ENABLED !== 'false';
            const followupFastPath = isLikelyFollowUpRunning(normalizedMessage, routingContext)
                && hasRunningSignals([
                    ...contextPayload.last_user_messages,
                    ...contextPayload.last_assistant_messages,
                ].join(' '));
            classification = followupFastPath
                ? { intent: { type: 'general', confidence: 0.7, requiresGarminData: false, keywords: [] }, raw: { reason: 'followup_fast_path' } }
                : classifyWithContext
                    ? await intentClassifier.classifyWithRaw(normalizedMessage, contextPayload)
                    : { intent: intentClassifier.classify(normalizedMessage) };
        }
        if (shouldStartPlanFlow || (classification?.intent?.type === 'training_plan' && shouldStartPlanFlow)) {
            const nextDraft = {
                goalDistance: planDraft?.goalDistance || extractedPlanInfo.goalDistance,
                goalDate: planDraft?.goalDate || extractedPlanInfo.goalDate,
                daysPerWeek: planDraft?.daysPerWeek || extractedPlanInfo.daysPerWeek,
            };
            if (!nextDraft.goalDistance || !nextDraft.goalDate || !nextDraft.daysPerWeek) {
                planDrafts.set(conversationId, nextDraft);
                const response = {
                    response: buildPlanMissingPrompt(nextDraft),
                    sessionId: conversationId,
                    intent: 'training_plan',
                    requiresGarminData: false,
                    agent: 'Plan Coach',
                    confidence: 0.75,
                    prompts: trainingPlanService.getPromptsForUser(DEFAULT_USER_ID),
                };
                contextManager.recordMessage(conversationId, 'assistant', response.response);
                return res.json(response);
            }
            let summary;
            let week;
            try {
                const profileContext = userProfileManager.getUserProfileContext(DEFAULT_USER_ID);
                const agentPlan = await agentClient.generateTrainingPlan({
                    goal_distance: nextDraft.goalDistance,
                    target_date: nextDraft.goalDate,
                    days_per_week: nextDraft.daysPerWeek,
                    runner_profile: profileContext,
                    num_runs: 8,
                });
                const agentWeek = {
                    weekStart: agentPlan.week.week_start,
                    weekEnd: agentPlan.week.week_end,
                    days: agentPlan.week.days.map(day => ({
                        date: day.date,
                        name: day.name,
                        intensity: day.intensity,
                        why: day.why,
                        effort: day.effort,
                    })),
                };
                const result = trainingPlanService.createPlanFromAgent({
                    userId: DEFAULT_USER_ID,
                    goalDistance: nextDraft.goalDistance,
                    goalDate: nextDraft.goalDate,
                    daysPerWeek: nextDraft.daysPerWeek,
                    phase: agentPlan.summary.phase,
                    weeklyFocus: agentPlan.summary.weekly_focus,
                    personalizationReason: agentPlan.summary.personalized_because,
                    week: agentWeek,
                });
                summary = result.summary;
                week = result.week;
            }
            catch (error) {
                logger.error('Failed to create training plan', { error });
                const response = {
                    response: 'I hit a snag creating that plan. Can you confirm your race date (YYYY-MM-DD)?',
                    sessionId: conversationId,
                    intent: 'training_plan',
                    requiresGarminData: false,
                    agent: 'Plan Coach',
                    confidence: 0.6,
                };
                contextManager.recordMessage(conversationId, 'assistant', response.response);
                return res.json(response);
            }
            planDrafts.delete(conversationId);
            const response = {
                response: formatPlanIntro(summary),
                sessionId: conversationId,
                intent: 'training_plan',
                requiresGarminData: false,
                agent: 'Plan Coach',
                confidence: 0.9,
                planSummary: summary,
                weeklyDetail: week,
                prompts: trainingPlanService.getPromptsForUser(DEFAULT_USER_ID),
            };
            contextManager.recordMessage(conversationId, 'assistant', response.response);
            return res.json(response);
        }
        const classificationFinal = classification || (await (async () => {
            const classifyWithContext = process.env.CONTEXT_AWARE_INTENT_ENABLED !== 'false';
            const followupFastPath = isLikelyFollowUpRunning(normalizedMessage, routingContext)
                && hasRunningSignals([
                    ...contextPayload.last_user_messages,
                    ...contextPayload.last_assistant_messages,
                ].join(' '));
            return followupFastPath
                ? { intent: { type: 'general', confidence: 0.7, requiresGarminData: false, keywords: [] }, raw: { reason: 'followup_fast_path' } }
                : classifyWithContext
                    ? await intentClassifier.classifyWithRaw(normalizedMessage, contextPayload)
                    : { intent: intentClassifier.classify(normalizedMessage) };
        })());
        let intent = classificationFinal.intent;
        logger.info('Intent classified', {
            type: intent.type,
            confidence: intent.confidence,
            requiresGarminData: intent.requiresGarminData,
        });
        const followupOverrideEnabled = process.env.FOLLOWUP_OVERRIDE_ENABLED !== 'false';
        if (followupOverrideEnabled &&
            intent.type === 'non_running' &&
            (message.trim().length <= 40 || !/[a-zA-Z]+ing\b/.test(message.toLowerCase())) &&
            (isLikelyFollowUpRunning(message, routingContext) ||
                hasRunningSignals([
                    ...contextPayload.last_user_messages,
                    ...contextPayload.last_assistant_messages,
                ].join(' ')))) {
            intent = {
                ...intent,
                type: 'general',
                confidence: Math.max(intent.confidence, 0.6),
                requiresGarminData: false,
            };
            logger.info('Overriding intent to follow-up running context', {
                type: intent.type,
                confidence: intent.confidence,
            });
        }
        if (intent.type === 'non_running' || intent.type === 'profanity') {
            const response = {
                response: 'I’m focused on running coaching and training. I can help with running technique, training plans, race prep, recovery, or weather conditions. What would you like to know about your running?',
                sessionId: conversationId,
                intent: intent.type,
                requiresGarminData: false,
                agent: 'Coach Agent',
                confidence: intent.confidence,
            };
            if (process.env.INTENT_DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
                res.setHeader('X-Intent-Route', intent.type);
                res.setHeader('X-Intent-Raw', JSON.stringify(classificationFinal.raw || intent));
            }
            contextManager.recordMessage(conversationId, 'assistant', response.response);
            return res.json(response);
        }
        // Step 2: Route to appropriate agent based on intent
        let analysis;
        let agentUsed = 'none';
        if (intent.type === 'weather') {
            const context = contextManager.getContext(conversationId);
            const lat = location?.latitude || context.location?.latitude;
            const lon = location?.longitude || context.location?.longitude;
            if (lat === undefined || lon === undefined) {
                return res.json({
                    response: 'Please enable location so I can check running conditions near you.',
                    sessionId: conversationId,
                    intent: intent.type,
                    requiresGarminData: false,
                    agent: 'Weather Agent',
                    confidence: intent.confidence,
                });
            }
            const weather = await agentClient.getRunningConditions(lat, lon);
            const response = {
                response: weather.analysis || 'Here are the current running conditions near you.',
                sessionId: conversationId,
                intent: intent.type,
                requiresGarminData: false,
                agent: weather.agent || 'Weather Agent',
                confidence: intent.confidence,
                weather: weather.weather,
                charts: weather.charts || [],
            };
            contextManager.recordMessage(conversationId, 'assistant', response.response);
            contextManager.recordAnalysis(conversationId, intent.type, response.agent, response.response, response.weather ? { weather: response.weather } : undefined);
            if (process.env.INTENT_DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
                res.setHeader('X-Intent-Route', intent.type);
                res.setHeader('X-Intent-Raw', JSON.stringify(classificationFinal.raw || intent));
            }
            return res.json(response);
        }
        if (intent.requiresGarminData) {
            const cached = contextManager.getRecentAnalysisForIntent(conversationId, intent.type, 15);
            const chartIntents = new Set(['last_run', 'recent_runs', 'fitness_trend']);
            const cachedCharts = cached?.analysis_payload?.charts;
            const canUseCache = cached && (!chartIntents.has(intent.type) || (Array.isArray(cachedCharts) && cachedCharts.length > 0));
            if (canUseCache) {
                const response = {
                    response: cached.analysis_text,
                    sessionId: conversationId,
                    intent: intent.type,
                    requiresGarminData: true,
                    agent: cached.agent || 'Cached Analysis',
                    confidence: intent.confidence,
                    charts: cachedCharts,
                };
                contextManager.recordMessage(conversationId, 'assistant', response.response);
                logger.info('Returning cached analysis', { intent: intent.type, agent: response.agent });
                if (process.env.INTENT_DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
                    res.setHeader('X-Intent-Route', intent.type);
                    res.setHeader('X-Intent-Raw', JSON.stringify(classificationFinal.raw || intent));
                }
                return res.json(response);
            }
            try {
                switch (intent.type) {
                    case 'last_run':
                        logger.info('Routing to Agent 1: Current Run Analyzer');
                        analysis = await agentClient.analyzeLastRun();
                        agentUsed = 'Agent 1 - Current Run Analyzer';
                        break;
                    case 'recent_runs':
                        logger.info('Routing to Agent 2: Last Runs Comparator');
                        analysis = await agentClient.analyzeRecentRuns();
                        agentUsed = 'Agent 2 - Last Runs Comparator';
                        break;
                    case 'fitness_trend':
                        logger.info('Routing to Agent 3: Fitness Trend Analyzer');
                        analysis = await agentClient.analyzeFitnessTrend(MAX_TREND_RUNS);
                        agentUsed = 'Agent 3 - Fitness Trend Analyzer';
                        break;
                    default:
                        throw new Error(`Unknown intent type: ${intent.type}`);
                }
                // Check if agent returned an error
                if (analysis.error) {
                    logger.error('Agent returned error', { error: analysis.error });
                    return res.status(500).json({
                        error: 'Failed to analyze running data',
                        detail: analysis.error,
                    });
                }
                // Return successful analysis
                const response = {
                    response: analysis.analysis || analysis.raw_analysis || 'Analysis completed',
                    sessionId: conversationId,
                    intent: intent.type,
                    requiresGarminData: true,
                    agent: agentUsed,
                    confidence: intent.confidence,
                    charts: analysis.charts || analysis.chart_data,
                };
                contextManager.recordMessage(conversationId, 'assistant', response.response);
                contextManager.recordAnalysis(conversationId, intent.type, agentUsed, response.response, response.charts ? { charts: response.charts } : undefined);
                logger.info('Chat response prepared', {
                    agent: agentUsed,
                    responseLength: response.response.length,
                });
                if (process.env.INTENT_DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
                    res.setHeader('X-Intent-Route', intent.type);
                    res.setHeader('X-Intent-Raw', JSON.stringify(classificationFinal.raw || intent));
                }
                return res.json(response);
            }
            catch (error) {
                logger.error('Error calling agent service', { error });
                return res.status(500).json({
                    error: 'Failed to process request',
                    detail: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        else {
            // General chat - use Coach Agent for non-personalized running questions
            try {
                const context = contextManager.getContext(conversationId);
                const personaContext = personaAgent.getProfileContext(conversationId) || personaAgent.getLatestProfileContext();
                const userProfileContext = userProfileManager.getUserProfileContext(DEFAULT_USER_ID);
                const enrichedContext = personaContext
                    ? { ...context, persona_profile: personaContext }
                    : context;
                const fullyEnrichedContext = userProfileContext
                    ? { ...enrichedContext, user_profile: userProfileContext }
                    : enrichedContext;
                const isWeatherQuery = /weather|conditions/i.test(message);
                if (isWeatherQuery && context.location?.latitude !== undefined && context.location?.longitude !== undefined) {
                    const weather = await agentClient.getRunningConditions(context.location.latitude, context.location.longitude);
                    const response = {
                        response: weather.analysis || 'Here are the current running conditions near you.',
                        sessionId: conversationId,
                        intent: 'weather',
                        requiresGarminData: false,
                        agent: weather.agent || 'Weather Agent',
                        confidence: intent.confidence,
                        weather: weather.weather,
                        charts: weather.charts || [],
                    };
                    contextManager.recordMessage(conversationId, 'assistant', response.response);
                    contextManager.recordAnalysis(conversationId, 'weather', response.agent, response.response, response.weather ? { weather: response.weather } : undefined);
                    return res.json(response);
                }
                const personalized = isPersonalizedQuery(message) || Boolean(context.last_intent);
                const coachable = isCoachableQuestion(message);
                logger.info('Coach routing flags', {
                    coachable,
                    personalized,
                    sessionId: conversationId,
                });
                if (personalized) {
                    logger.info('Routing to Coach Q&A Agent with context');
                    analysis = await agentClient.askCoachWithContext(message, fullyEnrichedContext, undefined, {
                        force_answer: coachable,
                    });
                    agentUsed = 'Coach Q&A Agent - Context Aware';
                }
                else if (personaContext) {
                    logger.info('Routing to Coach Q&A Agent with persona context');
                    analysis = await agentClient.askCoachWithContext(message, fullyEnrichedContext, undefined, {
                        force_answer: coachable,
                    });
                    agentUsed = 'Coach Q&A Agent - Persona Aware';
                }
                else {
                    logger.info('Routing to Coach Agent for general question');
                    analysis = await agentClient.askCoach(message);
                    agentUsed = 'Coach Agent - General Running Coach';
                }
                // Check if agent returned an error
                if (analysis.error) {
                    logger.error('Coach agent returned error', { error: analysis.error });
                    return res.status(500).json({
                        error: 'Failed to process question',
                        detail: analysis.error,
                    });
                }
                // Return successful response
                const response = {
                    response: analysis.analysis || 'I apologize, but I encountered an issue processing your question. Please try again.',
                    sessionId: conversationId,
                    intent: intent.type,
                    requiresGarminData: false,
                    agent: agentUsed,
                    confidence: intent.confidence,
                    charts: analysis.charts || analysis.chart_data,
                };
                contextManager.recordMessage(conversationId, 'assistant', response.response);
                contextManager.recordAnalysis(conversationId, intent.type, agentUsed, response.response, response.charts ? { charts: response.charts } : undefined);
                logger.info('Coach agent response prepared', {
                    agent: agentUsed,
                    responseLength: response.response.length,
                });
                if (process.env.INTENT_DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
                    res.setHeader('X-Intent-Route', intent.type);
                    res.setHeader('X-Intent-Raw', JSON.stringify(classificationFinal.raw || intent));
                }
                return res.json(response);
            }
            catch (error) {
                logger.error('Error calling coach agent', { error });
                return res.status(500).json({
                    error: 'Failed to process question',
                    detail: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
    }
    catch (error) {
        logger.error('Unexpected error in chat endpoint', { error });
        next(error);
    }
});
/**
 * POST /api/v1/chat/fetch-runs
 * Fetch additional run data for dynamic range selection
 */
router.post('/fetch-runs', async (req, res, next) => {
    logger.info('Fetch runs POST handler called', { body: req.body });
    try {
        const { count, sessionId } = req.body;
        if (!count || typeof count !== 'number' || count < 1 || count > MAX_TREND_RUNS) {
            return res.status(400).json({
                error: `Count is required and must be a number between 1 and ${MAX_TREND_RUNS}`,
            });
        }
        const conversationId = contextManager.getOrCreateConversation(sessionId);
        logger.info('Fetching run data', { count, sessionId: conversationId });
        try {
            // Call fitness trend analyzer with specified count
            const analysis = await agentClient.analyzeFitnessTrend(Math.min(count, MAX_TREND_RUNS));
            if (analysis.error) {
                logger.error('Agent returned error', { error: analysis.error });
                return res.status(500).json({
                    error: 'Failed to fetch run data',
                    detail: analysis.error,
                });
            }
            // Return only charts data
            const response = {
                charts: analysis.charts || analysis.chart_data || [],
                count,
                sessionId: conversationId,
            };
            logger.info('Run data fetched successfully', {
                count,
                chartsCount: response.charts.length,
            });
            return res.json(response);
        }
        catch (error) {
            logger.error('Error fetching run data', { error });
            return res.status(500).json({
                error: 'Failed to fetch run data',
                detail: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    catch (error) {
        logger.error('Unexpected error in fetch-runs endpoint', { error });
        next(error);
    }
});
/**
 * GET /api/v1/chat/health
 * Health check for chat service and agent service
 */
router.get('/health', async (req, res) => {
    try {
        const agentServiceHealthy = await agentClient.healthCheck();
        res.json({
            status: 'ok',
            chatService: 'healthy',
            agentService: agentServiceHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
export default router;
// Made with Bob
//# sourceMappingURL=chat.routes.js.map