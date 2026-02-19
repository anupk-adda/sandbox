#!/bin/bash

# pace42 Services Starter
# Starts both the Python agent service and Node backend

echo "🏃 pace42 Services Starter"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    if [ -n "$AGENT_PID" ]; then
        kill $AGENT_PID 2>/dev/null
        echo "  Agent service stopped"
    fi
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "  Backend stopped"
    fi
    exit 0
}

trap cleanup INT TERM

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    echo "   brew install python3"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   brew install node"
    exit 1
fi

echo "✅ Python $(python3 --version | cut -d' ' -f2) detected"
echo "✅ Node.js $(node --version) detected"
echo ""

# Install Python dependencies if needed
if [ ! -d "$SCRIPT_DIR/agent-service/venv" ]; then
    echo "${YELLOW}Setting up Python virtual environment...${NC}"
    cd "$SCRIPT_DIR/agent-service"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate
    cd "$SCRIPT_DIR"
fi

# Start Agent Service
echo "${YELLOW}Starting Agent Service (Python)...${NC}"
cd "$SCRIPT_DIR/agent-service"
source venv/bin/activate
python3 -m uvicorn src.main:app --host 0.0.0.0 --port 5001 --reload &
AGENT_PID=$!
deactivate
cd "$SCRIPT_DIR"

# Wait for agent service to start
echo "  Waiting for agent service to start..."
sleep 3

# Check if agent service is running
if ! kill -0 $AGENT_PID 2>/dev/null; then
    echo "${RED}❌ Agent service failed to start${NC}"
    exit 1
fi

# Test agent service health
curl -s http://localhost:5001/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Agent service running on http://localhost:5001${NC}"
else
    echo "${YELLOW}⚠️  Agent service starting, may need a moment...${NC}"
fi
echo ""

# Start Backend
echo "${YELLOW}Starting Backend (Node.js)...${NC}"
cd "$SCRIPT_DIR/backend"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "  Creating backend/.env from template"
    cp .env.example .env
fi

npm start &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Wait for backend to start
echo "  Waiting for backend to start..."
sleep 2

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "${RED}❌ Backend failed to start${NC}"
    kill $AGENT_PID 2>/dev/null
    exit 1
fi

# Test backend health
curl -s http://localhost:3000/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Backend running on http://localhost:3000${NC}"
else
    echo "${YELLOW}⚠️  Backend starting, may need a moment...${NC}"
fi
echo ""

echo "=========================="
echo "🎉 Services are starting up!"
echo ""
echo "Agent Service: http://localhost:5001"
echo "Backend:       http://localhost:3000"
echo "Health Check:  http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop both services"
echo "=========================="

# Wait for both processes
wait
