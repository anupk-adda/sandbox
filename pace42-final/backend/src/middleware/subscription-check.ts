import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/subscription-service.js';
import { subscriptionErrors } from '../utils/subscription-errors.js';

export const requirePlanAllowance = (req: Request, res: Response, next: NextFunction) => {
  const userId: string | undefined = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Access denied. No user provided.' });
  }

  const status = subscriptionService.canCreatePlan(userId);
  if (!status.allowed) {
    return res.status(subscriptionErrors.planLimit.status).json({
      error: subscriptionErrors.planLimit.error,
      code: subscriptionErrors.planLimit.code,
      tier: status.tier,
      limit: status.limit,
      activePlans: status.activePlans,
      upgradeRequired: true,
      requestId: (req as any).requestId,
    });
  }

  next();
};

export const requireQueryAllowance = (req: Request, res: Response, next: NextFunction) => {
  const userId: string | undefined = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Access denied. No user provided.' });
  }

  const status = subscriptionService.checkAndConsumeQuery(userId);
  if (!status.allowed) {
    return res.status(subscriptionErrors.queryLimit.status).json({
      error: subscriptionErrors.queryLimit.error,
      code: subscriptionErrors.queryLimit.code,
      tier: status.tier,
      limit: status.limit,
      remaining: status.remaining,
      upgradeRequired: true,
      requestId: (req as any).requestId,
    });
  }

  // Attach usage info to request for logging/response
  (req as any).queryUsage = {
    remaining: status.remaining,
    limit: status.limit,
    tier: status.tier,
  };

  next();
};
