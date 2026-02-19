#!/bin/bash

# ============================================
# Running Coach App - Setup Script
# ============================================

set -e  # Exit on error

echo "🏃 Setting up Running Coach App..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required but not installed.${NC}"
    echo "   Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is required but not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm found: $(npm --version)${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not installed.${NC}"
    echo "   Please install Python 3.10+ from https://www.python.org/"
    exit 1
fi
echo -e "${GREEN}✓ Python found: $(python3 --version)${NC}"

echo ""

# Setup Backend
echo "📦 Setting up Backend (Node.js/Express)..."
cd backend

if [ ! -f "package.json" ]; then
    npm init -y
    
    # Update package.json with proper configuration
    cat > package.json << 'EOF'
{
  "name": "running-coach-backend",
  "version": "1.0.0",
  "description": "Backend API for Running Coach App",
  "main": "dist/server.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "keywords": ["running", "coach", "api"],
  "author": "",
  "license": "ISC"
}
EOF
fi

echo "   Installing dependencies..."
npm install express cors dotenv better-sqlite3 axios winston helmet express-rate-limit uuid

echo "   Installing dev dependencies..."
npm install --save-dev typescript @types/node @types/express @types/cors @types/better-sqlite3 ts-node nodemon jest @types/jest eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser

if [ ! -f "tsconfig.json" ]; then
    echo "   Creating TypeScript config..."
    npx tsc --init --outDir dist --rootDir src --esModuleInterop --resolveJsonModule --lib es2020 --module commonjs --allowJs true --noImplicitAny true
fi

echo -e "${GREEN}✓ Backend setup complete${NC}"
cd ..

echo ""

# Setup Frontend
echo "⚛️  Setting up Frontend (React + TypeScript)..."
cd frontend

if [ ! -f "package.json" ]; then
    echo "   Creating Vite React app..."
    npm create vite@latest . -- --template react-ts
fi

echo "   Installing dependencies..."
npm install axios recharts date-fns lucide-react

echo "   Installing dev dependencies..."
npm install --save-dev @types/node

echo -e "${GREEN}✓ Frontend setup complete${NC}"
cd ..

echo ""

# Setup Agent Service
echo "🤖 Setting up Agent Service (Python/LangGraph)..."
cd agent-service

if [ ! -d "venv" ]; then
    echo "   Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "   Activating virtual environment..."
source venv/bin/activate

echo "   Installing Python dependencies..."
pip install --upgrade pip

# Create requirements.txt
cat > requirements.txt << 'EOF'
# LangChain and LangGraph
langgraph>=0.0.20
langchain>=0.1.0
langchain-openai>=0.0.5
langchain-core>=0.1.0

# Web framework
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.5.0

# Utilities
python-dotenv>=1.0.0
aiohttp>=3.9.0
httpx>=0.26.0

# Development
pytest>=7.4.0
pytest-asyncio>=0.21.0
black>=23.12.0
flake8>=7.0.0
mypy>=1.8.0
EOF

pip install -r requirements.txt

echo -e "${GREEN}✓ Agent Service setup complete${NC}"
deactivate
cd ..

echo ""

# Create config directory structure
echo "⚙️  Setting up configuration..."
mkdir -p config logs

if [ ! -f "config/.env" ]; then
    echo "   Creating .env file from template..."
    cp config/.env.example config/.env
    echo -e "${YELLOW}   ⚠️  Please edit config/.env with your actual credentials${NC}"
fi

if [ ! -f "config/garmin.credentials.txt" ]; then
    echo "   Creating Garmin credentials file from template..."
    cp config/garmin.credentials.txt.example config/garmin.credentials.txt
    chmod 600 config/garmin.credentials.txt
    echo -e "${YELLOW}   ⚠️  Please edit config/garmin.credentials.txt with your Garmin API credentials${NC}"
fi

echo -e "${GREEN}✓ Configuration setup complete${NC}"

echo ""

# Setup database
echo "💾 Setting up database..."
mkdir -p database/migrations database/backups

if [ ! -f "database/running_coach.db" ]; then
    echo "   Initializing SQLite database..."
    sqlite3 database/running_coach.db < database/schema.sql
    echo -e "${GREEN}✓ Database initialized${NC}"
else
    echo -e "${YELLOW}   Database already exists, skipping initialization${NC}"
fi

echo ""

# Create directory structure for backend
echo "📁 Creating backend directory structure..."
mkdir -p backend/src/{config,routes,controllers,services/{database,mcp-client,agent-client},models,middleware,utils}
mkdir -p backend/tests

# Create directory structure for agent service
echo "📁 Creating agent service directory structure..."
mkdir -p agent-service/src/{agents,orchestration,llm,training_plans,schemas,utils,prompts}
mkdir -p agent-service/tests

# Create directory structure for frontend
echo "📁 Creating frontend directory structure..."
mkdir -p frontend/src/{components,pages,services,hooks,types,utils}

echo ""

# Set permissions
echo "🔒 Setting file permissions..."
chmod +x scripts/*.sh
chmod 600 config/garmin.credentials.txt 2>/dev/null || true
chmod 600 config/.env 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Configure your credentials:"
echo "   ${YELLOW}nano config/.env${NC}"
echo "   ${YELLOW}nano config/garmin.credentials.txt${NC}"
echo ""
echo "2. Get your Garmin API credentials:"
echo "   Visit: https://connect.garmin.com/oauthConfirm"
echo ""
echo "3. Get your OpenAI API key:"
echo "   Visit: https://platform.openai.com/api-keys"
echo ""
echo "4. Start the development servers:"
echo "   ${GREEN}./scripts/start-dev.sh${NC}"
echo ""
echo "5. Access the application:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:3000"
echo "   Agents:    http://localhost:5000"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Documentation:"
echo "   - README.md"
echo "   - DEVELOPMENT_PLAN.md"
echo "   - IMPLEMENTATION_GUIDE.md"
echo ""

# Made with Bob
