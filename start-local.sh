#!/bin/bash

# pace42 Local Development Starter Script
# This script starts both backend and frontend for local testing

echo "🏃 pace42 Local Development Starter"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   brew install node"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    exit 0
}

trap cleanup INT TERM

# Start Backend
echo "${YELLOW}Starting Backend...${NC}"
cd "$SCRIPT_DIR/backend"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created backend/.env from template"
fi

npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend failed to start"
    exit 1
fi

echo "${GREEN}✅ Backend running on http://localhost:3000${NC}"
echo ""

# Start Frontend
echo "${YELLOW}Starting Frontend...${NC}"
cd "$SCRIPT_DIR/app"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Check if dist exists
if [ ! -d "dist" ]; then
    echo "🔨 Building frontend..."
    npm run build
fi

# Serve the built files
echo "🌐 Starting frontend server..."
npx serve dist -p 5173 &
FRONTEND_PID=$!

sleep 2

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "${GREEN}✅ Frontend running on http://localhost:5173${NC}"
echo ""
echo "===================================="
echo "🎉 pace42 is ready!"
echo ""
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3000"
echo "Health:   http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "===================================="

# Wait for both processes
wait
