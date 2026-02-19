#!/bin/bash

# ============================================
# Running Coach App - Development Startup
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo "🏃 Starting Running Coach App (Development Mode)..."
echo ""

# Check if setup has been run
if [ ! -f "config/.env" ]; then
    echo -e "${RED}❌ Configuration not found!${NC}"
    echo "   Please run ./scripts/setup.sh first"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down services...${NC}"
    kill $BACKEND_PID $AGENT_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $AGENT_PID $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Create logs directory
mkdir -p logs

# Start Backend API
echo -e "${BLUE}📦 Starting Backend API...${NC}"
cd backend
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"
cd ..

# Wait a bit for backend to start
sleep 2

# Start Agent Service
echo -e "${BLUE}🤖 Starting Agent Service...${NC}"
cd agent-service
source venv/bin/activate
python -m uvicorn src.main:app --reload --port 5000 > ../logs/agent-service.log 2>&1 &
AGENT_PID=$!
echo "   PID: $AGENT_PID"
deactivate
cd ..

# Wait a bit for agent service to start
sleep 2

# Start Frontend
echo -e "${BLUE}⚛️  Starting Frontend...${NC}"
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ All services started!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Services:"
echo "   Frontend:      ${GREEN}http://localhost:5173${NC}"
echo "   Backend API:   ${GREEN}http://localhost:3000${NC}"
echo "   Agent Service: ${GREEN}http://localhost:5000${NC}"
echo ""
echo "📊 Health Checks:"
echo "   Backend:  ${GREEN}http://localhost:3000/health${NC}"
echo "   Agents:   ${GREEN}http://localhost:5000/health${NC}"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f logs/backend.log"
echo "   Agents:   tail -f logs/agent-service.log"
echo "   Frontend: tail -f logs/frontend.log"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all processes
wait $BACKEND_PID $AGENT_PID $FRONTEND_PID

# Made with Bob
