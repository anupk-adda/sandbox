# Phase 2 Test Harness Plan
**Single-Command E2E Testing for pace42**

## Objective
Create a single-command test harness that validates the complete auth + Garmin + analysis flow, providing clear pass/fail results and detailed logs for debugging.

## Current Infrastructure Analysis

### Existing Scripts
1. **`scripts/start.sh`** - Comprehensive startup (Vault, Agent, Backend, Frontend)
   - Handles service initialization
   - Checks health endpoints
   - Manages process lifecycle
   - Creates logs directory

2. **`scripts/stop.sh`** - Service shutdown
   - Kills processes on ports 8200, 5001, 3000, 5173
   - Cleanup functionality

3. **`scripts/init-vault.sh`** - Vault initialization
   - Sets up Vault with credentials
   - Creates init file

### Existing Test Infrastructure
1. **Agent Service (Python)**
   - `agent-service/tests/test_normalizer_defensive.py` (19 tests)
   - pytest framework in place
   - Virtual environment with test dependencies

2. **Backend (Node.js)**
   - No test files found yet
   - TypeScript build system in place
   - Could add Jest or Mocha

3. **Frontend (React)**
   - No test files found yet
   - Vite build system
   - Could add Vitest or Jest

## Proposed Test Harness Architecture

### Option 1: Bash Script (Recommended for MVP)
**File:** `scripts/test-e2e.sh`

**Advantages:**
- Leverages existing bash infrastructure
- Easy to integrate with start.sh/stop.sh
- Simple to run: `./scripts/test-e2e.sh`
- No additional dependencies

**Structure:**
```bash
#!/bin/bash
# 1. Start services (call start.sh)
# 2. Wait for health checks
# 3. Run test scenarios:
#    - User signup
#    - Garmin connect
#    - Query analysis
#    - Disconnect
#    - Reconnect
# 4. Collect logs
# 5. Stop services (call stop.sh)
# 6. Report results (exit 0 for pass, 1 for fail)
```

### Option 2: Python Test Suite
**File:** `tests/e2e/test_full_flow.py`

**Advantages:**
- Structured test framework (pytest)
- Better assertions and error reporting
- Reusable test fixtures
- Integration with existing agent tests

**Structure:**
```python
# pytest-based e2e tests
# Uses requests library for API calls
# Validates responses and state
```

### Option 3: Node.js Test Suite
**File:** `tests/e2e/full-flow.test.ts`

**Advantages:**
- Native TypeScript support
- Can test backend directly
- Jest/Mocha ecosystem

**Structure:**
```typescript
// Jest/Mocha tests
// Uses supertest for API testing
// TypeScript type safety
```

## Recommended Approach: Hybrid

### Phase 2.1: Bash Orchestrator + Python Tests
1. **`scripts/test-e2e.sh`** - Main orchestrator
   - Starts services
   - Runs pytest suite
   - Collects logs
   - Stops services
   - Reports results

2. **`tests/e2e/test_auth_garmin_flow.py`** - Test scenarios
   - User signup/login
   - Garmin connect/disconnect
   - Analysis queries
   - Data validation

### Test Scenarios

#### Scenario 1: New User Flow
```
1. POST /api/v1/auth/signup (User A)
2. POST /api/v1/auth/login
3. POST /api/v1/auth/validate-garmin (credentials)
4. POST /api/v1/chat (query: "Analyze my last run")
5. Verify: Response contains activity data
6. POST /api/v1/auth/disconnect-garmin
7. Verify: garminConnected = false
```

#### Scenario 2: Reconnect Flow
```
1. POST /api/v1/auth/login (existing user)
2. POST /api/v1/auth/validate-garmin (same credentials)
3. POST /api/v1/chat (query: "Compare my last 3 runs")
4. Verify: Response contains comparison data
```

#### Scenario 3: Multi-User Isolation
```
1. Login User A
2. Login User B (different session)
3. Query User A data
4. Query User B data
5. Verify: No data leakage
```

### Success Criteria
- [ ] All test scenarios pass
- [ ] No service crashes
- [ ] Logs collected for each scenario
- [ ] Clear pass/fail reporting
- [ ] Exit code 0 for success, 1 for failure
- [ ] Run time < 5 minutes

### Log Collection
```
logs/
├── e2e-test-TIMESTAMP.log       # Main test log
├── e2e-backend-TIMESTAMP.log    # Backend logs during test
├── e2e-agent-TIMESTAMP.log      # Agent logs during test
└── e2e-results-TIMESTAMP.json   # Structured results
```

### Exit Codes
- `0` - All tests passed
- `1` - Test failures
- `2` - Service startup failed
- `3` - Service health check failed

## Implementation Plan

### Step 1: Create Bash Orchestrator
**File:** `scripts/test-e2e.sh`
- Start services
- Wait for health checks
- Run test suite
- Collect logs
- Stop services
- Report results

### Step 2: Create Python Test Suite
**File:** `tests/e2e/test_auth_garmin_flow.py`
- Setup: Get test credentials from testuser.md
- Test scenarios (3 scenarios above)
- Teardown: Cleanup test data

### Step 3: Add Test Dependencies
**File:** `tests/requirements.txt`
```
pytest>=7.4.0
requests>=2.31.0
pytest-timeout>=2.1.0
```

### Step 4: Documentation
**File:** `tests/e2e/README.md`
- How to run tests
- Test scenarios
- Troubleshooting

## Artifacts Required

### 1. Test Credentials
- Use existing `testuser.md` (not committed)
- Or environment variables
- Or Vault (for CI/CD)

### 2. Test Data
- Known activity IDs for validation
- Expected response structures
- Baseline metrics

### 3. Configuration
**File:** `tests/e2e/config.json`
```json
{
  "backend_url": "http://localhost:3000",
  "agent_url": "http://localhost:5001",
  "timeout": 30,
  "retry_attempts": 3
}
```

## Timeline Estimate
- **Step 1 (Bash orchestrator):** 2 hours
- **Step 2 (Python tests):** 3 hours
- **Step 3 (Dependencies):** 30 minutes
- **Step 4 (Documentation):** 1 hour
- **Total:** ~6.5 hours

## Risk Mitigation
1. **Service startup failures:** Add retry logic with exponential backoff
2. **Flaky tests:** Add timeout and retry mechanisms
3. **Test data dependencies:** Use mock data or seed database
4. **Environment differences:** Document prerequisites clearly

## Future Enhancements (Phase 3+)
- CI/CD integration (GitHub Actions)
- Performance benchmarks
- Load testing
- Frontend E2E (Playwright/Cypress)
- Docker containerization
- Parallel test execution

## Recommendation
**Start with Option 1 (Bash + Python hybrid)** for Phase 2:
1. Quick to implement
2. Leverages existing infrastructure
3. Easy to run locally
4. Foundation for future enhancements
5. Clear pass/fail reporting

**Command to run:**
```bash
./scripts/test-e2e.sh
```

**Expected output:**
```
🧪 pace42 E2E Test Suite
========================

✓ Services started
✓ Health checks passed

Running test scenarios...
  ✓ Scenario 1: New User Flow (12.3s)
  ✓ Scenario 2: Reconnect Flow (8.7s)
  ✓ Scenario 3: Multi-User Isolation (15.2s)

========================
✅ All tests passed! (36.2s)
========================

Logs: logs/e2e-test-20260221-180600.log
```
