#!/bin/bash

# ============================================
# pace42 - Complete Startup Script
# Starts Backend, Agent Service, and Frontend
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

echo "🏃 pace42 - Starting All Services"
echo "=================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required${NC}"
    echo "   Install: brew install node"
    exit 1
fi
echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required${NC}"
    echo "   Install: brew install python3"
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
        echo -e "${YELLOW}  Port $port in use, stopping existing process...${NC}"
        kill -9 $(lsof -t -i :$port) 2>/dev/null || true
        sleep 1
    fi
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    [ -n "$AGENT_PID" ] && kill $AGENT_PID 2>/dev/null && echo "  Agent service stopped"
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null && echo "  Backend stopped"
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null && echo "  Frontend stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ============================================
# Setup Agent Service (Python)
# ============================================
echo -e "${BLUE}🤖 Setting up Agent Service...${NC}"
cd "$PROJECT_ROOT/agent-service"

# Create virtual environment if needed
if [ ! -d "venv" ]; then
    echo "  Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate and install dependencies
echo "  Installing Python dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt
deactivate

# Kill existing process on port 5001
kill_port 5001

# Start Agent Service
echo "  Starting Agent Service on port 5001..."
source venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 5001 > "$PROJECT_ROOT/logs/agent-service.log" 2>&1 &
AGENT_PID=$!
deactivate

echo "  Agent PID: $AGENT_PID"

# Wait for agent to start
echo "  Waiting for agent service to start..."
for i in {1..30}; do
    if curl -s http://localhost:5001/health > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Agent service is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}  ✗ Agent service failed to start${NC}"
        echo "  Check logs: tail -f $PROJECT_ROOT/logs/agent-service.log"
        exit 1
    fi
    sleep 1
done

echo ""

# ============================================
# Setup Backend (Node.js)
# ============================================
echo -e "${BLUE}📦 Setting up Backend...${NC}"
cd "$PROJECT_ROOT/backend"

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
echo "  Starting Backend on port 3000..."
npm start > "$PROJECT_ROOT/logs/backend.log" 2>&1 &
BACKEND_PID=$!

echo "  Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "  Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Backend is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}  ✗ Backend failed to start${NC}"
        echo "  Check logs: tail -f $PROJECT_ROOT/logs/backend.log"
        kill $AGENT_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

echo ""

# ============================================
# Setup Frontend
# ============================================
echo -e "${BLUE}⚛️  Setting up Frontend...${NC}"
cd "$PROJECT_ROOT/frontend"

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
echo "  Starting Frontend on port 5173..."
npx serve dist -p 5173 > "$PROJECT_ROOT/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!

echo "  Frontend PID: $FRONTEND_PID"

echo ""

# ============================================
# Summary
# ============================================
echo "=================================="
echo -e "${GREEN}✅ All services started!${NC}"
echo "=================================="
echo ""
echo "🌐 Access your app:"
echo "   Frontend: ${GREEN}http://localhost:5173${NC}"
echo ""
echo "🔧 Services:"
echo "   Backend:   http://localhost:3000"
echo "   Agent:     http://localhost:5001"
echo ""
echo "📊 Health Checks:"
echo "   Backend:  curl http://localhost:3000/health"
echo "   Agent:    curl http://localhost:5001/health"
echo ""
echo "📝 Logs:"
echo "   tail -f $PROJECT_ROOT/logs/backend.log"
echo "   tail -f $PROJECT_ROOT/logs/agent-service.log"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all processes
wait $AGENT_PID $BACKEND_PID $FRONTEND_PID
