#!/bin/bash

# ============================================
# pace42 - Unified Startup Script
# Starts: r42 Agent Service + r42 Backend + My Frontend
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R42_DIR="$SCRIPT_DIR/anupk-adda-r42-1c6b12bd4054dc55b3d549a410c0c6ec40a7f6d3"
MY_FRONTEND="$SCRIPT_DIR/app"
LOG_DIR="$SCRIPT_DIR/logs"

echo "🏃 pace42 - Unified Startup"
echo "============================"
echo ""

# Create logs directory
mkdir -p "$LOG_DIR"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python: $(python3 --version)${NC}"

echo ""

# Function to check if a port is in use
check_port() {
    lsof -i :$1 > /dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    local port=$1
    if check_port $port; then
        echo -e "${YELLOW}  Port $port in use, stopping...${NC}"
        kill -9 $(lsof -t -i :$port) 2>/dev/null || true
        sleep 1
    fi
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    [ -n "$AGENT_PID" ] && kill $AGENT_PID 2>/dev/null && echo "  Agent stopped"
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null && echo "  Backend stopped"
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null && echo "  Frontend stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ============================================
# 1. Start Agent Service (from r42)
# ============================================
echo -e "${BLUE}🤖 Starting Agent Service (r42)...${NC}"
cd "$R42_DIR/agent-service"

# Create virtual environment if needed
if [ ! -d "venv" ]; then
    echo "  Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate and install dependencies
echo "  Installing dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt
deactivate

# Kill existing process on port 5001
kill_port 5001

# Start Agent Service
echo "  Starting on port 5001..."
source venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 5001 > "$LOG_DIR/agent-service.log" 2>&1 &
AGENT_PID=$!
deactivate

echo "  PID: $AGENT_PID"

# Wait for agent to start
echo "  Waiting for agent..."
for i in {1..30}; do
    if curl -s http://localhost:5001/health > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Agent ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}  ✗ Agent failed${NC}"
        echo "  Logs: tail -f $LOG_DIR/agent-service.log"
        exit 1
    fi
    sleep 1
done

echo ""

# ============================================
# 2. Start Backend (from r42)
# ============================================
echo -e "${BLUE}📦 Starting Backend (r42)...${NC}"
cd "$R42_DIR/backend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing npm dependencies..."
    npm install
fi

# Build TypeScript
echo "  Building TypeScript..."
npm run build

# Kill existing process on port 3000
kill_port 3000

# Start Backend
echo "  Starting on port 3000..."
npm start > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

echo "  PID: $BACKEND_PID"

# Wait for backend to start
echo "  Waiting for backend..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Backend ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}  ✗ Backend failed${NC}"
        echo "  Logs: tail -f $LOG_DIR/backend.log"
        kill $AGENT_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

echo ""

# ============================================
# 3. Start Frontend (my app)
# ============================================
echo -e "${BLUE}⚛️  Starting Frontend (pace42)...${NC}"
cd "$MY_FRONTEND"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing npm dependencies..."
    npm install
fi

# Build production
echo "  Building frontend..."
npm run build

# Kill existing process on port 5173
kill_port 5173

# Start Frontend
echo "  Starting on port 5173..."
npx serve dist -p 5173 > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

echo "  PID: $FRONTEND_PID"

echo ""

# ============================================
# Summary
# ============================================
echo "============================"
echo -e "${GREEN}✅ All services started!${NC}"
echo "============================"
echo ""
echo "🌐 Access your app:"
echo -e "   ${GREEN}http://localhost:5173${NC}"
echo ""
echo "🔧 Services:"
echo "   Frontend:  http://localhost:5173 (pace42 UI)"
echo "   Backend:   http://localhost:3000 (r42 API)"
echo "   Agent:     http://localhost:5001 (r42 Agent)"
echo ""
echo "📊 Health Checks:"
echo "   Backend:  curl http://localhost:3000/health"
echo "   Agent:    curl http://localhost:5001/health"
echo ""
echo "📝 Logs:"
echo "   tail -f $LOG_DIR/backend.log"
echo "   tail -f $LOG_DIR/agent-service.log"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all processes
wait $AGENT_PID $BACKEND_PID $FRONTEND_PID
