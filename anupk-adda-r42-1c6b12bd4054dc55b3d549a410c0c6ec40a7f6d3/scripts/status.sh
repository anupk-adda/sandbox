#!/bin/bash

# ============================================
# Running Coach App - Status Check Script
# ============================================

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_ROOT/pids"

echo "📊 Running Coach App - Status Check"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to check service status
check_service() {
    local service_name=$1
    local pid_file="$PID_DIR/${service_name}.pid"
    local port=$2
    
    echo -e "${BLUE}$service_name:${NC}"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        
        if kill -0 $pid 2>/dev/null; then
            echo -e "   Status: ${GREEN}✓ Running${NC}"
            echo "   PID: $pid"
            
            # Check if port is listening
            if [ -n "$port" ]; then
                if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
                    echo -e "   Port: ${GREEN}$port (listening)${NC}"
                else
                    echo -e "   Port: ${YELLOW}$port (not listening)${NC}"
                fi
            fi
            
            # Show memory usage
            local mem=$(ps -o rss= -p $pid 2>/dev/null | awk '{print int($1/1024)}')
            if [ -n "$mem" ]; then
                echo "   Memory: ${mem}MB"
            fi
            
            # Show uptime
            local start_time=$(ps -o lstart= -p $pid 2>/dev/null)
            if [ -n "$start_time" ]; then
                echo "   Started: $start_time"
            fi
        else
            echo -e "   Status: ${RED}✗ Not running (stale PID)${NC}"
            echo "   PID file: $pid_file"
        fi
    else
        echo -e "   Status: ${RED}✗ Not running${NC}"
        echo "   PID file: Not found"
    fi
    
    echo ""
}

# Check each service
check_service "Backend API" 3000
check_service "Agent Service" 5001
check_service "Frontend" 5173

# Check health endpoints
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}Health Checks:${NC}"
echo ""

# Backend health
if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    echo -e "   Backend API:   ${GREEN}✓ Healthy${NC} (http://localhost:3000/health)"
else
    echo -e "   Backend API:   ${RED}✗ Unhealthy${NC}"
fi

# Agent service health
if curl -s http://localhost:5001/health >/dev/null 2>&1; then
    echo -e "   Agent Service: ${GREEN}✓ Healthy${NC} (http://localhost:5001/health)"
else
    echo -e "   Agent Service: ${RED}✗ Unhealthy${NC}"
fi

# Frontend check
if curl -s http://localhost:5173 >/dev/null 2>&1; then
    echo -e "   Frontend:      ${GREEN}✓ Accessible${NC} (http://localhost:5173)"
else
    echo -e "   Frontend:      ${RED}✗ Not accessible${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show recent log entries
echo -e "${BLUE}Recent Logs:${NC}"
echo ""

if [ -f "$PROJECT_ROOT/logs/backend.log" ]; then
    echo "Backend (last 3 lines):"
    tail -n 3 "$PROJECT_ROOT/logs/backend.log" 2>/dev/null | sed 's/^/   /'
    echo ""
fi

if [ -f "$PROJECT_ROOT/logs/agent-service.log" ]; then
    echo "Agent Service (last 3 lines):"
    tail -n 3 "$PROJECT_ROOT/logs/agent-service.log" 2>/dev/null | sed 's/^/   /'
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Made with Bob