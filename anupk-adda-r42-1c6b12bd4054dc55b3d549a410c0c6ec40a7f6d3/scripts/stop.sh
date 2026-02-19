#!/bin/bash

# ============================================
# Running Coach App - Shutdown Script
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

echo "🛑 Stopping Running Coach App..."
echo ""

# Function to stop a service by PID file
stop_service_by_pid() {
    local service_name=$1
    local pid_file="$PID_DIR/${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        
        if kill -0 $pid 2>/dev/null; then
            echo -e "${YELLOW}Stopping $service_name (PID: $pid)...${NC}"
            kill $pid 2>/dev/null
            
            # Wait up to 10 seconds for graceful shutdown
            local count=0
            while kill -0 $pid 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            # Force kill if still running
            if kill -0 $pid 2>/dev/null; then
                echo -e "${RED}   Force stopping $service_name...${NC}"
                kill -9 $pid 2>/dev/null
            fi
            
            echo -e "${GREEN}✓ $service_name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name not running (stale PID file)${NC}"
        fi
        
        rm -f "$pid_file"
    fi
}

# Function to stop processes by pattern
stop_by_pattern() {
    local pattern=$1
    local service_name=$2
    
    local pids=$(pgrep -f "$pattern" 2>/dev/null)
    
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Stopping $service_name processes...${NC}"
        for pid in $pids; do
            if kill -0 $pid 2>/dev/null; then
                echo "   Stopping PID: $pid"
                kill $pid 2>/dev/null
                
                # Wait briefly
                sleep 1
                
                # Force kill if still running
                if kill -0 $pid 2>/dev/null; then
                    kill -9 $pid 2>/dev/null
                fi
            fi
        done
        echo -e "${GREEN}✓ $service_name processes stopped${NC}"
    fi
}

# Stop services by PID files first (if they exist)
stop_service_by_pid "frontend"
stop_service_by_pid "agent"
stop_service_by_pid "backend"

echo ""
echo "🧹 Cleaning up any remaining processes..."
echo ""

# Kill processes on our ports
for port in 3000 5000 5173; do
    pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Freeing port $port...${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
done

echo ""

# Stop backend processes (nodemon, tsx, node server)
stop_by_pattern "nodemon.*tsx.*src/server.ts" "Backend (nodemon)"
stop_by_pattern "tsx src/server.ts" "Backend (tsx)"
stop_by_pattern "npx tsx src/server.ts" "Backend (tsx production)"
stop_by_pattern "node.*dist/server.js" "Backend (compiled)"

# Stop agent service processes
stop_by_pattern "uvicorn.*src.main:app" "Agent Service"
stop_by_pattern "python.*src/main.py" "Agent Service (direct)"

# Stop frontend processes
stop_by_pattern "vite.*frontend" "Frontend (Vite dev)"
stop_by_pattern "vite preview" "Frontend (Vite preview)"
stop_by_pattern "serve.*dist" "Frontend (serve)"

# Additional cleanup for any R42 project processes
cd "$PROJECT_ROOT"
PROJECT_NAME=$(basename "$PROJECT_ROOT")
stop_by_pattern "node.*$PROJECT_NAME/backend" "Backend (any)"
stop_by_pattern "node.*$PROJECT_NAME/frontend" "Frontend (any)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ All services stopped${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Made with Bob