import { Router, Request, Response } from 'express';
import { authenticateToken } from './auth.routes.js';
import { subscriptionService } from '../services/subscription-service.js';
import { SUBSCRIPTION_TIERS, SubscriptionTier } from '../config/subscription-tiers.js';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/error-response.js';

const router = Router();

router.get('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const tierStatus = subscriptionService.getTierStatus(userId);
    const usage = subscriptionService.getUsageStatus(userId);

    return res.json({
      status: 'success',
      tier: tierStatus.tier,
      limits: tierStatus.limits,
      usage,
    });
  } catch (error) {
    logger.error('Failed to fetch subscription status', { error });
    return sendError(res, req, 500, 'SUBSCRIPTION_STATUS_FAILED', 'Failed to fetch subscription status');
  }
});

router.post('/upgrade', authenticateToken, (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const targetTier: SubscriptionTier = 'premium';
    subscriptionService.setUserTier(userId, targetTier, 'manual-upgrade');

    return res.json({
      status: 'success',
      tier: targetTier,
      limits: SUBSCRIPTION_TIERS[targetTier],
    });
  } catch (error) {
    logger.error('Failed to upgrade subscription', { error });
    return sendError(res, req, 500, 'SUBSCRIPTION_UPGRADE_FAILED', 'Failed to upgrade subscription');
  }
});

router.post('/downgrade', authenticateToken, (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const targetTier: SubscriptionTier = 'free';
    subscriptionService.setUserTier(userId, targetTier, 'manual-downgrade');

    return res.json({
      status: 'success',
      tier: targetTier,
      limits: SUBSCRIPTION_TIERS[targetTier],
    });
  } catch (error) {
    logger.error('Failed to downgrade subscription', { error });
    return sendError(res, req, 500, 'SUBSCRIPTION_DOWNGRADE_FAILED', 'Failed to downgrade subscription');
  }
});

export default router;
