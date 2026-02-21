#!/bin/bash

# ============================================
# pace42 E2E Test Harness
# Single-command end-to-end testing
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Timestamp for logs
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_DIR="$PROJECT_ROOT/logs"
TEST_LOG="$LOG_DIR/e2e-test-$TIMESTAMP.log"
BACKEND_LOG="$LOG_DIR/e2e-backend-$TIMESTAMP.log"
AGENT_LOG="$LOG_DIR/e2e-agent-$TIMESTAMP.log"
RESULTS_JSON="$LOG_DIR/e2e-results-$TIMESTAMP.json"

# Test result tracking
TESTS_PASSED=0
TESTS_FAILED=0
START_TIME=$(date +%s)

echo "🧪 pace42 E2E Test Suite"
echo "========================"
echo ""

# Create logs directory
mkdir -p "$LOG_DIR"

# Redirect all output to log file
exec > >(tee -a "$TEST_LOG")
exec 2>&1

echo "📋 Test Configuration"
echo "  Log file: $TEST_LOG"
echo "  Results:  $RESULTS_JSON"
echo ""

# Check required environment variables
echo "🔐 Checking credentials..."
if [ -z "$PACE42_TEST_USERNAME" ] || [ -z "$PACE42_TEST_PASSWORD" ]; then
    echo -e "${RED}❌ Missing required credentials${NC}"
    echo "  Required: PACE42_TEST_USERNAME, PACE42_TEST_PASSWORD"
    echo "  Required: PACE42_GARMIN_USERNAME, PACE42_GARMIN_PASSWORD"
    echo ""
    echo "Example:"
    echo "  export PACE42_TEST_USERNAME=testuser"
    echo "  export PACE42_TEST_PASSWORD=password123"
    echo "  export PACE42_GARMIN_USERNAME=garmin@example.com"
    echo "  export PACE42_GARMIN_PASSWORD=garminpass"
    exit 1
fi

if [ -z "$PACE42_GARMIN_USERNAME" ] || [ -z "$PACE42_GARMIN_PASSWORD" ]; then
    echo -e "${RED}❌ Missing required Garmin credentials${NC}"
    echo "  Required: PACE42_GARMIN_USERNAME, PACE42_GARMIN_PASSWORD"
    exit 1
fi

echo -e "${GREEN}✓ Primary credentials configured${NC}"

# Check optional secondary credentials for multi-user tests
if [ -n "$PACE42_TEST_USERNAME_B" ] && [ -n "$PACE42_TEST_PASSWORD_B" ]; then
    echo -e "${GREEN}✓ Secondary credentials configured (multi-user tests enabled)${NC}"
    MULTI_USER_ENABLED=true
else
    echo -e "${YELLOW}⚠ Secondary credentials not configured (multi-user tests disabled)${NC}"
    MULTI_USER_ENABLED=false
fi

echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Cleaning up...${NC}"
    
    # Stop services
    cd "$PROJECT_ROOT"
    if [ -f "scripts/stop.sh" ]; then
        ./scripts/stop.sh > /dev/null 2>&1 || true
    fi
    
    # Generate results JSON
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    cat > "$RESULTS_JSON" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration_seconds": $DURATION,
  "tests_passed": $TESTS_PASSED,
  "tests_failed": $TESTS_FAILED,
  "total_tests": $((TESTS_PASSED + TESTS_FAILED)),
  "success": $([ $TESTS_FAILED -eq 0 ] && echo "true" || echo "false"),
  "logs": {
    "test_log": "$TEST_LOG",
    "backend_log": "$BACKEND_LOG",
    "agent_log": "$AGENT_LOG"
  }
}
EOF
    
    echo ""
    echo "========================"
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✅ All tests passed! (${DURATION}s)${NC}"
    else
        echo -e "${RED}❌ $TESTS_FAILED test(s) failed (${DURATION}s)${NC}"
    fi
    echo "========================"
    echo ""
    echo "📊 Results: $RESULTS_JSON"
    echo "📝 Logs:"
    echo "   Test:    $TEST_LOG"
    echo "   Backend: $BACKEND_LOG"
    echo "   Agent:   $AGENT_LOG"
    echo ""
    
    exit $TESTS_FAILED
}

trap cleanup EXIT INT TERM

# ============================================
# 1. Start Services
# ============================================
echo -e "${BLUE}🚀 Starting services...${NC}"

cd "$PROJECT_ROOT"

# Check if services are already running
if curl -s http://localhost:3000/health > /dev/null 2>&1 && \
   curl -s http://localhost:5001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Services already running${NC}"
else
    echo "  Starting all services..."
    ./scripts/start.sh > /dev/null 2>&1 &
    START_PID=$!
    
    # Wait for services to start (max 60 seconds)
    echo "  Waiting for services to be ready..."
    for i in {1..60}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1 && \
           curl -s http://localhost:5001/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Services started successfully${NC}"
            break
        fi
        if [ $i -eq 60 ]; then
            echo -e "${RED}✗ Services failed to start within 60 seconds${NC}"
            exit 2
        fi
        sleep 1
    done
fi

echo ""

# ============================================
# 2. Health Checks
# ============================================
echo -e "${BLUE}🏥 Running health checks...${NC}"

# Backend health check
if curl -s http://localhost:3000/health | grep -q "ok"; then
    echo -e "${GREEN}✓ Backend health check passed${NC}"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
    exit 3
fi

# Agent service health check
if curl -s http://localhost:5001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Agent service health check passed${NC}"
else
    echo -e "${RED}✗ Agent service health check failed${NC}"
    exit 3
fi

echo ""

# ============================================
# 3. Setup Python Test Environment
# ============================================
echo -e "${BLUE}🐍 Setting up Python test environment...${NC}"

cd "$PROJECT_ROOT"

# Create tests/e2e directory if it doesn't exist
mkdir -p tests/e2e

# Check if virtual environment exists
if [ ! -d "tests/e2e/venv" ]; then
    echo "  Creating virtual environment..."
    python3 -m venv tests/e2e/venv
fi

# Activate virtual environment
source tests/e2e/venv/bin/activate

# Install test dependencies
if [ -f "tests/e2e/requirements.txt" ]; then
    echo "  Installing test dependencies..."
    pip install -q -r tests/e2e/requirements.txt
else
    echo -e "${YELLOW}⚠ requirements.txt not found, installing minimal dependencies${NC}"
    pip install -q pytest requests pytest-timeout
fi

echo -e "${GREEN}✓ Python environment ready${NC}"
echo ""

# ============================================
# 4. Run E2E Tests
# ============================================
echo -e "${BLUE}🧪 Running E2E test scenarios...${NC}"
echo ""

# Copy backend and agent logs before tests
cp "$PROJECT_ROOT/logs/backend.log" "$BACKEND_LOG" 2>/dev/null || touch "$BACKEND_LOG"
cp "$PROJECT_ROOT/logs/agent-service.log" "$AGENT_LOG" 2>/dev/null || touch "$AGENT_LOG"

# Run pytest with environment variables
cd "$PROJECT_ROOT/tests/e2e"

# Set pytest options
PYTEST_OPTS="-v --tb=short --color=yes"

# Add multi-user marker if secondary credentials are available
if [ "$MULTI_USER_ENABLED" = true ]; then
    python -m pytest $PYTEST_OPTS test_auth_garmin_flow.py
else
    python -m pytest $PYTEST_OPTS -m "not multiuser" test_auth_garmin_flow.py
fi

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All test scenarios passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo ""
    echo -e "${RED}✗ Some test scenarios failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Deactivate virtual environment
deactivate

# Copy updated logs after tests
cp "$PROJECT_ROOT/logs/backend.log" "$BACKEND_LOG" 2>/dev/null || true
cp "$PROJECT_ROOT/logs/agent-service.log" "$AGENT_LOG" 2>/dev/null || true

echo ""

# Cleanup will be called by trap
