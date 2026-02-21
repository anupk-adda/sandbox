export type SubscriptionTier = 'free' | 'premium';

export interface TierConfig {
  name: string;
  maxPlans: number;
  maxQueriesPerMonth: number;
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: 'Free',
    maxPlans: 1,
    maxQueriesPerMonth: 50,
  },
  premium: {
    name: 'Premium',
    maxPlans: -1,
    maxQueriesPerMonth: -1,
  },
};

export const DEFAULT_TIER: SubscriptionTier = 'free';
