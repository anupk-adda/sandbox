#!/bin/bash

# ============================================
# Running Coach App - Restart Script
# ============================================

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 Restarting Running Coach App..."
echo ""

# Stop services
echo -e "${YELLOW}Stopping services...${NC}"
"$SCRIPT_DIR/stop.sh"

echo ""
echo -e "${BLUE}Waiting 2 seconds...${NC}"
sleep 2

echo ""
echo -e "${GREEN}Starting services...${NC}"
"$SCRIPT_DIR/start.sh"

# Made with Bob