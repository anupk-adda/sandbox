#!/bin/bash

# ============================================
# pace42 Unified - Stop All Services Script
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🛑 pace42 Unified - Stopping All Services"
echo "=========================================="
echo ""

# Function to kill process on port
kill_port() {
    local port=$1
    local name=$2
    
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${YELLOW}  Stopping $name on port $port...${NC}"
        kill -9 $(lsof -t -i :$port) 2>/dev/null || true
        echo -e "${GREEN}  ✓ $name stopped${NC}"
    else
        echo -e "${GREEN}  ✓ $name not running${NC}"
    fi
}

# Stop Frontend
echo "📱 Stopping Frontend..."
kill_port 5173 "Frontend"

# Stop Backend
echo "📦 Stopping Backend..."
kill_port 3000 "Backend"

# Stop Agent Service
echo "🤖 Stopping Agent Service..."
kill_port 5001 "Agent Service"

echo ""
echo "=========================================="
echo -e "${GREEN}✅ All services stopped!${NC}"
echo "=========================================="
