#!/bin/bash

# pace42 Unified Startup Script
# Starts Agent Service + Backend + Frontend

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🏃 pace42 - Unified Startup"
echo "============================"
echo ""

mkdir -p "$PROJECT_ROOT/logs"

check_port() {
    lsof -i :$1 > /dev/null 2>&1
}

kill_port() {
    local port=$1
    if check_port $port; then
        echo -e "${YELLOW}  Port $port in use, stopping...${NC}"
        kill -9 $(lsof -t -i :$port) 2>/dev/null || true
        sleep 1
    fi
}

cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    [ -n "$AGENT_PID" ] && kill $AGENT_PID 2>/dev/null && echo "  Agent stopped"
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null && echo "  Backend stopped"
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null && echo "  Frontend stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js required${NC}"
    exit 1
fi
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 required${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"
echo -e "${GREEN}✓ Python: $(python3 --version)${NC}"
echo ""

# ============================================
# 1. Start Agent Service
# ============================================
echo -e "${BLUE}🤖 Starting Agent Service...${NC}"
cd "$PROJECT_ROOT/agent-service"

if [ ! -d "venv" ]; then
    echo "  Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "  Installing dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt
deactivate

kill_port 5001

echo "  Starting on port 5001..."
source venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 5001 > "$PROJECT_ROOT/logs/agent-service.log" 2>&1 &
AGENT_PID=$!
deactivate

echo "  PID: $AGENT_PID"
echo "  Waiting for agent..."
for i in {1..30}; do
    if curl -s http://localhost:5001/health > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Agent ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}  ✗ Agent failed${NC}"
        echo "  Logs: tail -f $PROJECT_ROOT/logs/agent-service.log"
        exit 1
    fi
    sleep 1
done
echo ""

# ============================================
# 2. Start Backend
# ============================================
echo -e "${BLUE}📦 Starting Backend...${NC}"
cd "$PROJECT_ROOT/backend"

kill_port 3000

echo "  Starting on port 3000..."
npm start > "$PROJECT_ROOT/logs/backend.log" 2>&1 &
BACKEND_PID=$!

echo "  PID: $BACKEND_PID"
echo "  Waiting for backend..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Backend ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}  ✗ Backend failed${NC}"
        echo "  Logs: tail -f $PROJECT_ROOT/logs/backend.log"
        kill $AGENT_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done
echo ""

# ============================================
# 3. Start Frontend
# ============================================
echo -e "${BLUE}⚛️  Starting Frontend...${NC}"
cd "$PROJECT_ROOT/frontend"

if [ ! -d "node_modules" ]; then
    echo "  Installing npm dependencies..."
    npm install
fi

if [ ! -d "dist" ]; then
    echo "  Building frontend..."
    npm run build
fi

kill_port 5173

echo "  Starting on port 5173..."
npx serve dist -p 5173 > "$PROJECT_ROOT/logs/frontend.log" 2>&1 &
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
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:3000"
echo "   Agent:     http://localhost:5001"
echo ""
echo "📊 Health:"
echo "   Backend:  curl http://localhost:3000/health"
echo "   Agent:    curl http://localhost:5001/health"
echo ""
echo "📝 Logs:"
echo "   tail -f $PROJECT_ROOT/logs/backend.log"
echo "   tail -f $PROJECT_ROOT/logs/agent-service.log"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

wait $AGENT_PID $BACKEND_PID $FRONTEND_PID
