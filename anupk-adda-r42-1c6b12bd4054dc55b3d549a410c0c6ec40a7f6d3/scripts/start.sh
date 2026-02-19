#!/bin/bash

# ============================================
# Running Coach App - Production Startup
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
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_ROOT/pids"
LOG_DIR="$PROJECT_ROOT/logs"

# Create necessary directories
mkdir -p "$PID_DIR" "$LOG_DIR"

echo "🏃 Starting Running Coach App (Production Mode)..."
echo ""

# Check if setup has been run
if [ ! -f "$PROJECT_ROOT/config/.env" ]; then
    echo -e "${RED}❌ Configuration not found!${NC}"
    echo "   Please run ./scripts/setup.sh first"
    exit 1
fi

# Check if already running
if [ -f "$PID_DIR/backend.pid" ] || [ -f "$PID_DIR/agent.pid" ] || [ -f "$PID_DIR/frontend.pid" ]; then
    echo -e "${YELLOW}⚠️  Services may already be running${NC}"
    echo "   Run ./scripts/stop.sh first to stop existing services"
    exit 1
fi

# Start Backend API
echo -e "${BLUE}📦 Starting Backend API...${NC}"
cd "$PROJECT_ROOT/backend"

# Build and run compiled JS to avoid tsx IPC issues in restricted environments
echo "   Building backend..."
npm run build > "$LOG_DIR/backend-build.log" 2>&1
NODE_ENV=production node dist/server.js > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$PID_DIR/backend.pid"
echo "   PID: $BACKEND_PID"
cd "$PROJECT_ROOT"

# Wait for backend to start
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend failed to start${NC}"
    echo "   Check logs: tail -f $LOG_DIR/backend.log"
    exit 1
fi

# Start Agent Service
echo -e "${BLUE}🤖 Starting Agent Service...${NC}"
cd "$PROJECT_ROOT/agent-service"
source venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 5001 > "$LOG_DIR/agent-service.log" 2>&1 &
AGENT_PID=$!
echo $AGENT_PID > "$PID_DIR/agent.pid"
echo "   PID: $AGENT_PID"
deactivate
cd "$PROJECT_ROOT"

# Wait for agent service to start
sleep 3

# Check if agent service is running
if ! kill -0 $AGENT_PID 2>/dev/null; then
    echo -e "${RED}❌ Agent Service failed to start${NC}"
    echo "   Check logs: tail -f $LOG_DIR/agent-service.log"
    # Stop backend
    kill $BACKEND_PID 2>/dev/null
    rm -f "$PID_DIR/backend.pid"
    exit 1
fi

# Start Frontend (production build)
echo -e "${BLUE}⚛️  Starting Frontend...${NC}"
cd "$PROJECT_ROOT/frontend"

# Check if production build exists
if [ ! -d "dist" ]; then
    echo "   Building frontend for production..."
    npm run build
fi

# Use vite preview instead of serve
npm run preview -- --port 5173 --host > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$PID_DIR/frontend.pid"
echo "   PID: $FRONTEND_PID"
cd "$PROJECT_ROOT"

# Wait for frontend to start
sleep 2

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Frontend failed to start${NC}"
    echo "   Check logs: tail -f $LOG_DIR/frontend.log"
    # Stop other services
    kill $BACKEND_PID $AGENT_PID 2>/dev/null
    rm -f "$PID_DIR/backend.pid" "$PID_DIR/agent.pid"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ All services started successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Services:"
echo "   Frontend:      ${GREEN}http://localhost:5173${NC}"
echo "   Backend API:   ${GREEN}http://localhost:3000${NC}"
echo "   Agent Service: ${GREEN}http://localhost:5001${NC}"
echo ""
echo "📊 Health Checks:"
echo "   Backend:  ${GREEN}http://localhost:3000/health${NC}"
echo "   Agents:   ${GREEN}http://localhost:5001/health${NC}"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f $LOG_DIR/backend.log"
echo "   Agents:   tail -f $LOG_DIR/agent-service.log"
echo "   Frontend: tail -f $LOG_DIR/frontend.log"
echo ""
echo "🛑 To stop services:"
echo "   ${YELLOW}./scripts/stop.sh${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Made with Bob
