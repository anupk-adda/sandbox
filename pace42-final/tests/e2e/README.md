# E2E Test Suite for pace42

End-to-end testing for the complete auth + Garmin + analysis flow.

## Quick Start

```bash
# Set required environment variables
export PACE42_TEST_USERNAME=testuser
export PACE42_TEST_PASSWORD=password123
export PACE42_GARMIN_USERNAME=your-garmin-email@example.com
export PACE42_GARMIN_PASSWORD=your-garmin-password

# Run all tests
cd /path/to/pace42-final
./scripts/test-e2e.sh
```

## Environment Variables

### Required
- `PACE42_TEST_USERNAME` - Test user username for pace42
- `PACE42_TEST_PASSWORD` - Test user password for pace42
- `PACE42_GARMIN_USERNAME` - Garmin Connect username/email
- `PACE42_GARMIN_PASSWORD` - Garmin Connect password

**Password policy:** The backend requires at least 8 chars with uppercase, lowercase, number, and special char. If the password doesn’t meet this policy, signup is skipped and the tests will attempt login only.

### Optional Timeouts
- `PACE42_TIMEOUT` - Request timeout in seconds (default: 60)

### Optional (for multi-user isolation tests)
- `PACE42_TEST_USERNAME_B` - Second test user username
- `PACE42_TEST_PASSWORD_B` - Second test user password
- `PACE42_GARMIN_USERNAME_B` - Second Garmin Connect username/email
- `PACE42_GARMIN_PASSWORD_B` - Second Garmin Connect password

### Configuration
- `PACE42_BASE_URL` - Base URL for backend (default: `http://localhost:3000`)

## Test Scenarios

### Scenario 1: New User Flow
Tests the complete onboarding flow:
1. User signup (or login if user exists)
2. Garmin account connection
3. Query: "Analyze my last run"
4. Query: "Compare my last 3 runs"
5. Garmin disconnection

**Expected Duration:** ~15 seconds

### Scenario 2: Reconnect Flow
Tests returning user experience:
1. User login
2. Garmin account reconnection
3. Query: "How were my recent runs?"

**Expected Duration:** ~10 seconds

### Scenario 3: Multi-User Isolation (Optional)
Tests data isolation between users:
1. Setup User A with Garmin
2. Setup User B with Garmin
3. Query User A data
4. Query User B data
5. Verify no data leakage

**Expected Duration:** ~20 seconds
**Note:** Only runs if secondary credentials are provided

## Running Tests

### Full Test Suite
```bash
./scripts/test-e2e.sh
```

### Run Specific Scenarios
```bash
# Run only Scenario 1 and 2 (skip multi-user)
cd tests/e2e
source venv/bin/activate
pytest -v -m "not multiuser" test_auth_garmin_flow.py
```

### Run with Verbose Output
```bash
cd tests/e2e
source venv/bin/activate
pytest -v --tb=long test_auth_garmin_flow.py
```

### Run Specific Test
```bash
cd tests/e2e
source venv/bin/activate
pytest -v test_auth_garmin_flow.py::TestScenario1NewUserFlow::test_03_query_last_run
```

## Test Results

### Exit Codes
- `0` - All tests passed
- `1` - One or more tests failed
- `2` - Services failed to start
- `3` - Health checks failed

### Log Files
All logs are stored in `logs/` directory with timestamps:
- `e2e-test-YYYYMMDD-HHMMSS.log` - Main test execution log
- `e2e-backend-YYYYMMDD-HHMMSS.log` - Backend logs during test
- `e2e-agent-YYYYMMDD-HHMMSS.log` - Agent service logs during test
- `e2e-results-YYYYMMDD-HHMMSS.json` - Structured test results

### Results JSON Format
```json
{
  "timestamp": "2026-02-21T10:00:00Z",
  "duration_seconds": 45,
  "tests_passed": 3,
  "tests_failed": 0,
  "total_tests": 3,
  "success": true,
  "logs": {
    "test_log": "/path/to/e2e-test-20260221-100000.log",
    "backend_log": "/path/to/e2e-backend-20260221-100000.log",
    "agent_log": "/path/to/e2e-agent-20260221-100000.log"
  }
}
```

## Prerequisites

### System Requirements
- Python 3.10+
- Node.js 18+
- Bash shell
- curl (for health checks)

### Services
The test harness will automatically start services if not running:
- HashiCorp Vault (port 8200)
- Backend API (port 3000)
- Agent Service (port 5001)
- Frontend (port 5173)

### Test Data
- Valid Garmin Connect credentials
- At least one activity in Garmin Connect account

## Troubleshooting

### Services Won't Start
```bash
# Check if ports are in use
lsof -i :3000
lsof -i :5001
lsof -i :8200

# Stop existing services
./scripts/stop.sh

# Try starting manually
./scripts/start.sh
```

### Authentication Failures
```bash
# Verify credentials are set
echo $PACE42_TEST_USERNAME
echo $PACE42_GARMIN_USERNAME

# Check backend logs
tail -f logs/backend.log

# Check agent logs
tail -f logs/agent-service.log
```

### Garmin Connection Issues
- Verify Garmin credentials are correct
- Check if Garmin Connect is accessible
- Ensure MFA is not enabled on Garmin account (or use app-specific password)
- Check agent service logs for detailed error messages

### Test Timeouts
```bash
# Increase timeout in test_auth_garmin_flow.py
# Edit line: TIMEOUT = 30  # Increase to 60 or more
```

### Python Environment Issues
```bash
# Recreate virtual environment
rm -rf tests/e2e/venv
python3 -m venv tests/e2e/venv
source tests/e2e/venv/bin/activate
pip install -r tests/e2e/requirements.txt
```

## Development

### Adding New Tests
1. Add test methods to appropriate scenario class in `test_auth_garmin_flow.py`
2. Follow naming convention: `test_NN_description`
3. Use assertions with clear error messages
4. Update this README with new test descriptions

### Test Markers
- `@pytest.mark.multiuser` - Tests requiring secondary credentials
- Add custom markers in `pytest.ini` if needed

### Running Tests Locally During Development
```bash
# Start services manually
./scripts/start.sh

# Run tests without orchestrator
cd tests/e2e
source venv/bin/activate
pytest -v test_auth_garmin_flow.py

# Keep services running for faster iteration
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run E2E Tests
        env:
          PACE42_TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
          PACE42_TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
          PACE42_GARMIN_USERNAME: ${{ secrets.GARMIN_USERNAME }}
          PACE42_GARMIN_PASSWORD: ${{ secrets.GARMIN_PASSWORD }}
        run: ./scripts/test-e2e.sh
```

## Security Notes

- **Never commit credentials** to version control
- Use environment variables or secrets management
- Test credentials should be separate from production
- Logs are sanitized to avoid exposing passwords
- Consider using Vault for credential storage in CI/CD

## Performance Benchmarks

Expected test durations on typical hardware:
- Scenario 1 (New User Flow): 12-15 seconds
- Scenario 2 (Reconnect Flow): 8-10 seconds
- Scenario 3 (Multi-User): 15-20 seconds
- **Total Suite:** 35-45 seconds

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review TEAM_SYNC.md for recent changes
3. Consult RUNBOOK.md for operational procedures
4. Check PHASE2_TEST_HARNESS_PLAN.md for design decisions

## Version History

- **v1.0** (2026-02-21) - Initial implementation
  - 3 test scenarios
  - Bash orchestrator
  - Python pytest suite
  - Comprehensive logging
