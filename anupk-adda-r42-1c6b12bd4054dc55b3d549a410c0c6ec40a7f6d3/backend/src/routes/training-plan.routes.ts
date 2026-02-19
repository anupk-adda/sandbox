import { Router, Request, Response } from 'express';
import { trainingPlanService, GoalDistance } from '../services/training-plan-service.js';
import { logger } from '../utils/logger.js';

const router = Router();

const DEFAULT_USER_ID = 'anup';
const getParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] : value || ''
);

router.post('/', (req: Request, res: Response) => {
  try {
    const { goalDistance, goalDate, daysPerWeek } = req.body as {
      goalDistance: GoalDistance;
      goalDate: string;
      daysPerWeek: number;
    };

    if (!goalDistance || !goalDate || !daysPerWeek) {
      return res.status(400).json({ error: 'goalDistance, goalDate, and daysPerWeek are required.' });
    }

    const result = trainingPlanService.createPlan({
      userId: DEFAULT_USER_ID,
      goalDistance,
      goalDate,
      daysPerWeek,
    });

    return res.json({
      status: 'success',
      plan: result.summary,
      week: result.week,
    });
  } catch (error) {
    logger.error('Failed to create training plan', { error });
    return res.status(500).json({ error: 'Failed to create training plan' });
  }
});

router.get('/:planId/summary', (req: Request, res: Response) => {
  try {
    const planId = getParam(req.params.planId);
    const planSummary = trainingPlanService.getPlanSummary(planId);
    return res.json({ status: 'success', plan: planSummary });
  } catch (error) {
    logger.error('Failed to fetch plan summary', { error });
    return res.status(404).json({ error: 'Plan not found' });
  }
});

router.get('/:planId/weeks/:weekStart', (req: Request, res: Response) => {
  try {
    const planId = getParam(req.params.planId);
    const weekStart = getParam(req.params.weekStart);
    const week = trainingPlanService.getWeekDetails(planId, weekStart);
    return res.json({ status: 'success', week });
  } catch (error) {
    logger.error('Failed to fetch week details', { error });
    return res.status(404).json({ error: 'Week not found' });
  }
});

router.get('/workouts/:workoutId', (req: Request, res: Response) => {
  try {
    const workoutId = getParam(req.params.workoutId);
    const workout = trainingPlanService.getWorkoutDetail(workoutId);
    return res.json({ status: 'success', workout });
  } catch (error) {
    logger.error('Failed to fetch workout detail', { error });
    return res.status(404).json({ error: 'Workout not found' });
  }
});

router.get('/users/:userId/prompts', (req: Request, res: Response) => {
  try {
    const userId = getParam(req.params.userId);
    const prompts = trainingPlanService.getPromptsForUser(userId);
    return res.json({ status: 'success', prompts });
  } catch (error) {
    logger.error('Failed to fetch prompts', { error });
    return res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

router.get('/users/:userId/active', (req: Request, res: Response) => {
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
    return res.status(500).json({ error: 'Failed to fetch active plan' });
  }
});

export default router;

// Made with Bob
