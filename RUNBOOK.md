# RUNBOOK

## Objective
Deliver a stable, multi-user AI running coach app with secure Garmin integration, reliable analysis, and production-grade operational workflows.

## Product Goal
Enable each user to:
- Create an account and securely connect their Garmin credentials once.
- Ask questions and receive personalized coaching based on their own Garmin data.
- Maintain isolated data per user across sessions.

## Phase Plan (Roadmap)

### Phase 0 - Multi-User Garmin Stabilization
Goal: per-user Garmin isolation across connect/disconnect and sessions.
- Complete per-request token exchange and Vault credential storage.
- Ensure token isolation and MCP client cleanup.
- Acceptance: User A/B connect different accounts and only see their own data.

### Phase 1 - Data Normalization Reliability
Goal: eliminate normalization-related failures for single and multi-run analysis.
- Harden normalizer and chart generation against missing or partial data.
- Add regression tests for Garmin data variations.
- Acceptance: no "data normalization failed" responses in 10 consecutive runs.

### Phase 2 - Automated Regression Testing
Goal: single command smoke test covering auth + Garmin + analysis flows.
- Implement scripted end-to-end tests.
- Add pass/fail criteria and artifacts/logs.
- Acceptance: tests pass on clean startup with Vault.

### Phase 3 - Feature Completion and UX Consistency
Goal: finish remaining product gaps with clear UX.
- Subscription gating and plan flow.
- Consistent errors and user messaging.
- Acceptance: all core flows usable without manual workarounds.

### Phase 4 - Hardening and Release Readiness
Goal: production quality and observability.
- Error taxonomy and structured logging.
- Performance testing for concurrency.
- Acceptance: zero critical issues and documented runbook.

#### Phase 4 Test Steps
1. Verify error responses include `code` + `requestId` across auth, chat, training-plan, and subscription APIs.
2. Confirm request correlation headers: `X-Request-Id` returned and present in logs.
3. Run perf smoke: `pace42-final/scripts/perf-smoke.sh` with `PACE42_TEST_TOKEN` set.
4. Capture p50/p95 latencies + error rates; ensure no 5xx spikes.

## Team Operating Model
- Lead sets direction and approves merges.
- Coder implements assigned tasks only.
- Tester runs assigned tests and admin tasks.
- Work is tracked in TEAM_SYNC.md.

## Definition of Done (DoD)
- Code changes are scoped to the phase and reviewed by Lead.
- Tests run and recorded.
- No new P0/P1 issues introduced.
- Logs show no regressions for the tested flow.

## Issue Log (Template)
- P0: blocks primary flow (login/connect/analyze/chat).
- P1: major degradation (wrong user data, broken charts).
- P2: minor/edge issues.

## Test Matrix (Minimum)
1. Signup -> login -> logout.
2. Connect Garmin -> ask "Analyze my last run".
3. Disconnect Garmin -> reconnect with another user.
4. Multi-user: User A/B isolation check.
5. Weather query without Garmin.

## Environment and Ops Rules
- Vault must be running and unsealed for credential workflows.
- .env is auto-synced from Vault via scripts/start.sh.
- All services must be restarted after backend/agent-service changes.

## Data Reset / Seed Guidance
- For clean testing, create fresh test users through UI.
- Keep test credentials out of logs where possible.

## Candidate New Features (Post-Stabilization)
- Garmin credential health check (pre-flight test endpoint).
- User-visible data freshness status (last sync time).
- Optional activity import range selector.
- Coach memory of training phases and injury notes.
- Admin dashboard for session and token health.

## Change Control
- All work on codex/* branches.
- No direct commits to main.
- Merge to main requires explicit user approval.
