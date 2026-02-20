#!/bin/bash

# ============================================
# pace42 Unified - Complete Startup Script
# Starts Vault + Agent Service + Backend + Frontend
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

echo "🏃 pace42 Unified - Starting All Services"
echo "=========================================="
echo ""

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required${NC}"
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
    [ -n "$VAULT_PID" ] && kill $VAULT_PID 2>/dev/null && echo "  Vault stopped"
    [ -n "$AGENT_PID" ] && kill $AGENT_PID 2>/dev/null && echo "  Agent service stopped"
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null && echo "  Backend stopped"
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null && echo "  Frontend stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ============================================
# 1. Setup HashiCorp Vault
# ============================================
echo -e "${BLUE}🔐 Setting up HashiCorp Vault...${NC}"

VAULT_DIR="$PROJECT_ROOT/vault"
INIT_FILE="$VAULT_DIR/vault-init.json"

# Check if Vault needs initialization
if [ ! -f "$INIT_FILE" ] || [ ! -s "$INIT_FILE" ]; then
    echo -e "${YELLOW}  ⚠ Vault not initialized, running init-vault.sh...${NC}"
    cd "$PROJECT_ROOT"
    ./scripts/init-vault.sh > "$PROJECT_ROOT/logs/vault-setup.log" 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Vault initialized successfully${NC}"
    else
        echo -e "${RED}  ✗ Vault initialization failed${NC}"
        echo "  Check logs: $PROJECT_ROOT/logs/vault-setup.log"
    fi
else
    echo -e "${GREEN}  ✓ Vault already initialized${NC}"
fi

# Check if Vault is running
if pgrep -f "vault server" > /dev/null; then
    echo -e "${GREEN}  ✓ Vault is running${NC}"
    VAULT_PID=$(pgrep -f "vault server")
else
    # Start Vault if not running
    if [ -f "$VAULT_DIR/vault" ]; then
        cd "$VAULT_DIR"
        export VAULT_ADDR='http://127.0.0.1:8200'
        nohup ./vault server -config=vault-config.hcl > "$PROJECT_ROOT/logs/vault.log" 2>&1 &
        sleep 3
        if pgrep -f "vault server" > /dev/null; then
            echo -e "${GREEN}  ✓ Vault server started${NC}"
            VAULT_PID=$(pgrep -f "vault server")
            
            # Unseal Vault
            UNSEAL_KEY=$(cat vault-init.json | python3 -c "import json,sys; print(json.load(sys.stdin)['unseal_keys_b64'][0])")
            ./vault operator unseal "$UNSEAL_KEY" > /dev/null 2>&1
            echo -e "${GREEN}  ✓ Vault unsealed${NC}"
        else
            echo -e "${YELLOW}  ⚠ Vault failed to start, continuing without Vault${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ Vault binary not found, continuing without Vault${NC}"
    fi
fi

# ============================================
# 1b. Update .env from Vault
# ============================================
if [ -f "$INIT_FILE" ] && [ -s "$INIT_FILE" ]; then
    echo -e "${BLUE}📝 Updating .env from Vault...${NC}"
    
    # Extract Vault token from init file
    VAULT_ROOT_TOKEN=$(cat "$INIT_FILE" | python3 -c "import json,sys; print(json.load(sys.stdin)['root_token'])" 2>/dev/null)
    
    if [ -n "$VAULT_ROOT_TOKEN" ]; then
        ENV_FILE="$PROJECT_ROOT/config/.env"
        
        # Ensure config directory exists
        mkdir -p "$PROJECT_ROOT/config"
        
        # Create or update .env file
        if [ -f "$ENV_FILE" ]; then
            # Update existing .env
            # Remove old VAULT entries
            sed -i.bak '/^VAULT_ADDR=/d' "$ENV_FILE" 2>/dev/null || true
            sed -i.bak '/^VAULT_TOKEN=/d' "$ENV_FILE" 2>/dev/null || true
            rm -f "$ENV_FILE.bak" 2>/dev/null || true
            
            # Add VAULT configuration after the Vault Configuration comment or at the end
            if grep -q "HashiCorp Vault Configuration" "$ENV_FILE"; then
                # Add after the comment block
                sed -i.bak '/^# VAULT_TOKEN=/d' "$ENV_FILE" 2>/dev/null || true
                sed -i.bak '/^# VAULT_ADDR=/d' "$ENV_FILE" 2>/dev/null || true
                rm -f "$ENV_FILE.bak" 2>/dev/null || true
                
                # Use awk to insert after the Vault config section
                awk '
                    /^# ===.*Vault Configuration/ { in_vault=1 }
                    in_vault && /^# ===/ && !seen {
                        print
                        seen=1
                        next
                    }
                    in_vault && seen && !added && /^[^#]/ {
                        print "VAULT_ADDR=http://127.0.0.1:8200"
                        print "VAULT_TOKEN=" vault_token
                        added=1
                    }
                    { print }
                    END {
                        if (!added) {
                            print ""
                            print "# ============================================"
                            print "# HashiCorp Vault Configuration"
                            print "# ============================================"
                            print "VAULT_ADDR=http://127.0.0.1:8200"
                            print "VAULT_TOKEN=" vault_token
                        }
                    }
                ' vault_token="$VAULT_ROOT_TOKEN" "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
            else
                # Append to end of file
                echo "" >> "$ENV_FILE"
                echo "# ============================================" >> "$ENV_FILE"
                echo "# HashiCorp Vault Configuration" >> "$ENV_FILE"
                echo "# ============================================" >> "$ENV_FILE"
                echo "VAULT_ADDR=http://127.0.0.1:8200" >> "$ENV_FILE"
                echo "VAULT_TOKEN=$VAULT_ROOT_TOKEN" >> "$ENV_FILE"
            fi
        else
            # Create new .env file with template
            cat > "$ENV_FILE" << EOF
# pace42 Configuration
# Generated by start.sh - $(date)

# ============================================
# LLM Provider Settings
# ============================================
# OpenAI (Recommended for ease of use)
OPENAI_API_KEY=sk-your-openai-key-here

# OR WatsonX (IBM)
# WATSONX_API_KEY=your-watsonx-key
# WATSONX_PROJECT_ID=your-project-id
# WATSONX_URL=https://us-south.ml.cloud.ibm.com

# LLM Provider Selection (openai or watsonx)
LLM_PROVIDER=openai

# ============================================
# Session Security
# ============================================
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# ============================================
# Garmin MCP Server (Optional)
# ============================================
# Path to your Garmin MCP server Python executable
# GARMIN_MCP_PYTHON_PATH=/Users/anupk/devops/mcp/garmin_mcp/.venv/bin/python
# GARMIN_MCP_SERVER_PATH=/Users/anupk/devops/mcp/garmin_mcp/garmin_mcp_server.py

# ============================================
# Environment
# ============================================
NODE_ENV=development

# ============================================
# HashiCorp Vault Configuration (auto-populated by start.sh)
# ============================================
VAULT_ADDR=http://127.0.0.1:8200
VAULT_TOKEN=$VAULT_ROOT_TOKEN
EOF
        fi
        
        echo -e "${GREEN}  ✓ .env updated with Vault credentials${NC}"
        
        # Optionally fetch OpenAI key from Vault and update .env if it exists in Vault
        export VAULT_ADDR='http://127.0.0.1:8200'
        export VAULT_TOKEN="$VAULT_ROOT_TOKEN"
        
        if [ -f "$VAULT_DIR/vault" ]; then
            OPENAI_KEY=$("$VAULT_DIR/vault" kv get -mount=pace42 api-keys 2>/dev/null | grep -A1 "openai_key" | tail -1 | awk '{print $2}' || true)
            if [ -n "$OPENAI_KEY" ] && [ "$OPENAI_KEY" != "<value" ]; then
                # Update OPENAI_API_KEY in .env
                sed -i.bak "s/^OPENAI_API_KEY=.*/OPENAI_API_KEY=$OPENAI_KEY/" "$ENV_FILE" 2>/dev/null || true
                rm -f "$ENV_FILE.bak" 2>/dev/null || true
                echo -e "${GREEN}  ✓ OpenAI key synced from Vault${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ Could not extract Vault token, .env not updated${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Vault init file not found, .env not updated${NC}"
fi

echo ""

# ============================================
# 2. Run Database Migrations
# ============================================
echo -e "${BLUE}🗄️  Running database migrations...${NC}"

# Ensure database directory exists
mkdir -p "$PROJECT_ROOT/backend/database"

# Run migrations using Node.js script
cd "$PROJECT_ROOT/backend"
if [ -f "../database/migrations/002_auth_improvements.sql" ]; then
    node -e "
        const Database = require('better-sqlite3');
        const path = require('path');
        
        const dbPath = path.join(__dirname, 'database', 'running_coach.db');
        const db = new Database(dbPath);
        
        try {
            // Read and execute migration
            const fs = require('fs');
            const migration = fs.readFileSync('../database/migrations/002_auth_improvements.sql', 'utf8');
            
            // Split by semicolons and execute each statement
            const statements = migration.split(';').filter(s => s.trim());
            
            db.exec('BEGIN TRANSACTION;');
            for (const stmt of statements) {
                try {
                    db.exec(stmt + ';');
                } catch (e) {
                    // Ignore errors for IF NOT EXISTS statements
                    if (!e.message.includes('already exists')) {
                        throw e;
                    }
                }
            }
            db.exec('COMMIT;');
            console.log('✓ Database migrations applied');
        } catch (error) {
            db.exec('ROLLBACK;');
            console.error('Migration error:', error.message);
        } finally {
            db.close();
        }
    " 2>/dev/null || echo "  ⚠ Migrations may have already been applied"
fi

echo ""

# ============================================
# 3. Start Agent Service (Python)
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
# 4. Start Backend (Node.js)
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
# 5. Setup Frontend
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
echo "=========================================="
echo -e "${GREEN}✅ All services started!${NC}"
echo "=========================================="
echo ""
echo "🌐 Access your app:"
echo "   Frontend: ${GREEN}http://localhost:5173${NC}"
echo ""
echo "🔧 Services:"
echo "   Vault:     http://localhost:8200 (if configured)"
echo "   Backend:   http://localhost:3000"
echo "   Agent:     http://localhost:5001"
echo ""
echo "📊 Health Checks:"
echo "   Backend:  curl http://localhost:3000/health"
echo "   Agent:    curl http://localhost:5001/health"
echo "   Vault:    curl http://localhost:8200/v1/sys/health"
echo ""
echo "📝 Logs:"
echo "   tail -f $PROJECT_ROOT/logs/backend.log"
echo "   tail -f $PROJECT_ROOT/logs/agent-service.log"
echo "   tail -f $PROJECT_ROOT/logs/vault-setup.log"
echo ""
echo "📚 Documentation:"
echo "   STARTUP.md - Full startup and troubleshooting guide"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all processes
wait $AGENT_PID $BACKEND_PID $FRONTEND_PID
