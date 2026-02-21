import { Router, Request, Response } from 'express';
import { trainingPlanService, GoalDistance } from '../services/training-plan-service.js';
import { subscriptionService } from '../services/subscription-service.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.routes.js';
import { requirePlanAllowance } from '../middleware/subscription-check.js';
import { sendError } from '../utils/error-response.js';

const router = Router();

const getParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] : value || ''
);

// Create a new training plan (authenticated)
router.post('/', authenticateToken, requirePlanAllowance, (req: Request, res: Response) => {
  try {
    const { goalDistance, goalDate, daysPerWeek } = req.body as {
      goalDistance: GoalDistance;
      goalDate: string;
      daysPerWeek: number;
    };

    if (!goalDistance || !goalDate || !daysPerWeek) {
      return sendError(res, req, 400, 'VALIDATION_ERROR', 'goalDistance, goalDate, and daysPerWeek are required.');
    }

    const userId = (req as any).user.userId;

    const result = trainingPlanService.createPlan({
      userId,
      goalDistance,
      goalDate,
      daysPerWeek,
    });

    // Legacy plan subscription flag (kept for backward compatibility)
    trainingPlanService.setSubscription(userId, true);

    return res.json({
      status: 'success',
      plan: result.summary,
      week: result.week,
    });
  } catch (error) {
    logger.error('Failed to create training plan', { error });
    return sendError(res, req, 500, 'TRAINING_PLAN_CREATE_FAILED', 'Failed to create training plan');
  }
});

// Subscribe/unsubscribe from training plan
router.post('/subscribe', authenticateToken, (req: Request, res: Response) => {
  try {
    const { subscribed } = req.body as { subscribed: boolean };
    const userId = (req as any).user.userId;
    
    // Map legacy subscribe action to subscription tier
    subscriptionService.setUserTier(userId, subscribed ? 'premium' : 'free', 'legacy-subscribe');
    trainingPlanService.setSubscription(userId, subscribed);
    
    return res.json({
      status: 'success',
      subscribed,
      message: subscribed ? 'Subscribed to training plan' : 'Unsubscribed from training plan',
    });
  } catch (error) {
    logger.error('Failed to update subscription', { error });
    return sendError(res, req, 500, 'SUBSCRIPTION_UPDATE_FAILED', 'Failed to update subscription');
  }
});

// Get subscription status
router.get('/subscription-status', authenticateToken, (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const isSubscribed = trainingPlanService.isUserSubscribed(userId);
    const activePlanId = trainingPlanService.getActivePlanForUser(userId);
    const tierStatus = subscriptionService.getTierStatus(userId);
    
    return res.json({
      status: 'success',
      subscribed: isSubscribed,
      hasActivePlan: !!activePlanId,
      planId: activePlanId,
      tier: tierStatus.tier,
      limits: tierStatus.limits,
    });
  } catch (error) {
    logger.error('Failed to fetch subscription status', { error });
    return sendError(res, req, 500, 'SUBSCRIPTION_STATUS_FAILED', 'Failed to fetch subscription status');
  }
});

// Get active plan for current user
router.get('/active', authenticateToken, (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const planId = trainingPlanService.getActivePlanForUser(userId);
    
    if (!planId) {
      return res.json({ status: 'empty', plan: null, prompts: [] });
    }
    
    const planSummary = trainingPlanService.getPlanSummary(planId);
    const prompts = trainingPlanService.getPromptsForUser(userId);
    
    return res.json({ status: 'success', plan: planSummary, prompts });
  } catch (error) {
    logger.error('Failed to fetch active plan', { error });
    return sendError(res, req, 500, 'TRAINING_PLAN_FETCH_FAILED', 'Failed to fetch active plan');
  }
});

// Get plan summary
router.get('/:planId/summary', authenticateToken, (req: Request, res: Response) => {
  try {
    const planId = getParam(req.params.planId);
    const planSummary = trainingPlanService.getPlanSummary(planId);
    return res.json({ status: 'success', plan: planSummary });
  } catch (error) {
    logger.error('Failed to fetch plan summary', { error });
    return sendError(res, req, 404, 'TRAINING_PLAN_NOT_FOUND', 'Plan not found');
  }
});

// Get week details
router.get('/:planId/weeks/:weekStart', authenticateToken, (req: Request, res: Response) => {
  try {
    const planId = getParam(req.params.planId);
    const weekStart = getParam(req.params.weekStart);
    const week = trainingPlanService.getWeekDetails(planId, weekStart);
    return res.json({ status: 'success', week });
  } catch (error) {
    logger.error('Failed to fetch week details', { error });
    return sendError(res, req, 404, 'TRAINING_PLAN_WEEK_NOT_FOUND', 'Week not found');
  }
});

// Get workout detail
router.get('/workouts/:workoutId', authenticateToken, (req: Request, res: Response) => {
  try {
    const workoutId = getParam(req.params.workoutId);
    const workout = trainingPlanService.getWorkoutDetail(workoutId);
    return res.json({ status: 'success', workout });
  } catch (error) {
    logger.error('Failed to fetch workout detail', { error });
    return sendError(res, req, 404, 'TRAINING_PLAN_WORKOUT_NOT_FOUND', 'Workout not found');
  }
});

// Get prompts for current user
router.get('/users/me/prompts', authenticateToken, (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const prompts = trainingPlanService.getPromptsForUser(userId);
    return res.json({ status: 'success', prompts });
  } catch (error) {
    logger.error('Failed to fetch prompts', { error });
    return sendError(res, req, 500, 'TRAINING_PLAN_PROMPTS_FAILED', 'Failed to fetch prompts');
  }
});

// Legacy endpoint for backward compatibility (uses userId param)
router.get('/users/:userId/prompts', authenticateToken, (req: Request, res: Response) => {
  try {
    const userId = getParam(req.params.userId);
    const prompts = trainingPlanService.getPromptsForUser(userId);
    return res.json({ status: 'success', prompts });
  } catch (error) {
    logger.error('Failed to fetch prompts', { error });
    return sendError(res, req, 500, 'TRAINING_PLAN_PROMPTS_FAILED', 'Failed to fetch prompts');
  }
});

// Legacy endpoint for backward compatibility (uses userId param)
router.get('/users/:userId/active', authenticateToken, (req: Request, res: Response) => {
  try {
    const userId = getParam(req.params.userId);
    const planId = trainingPlanService.getActivePlanForUser(userId);
    if (!planId) {
      return res.json({ status: 'empty', plan: null, prompts: [] });
    }
    const planSummary = trainingPlanService.getPlanSummary(planId);
    const prompts = trainingPlanService.getPromptsForUser(userId);
    return res.json({ status: 'success', plan: planSummary, prompts });
  } catch (error) {
    logger.error('Failed to fetch active plan', { error });
    return sendError(res, req, 500, 'TRAINING_PLAN_FETCH_FAILED', 'Failed to fetch active plan');
  }
});

export default router;
