# Phase 4: Hardening & Release Readiness Checklist

## Objective
Raise reliability and observability to production-ready levels with consistent error taxonomy, structured logging, and basic concurrency performance testing.

---

## 1. Error Taxonomy (Backend + Agent)
**Goal:** consistent error codes and response shapes across API and agent.

### Required Decisions
- Define error categories and codes (example):
  - `AUTH_INVALID_TOKEN`
  - `AUTH_EXPIRED_TOKEN`
  - `VALIDATION_ERROR`
  - `GARMIN_CONNECT_FAILED`
  - `SUBSCRIPTION_PLAN_LIMIT`
  - `SUBSCRIPTION_QUERY_LIMIT`
  - `RATE_LIMITED`
  - `INTERNAL_ERROR`

### Implementation Targets
- `backend/src/middleware/error-handler.ts`
  - Standardize response shape: `{ error: { code, message, statusCode, requestId } }`.
  - Map known errors to codes and status codes.
- `backend/src/routes/*` and `backend/src/services/*`
  - Throw `ApiError` with explicit `code` or use helper.
- `agent-service` error responses
  - Align response payload fields with backend taxonomy.

### Acceptance
- All non-2xx responses include `error.code` and `requestId`.
- Subscription and auth errors use defined codes.

---

## 2. Structured Logging + Correlation IDs
**Goal:** trace a request end-to-end with a single ID, minimal PII.

### Implementation Targets
- `backend/src/server.ts`
  - Add request ID middleware (UUID per request) and attach to logger meta.
- `backend/src/utils/logger.ts`
  - Ensure JSON log format includes `requestId`, `userId`, `route`, and `latencyMs` where available.
- `agent-service` logging
  - Ensure JSON logs (or at least structured fields), include `requestId` when proxied from backend.

### Data Hygiene
- Redact credentials, tokens, and Garmin usernames/passwords from logs.
- Ensure `TEAM_SYNC.md` never contains secrets.

### Acceptance
- A single request yields consistent `requestId` across backend + agent logs.

---

## 3. Performance & Concurrency Smoke Tests
**Goal:** confirm stability under light concurrent load.

### Proposed Script
- Create `scripts/perf-smoke.sh` or `scripts/perf-smoke.py`.
- Run 3 scenarios for 60 seconds each:
  1. `/health` @ 25 RPS
  2. `/api/v1/chat` @ 5 concurrent (authenticated, simple prompt)
  3. `/api/v1/training-plans/active` @ 10 concurrent

### Metrics to Capture
- p50/p95 latency
- error rate
- CPU/RAM snapshot (optional)

### Acceptance
- No 5xx spikes, error rate < 1% under smoke load.
- p95 <= 2.5s for chat in local env.

---

## 4. Runbook Updates
**Goal:** include Phase 4 ops steps and quality gates.

### Targets
- `RUNBOOK.md`
  - Add Phase 4 test steps and acceptance criteria.
- `CHECKPOINT_v2.1.md`
  - Update after Phase 4 completion.

---

## 5. Phase 4 DoD
- Error taxonomy applied across backend + agent.
- Structured logs with request correlation IDs.
- Perf smoke tests pass with documented results.
- Runbook updated.

