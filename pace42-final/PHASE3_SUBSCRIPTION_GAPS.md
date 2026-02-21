# Phase 3: Subscription Gating & Plan Flow Analysis
**Gap Analysis and Implementation Checklist**

## Executive Summary

**Current State:** Minimal subscription enforcement exists. The system has:
- `isSubscribed` flag in training plans (boolean, not enforced)
- No subscription/tier columns in database schema
- No subscription gating on API endpoints
- No error messages for subscription limits
- No plan upgrade/downgrade flows

**Gap Count:** 15 critical gaps identified across 3 categories

---

## 1. Database Schema Gaps

### Missing Tables/Columns

**Gap 1.1: No subscription tier in users table**
- **Current:** `users` table has no subscription/tier column
- **Impact:** Cannot track user subscription level
- **Target File:** `database/schema.sql`
- **Fix Required:** Add `subscription_tier TEXT DEFAULT 'free'` column
- **Migration:** `database/migrations/003_add_subscription_tier.sql`

**Gap 1.2: No subscription history table**
- **Current:** No tracking of subscription changes
- **Impact:** Cannot audit tier changes or billing events
- **Target File:** `database/schema.sql`
- **Fix Required:** Create `subscription_history` table
- **Fields:** `id, user_id, tier, start_date, end_date, payment_status`

**Gap 1.3: No feature limits table**
- **Current:** No configuration for tier-based limits
- **Impact:** Hard-coded limits, difficult to change
- **Target File:** `database/schema.sql`
- **Fix Required:** Create `subscription_features` table
- **Fields:** `tier, feature_name, limit_value, enabled`

---

## 2. Backend API Gaps

### Subscription Enforcement

**Gap 2.1: No subscription middleware**
- **Current:** No middleware to check subscription before API calls
- **Impact:** All users can access all features
- **Target File:** `backend/src/middleware/subscription-check.ts` (NEW)
- **Fix Required:** Create middleware to validate subscription tier
- **Usage:** Apply to protected routes

**Gap 2.2: Training plan creation not gated**
- **Current:** `POST /api/v1/training-plans` has no subscription check
- **Impact:** Free users can create unlimited plans
- **Target File:** `backend/src/routes/training-plan.routes.ts`
- **Fix Required:** Add subscription check before plan creation
- **Error:** Return 403 with upgrade message

**Gap 2.3: Chat/analysis not gated**
- **Current:** `POST /api/v1/chat` has no subscription check
- **Impact:** Free users get unlimited AI analysis
- **Target File:** `backend/src/routes/chat.routes.ts`
- **Fix Required:** Add monthly query limit for free tier
- **Error:** Return 429 with upgrade message

**Gap 2.4: No subscription management endpoints**
- **Current:** No API to upgrade/downgrade subscription
- **Impact:** Cannot change subscription tier
- **Target Files:** 
  - `backend/src/routes/subscription.routes.ts` (NEW)
  - `backend/src/services/subscription-service.ts` (NEW)
- **Fix Required:** Create subscription management API
- **Endpoints:** 
  - `GET /api/v1/subscription` - Get current tier
  - `POST /api/v1/subscription/upgrade` - Upgrade tier
  - `POST /api/v1/subscription/downgrade` - Downgrade tier

### Error Messages

**Gap 2.5: No subscription error messages**
- **Current:** Generic errors, no subscription-specific messages
- **Impact:** Poor UX, users don't know why they're blocked
- **Target File:** `backend/src/utils/subscription-errors.ts` (NEW)
- **Fix Required:** Create standardized error messages
- **Messages:**
  - Free tier: "Upgrade to Premium for unlimited plans"
  - Monthly limit: "You've reached your monthly limit. Upgrade to continue."
  - Feature locked: "This feature requires Premium subscription"

---

## 3. Frontend Gaps

### Subscription UI

**Gap 3.1: No subscription status display**
- **Current:** Dashboard shows `isSubscribed` but not tier
- **Impact:** Users don't know their subscription level
- **Target File:** `frontend/src/sections/DashboardSection.tsx`
- **Fix Required:** Display current tier (Free/Premium)
- **Location:** Header or profile section

**Gap 3.2: No upgrade prompts**
- **Current:** No UI to prompt upgrade when hitting limits
- **Impact:** Users hit limits without knowing how to upgrade
- **Target File:** `frontend/src/components/UpgradePrompt.tsx` (NEW)
- **Fix Required:** Create modal/banner for upgrade prompts
- **Triggers:** Plan creation limit, query limit, feature access

**Gap 3.3: No subscription management page**
- **Current:** No page to view/manage subscription
- **Impact:** Users cannot upgrade/downgrade
- **Target File:** `frontend/src/sections/SubscriptionSection.tsx` (NEW)
- **Fix Required:** Create subscription management page
- **Features:** Current tier, usage stats, upgrade/downgrade buttons

**Gap 3.4: Pricing section not integrated**
- **Current:** `PricingSection.tsx` exists but not connected to backend
- **Impact:** Users see pricing but cannot subscribe
- **Target File:** `frontend/src/sections/PricingSection.tsx`
- **Fix Required:** Add "Subscribe" button handlers
- **Action:** Call subscription API on button click

### Error Handling

**Gap 3.5: No subscription error handling**
- **Current:** Generic error messages for API failures
- **Impact:** Users don't understand subscription errors
- **Target File:** `frontend/src/services/chatService.ts`
- **Fix Required:** Handle 403/429 errors with upgrade prompts
- **Display:** Show UpgradePrompt component on subscription errors

---

## 4. Service Layer Gaps

### Subscription Logic

**Gap 4.1: No subscription validation service**
- **Current:** `isUserSubscribed()` returns boolean, no tier logic
- **Impact:** Cannot differentiate between Free/Premium
- **Target File:** `backend/src/services/subscription-service.ts` (NEW)
- **Fix Required:** Create comprehensive subscription service
- **Methods:**
  - `getUserTier(userId)` - Get user's subscription tier
  - `canCreatePlan(userId)` - Check if user can create plan
  - `canQueryAnalysis(userId)` - Check if user can query
  - `getRemainingQueries(userId)` - Get monthly query count
  - `upgradeTier(userId, tier)` - Upgrade subscription
  - `downgradeTier(userId)` - Downgrade subscription

**Gap 4.2: No usage tracking**
- **Current:** No tracking of feature usage per user
- **Impact:** Cannot enforce monthly limits
- **Target File:** `backend/src/services/usage-tracker.ts` (NEW)
- **Fix Required:** Create usage tracking service
- **Track:** Plans created, queries made, features accessed
- **Reset:** Monthly reset for free tier limits

**Gap 4.3: Training plan service not tier-aware**
- **Current:** `training-plan-service.ts` has `isSubscribed` but no enforcement
- **Impact:** Service doesn't prevent plan creation
- **Target File:** `backend/src/services/training-plan-service.ts`
- **Fix Required:** Add tier checks before plan operations
- **Check:** Validate tier before create/update/delete

---

## 5. Configuration Gaps

### Feature Limits

**Gap 5.1: No tier configuration**
- **Current:** No centralized configuration for tier limits
- **Impact:** Limits hard-coded, difficult to change
- **Target File:** `backend/src/config/subscription-tiers.ts` (NEW)
- **Fix Required:** Create tier configuration
- **Config:**
```typescript
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    plans_limit: 1,
    queries_per_month: 50,
    features: ['basic_analysis', 'single_plan']
  },
  premium: {
    name: 'Premium',
    plans_limit: -1, // unlimited
    queries_per_month: -1, // unlimited
    features: ['advanced_analysis', 'unlimited_plans', 'priority_support']
  }
};
```

---

## Implementation Checklist

### Phase 3.1: Database & Schema (Priority 1)
- [ ] Create migration `003_add_subscription_tier.sql`
- [ ] Add `subscription_tier` column to `users` table
- [ ] Create `subscription_history` table
- [ ] Create `subscription_features` table
- [ ] Create `usage_tracking` table
- [ ] Run migration and verify schema

### Phase 3.2: Backend Services (Priority 1)
- [ ] Create `subscription-service.ts` with tier logic
- [ ] Create `usage-tracker.ts` for feature usage
- [ ] Create `subscription-errors.ts` for error messages
- [ ] Create `subscription-tiers.ts` for configuration
- [ ] Update `training-plan-service.ts` with tier checks
- [ ] Add unit tests for subscription service

### Phase 3.3: Backend Middleware & Routes (Priority 2)
- [ ] Create `subscription-check.ts` middleware
- [ ] Create `subscription.routes.ts` for subscription API
- [ ] Add subscription check to `training-plan.routes.ts`
- [ ] Add subscription check to `chat.routes.ts`
- [ ] Update error responses with subscription messages
- [ ] Add integration tests for gated endpoints

### Phase 3.4: Frontend Components (Priority 2)
- [ ] Create `UpgradePrompt.tsx` component
- [ ] Create `SubscriptionSection.tsx` page
- [ ] Update `DashboardSection.tsx` with tier display
- [ ] Update `PricingSection.tsx` with subscribe handlers
- [ ] Add subscription error handling to `chatService.ts`
- [ ] Add subscription status to user profile

### Phase 3.5: Integration & Testing (Priority 3)
- [ ] Test free tier limits (1 plan, 50 queries/month)
- [ ] Test premium tier (unlimited)
- [ ] Test upgrade flow (free → premium)
- [ ] Test downgrade flow (premium → free)
- [ ] Test error messages and upgrade prompts
- [ ] Update E2E tests with subscription scenarios

---

## Success Criteria

### Functional Requirements
- [ ] Free users limited to 1 training plan
- [ ] Free users limited to 50 queries per month
- [ ] Premium users have unlimited access
- [ ] Upgrade/downgrade flows work correctly
- [ ] Error messages clearly indicate subscription limits
- [ ] Usage tracking resets monthly

### Non-Functional Requirements
- [ ] Subscription checks add <50ms latency
- [ ] Database queries optimized (indexed columns)
- [ ] Error messages consistent across all endpoints
- [ ] UI clearly displays subscription status
- [ ] Upgrade prompts are non-intrusive

---

## Risk Assessment

### High Risk
1. **Data Migration:** Adding subscription tier to existing users
   - **Mitigation:** Default all existing users to 'free', provide grace period
2. **Usage Tracking:** Retroactive tracking not possible
   - **Mitigation:** Start tracking from migration date, reset counts

### Medium Risk
1. **Performance:** Subscription checks on every request
   - **Mitigation:** Cache subscription status, use middleware efficiently
2. **UX:** Blocking users may cause frustration
   - **Mitigation:** Clear messaging, easy upgrade path

### Low Risk
1. **Testing:** Complex subscription scenarios
   - **Mitigation:** Comprehensive E2E tests, manual QA

---

## Timeline Estimate

- **Phase 3.1 (Database):** 2 hours
- **Phase 3.2 (Services):** 4 hours
- **Phase 3.3 (API):** 3 hours
- **Phase 3.4 (Frontend):** 4 hours
- **Phase 3.5 (Testing):** 3 hours
- **Total:** ~16 hours

---

## Files to Create (9 new files)

1. `database/migrations/003_add_subscription_tier.sql`
2. `backend/src/middleware/subscription-check.ts`
3. `backend/src/routes/subscription.routes.ts`
4. `backend/src/services/subscription-service.ts`
5. `backend/src/services/usage-tracker.ts`
6. `backend/src/utils/subscription-errors.ts`
7. `backend/src/config/subscription-tiers.ts`
8. `frontend/src/components/UpgradePrompt.tsx`
9. `frontend/src/sections/SubscriptionSection.tsx`

## Files to Modify (6 existing files)

1. `database/schema.sql`
2. `backend/src/routes/training-plan.routes.ts`
3. `backend/src/routes/chat.routes.ts`
4. `backend/src/services/training-plan-service.ts`
5. `frontend/src/sections/DashboardSection.tsx`
6. `frontend/src/sections/PricingSection.tsx`

---

**Total Gaps:** 15 critical gaps
**Total Files:** 15 files (9 new, 6 modified)
**Estimated Effort:** 16 hours
