export type SubscriptionErrorCode = 'PLAN_LIMIT_REACHED' | 'QUERY_LIMIT_REACHED' | 'FEATURE_LOCKED';

export const subscriptionErrors = {
  planLimit: {
    status: 403,
    code: 'PLAN_LIMIT_REACHED' as SubscriptionErrorCode,
    error: 'Upgrade to Premium for unlimited plans.',
  },
  queryLimit: {
    status: 429,
    code: 'QUERY_LIMIT_REACHED' as SubscriptionErrorCode,
    error: "You've reached your monthly limit. Upgrade to continue.",
  },
  featureLocked: {
    status: 403,
    code: 'FEATURE_LOCKED' as SubscriptionErrorCode,
    error: 'This feature requires a Premium subscription.',
  },
};
