# pace42 Startup Guide

This guide documents how to start and stop the pace42 AI Running Coach services with full AI/Garmin integration.

## Active Services Structure

The **active** services are located in `/Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final/`:

```
pace42-final/
├── agent-service/          # Python FastAPI + LangGraph AI agents
│   ├── src/
│   │   ├── main.py        # FastAPI entry point
│   │   ├── agents/        # AI agent implementations
│   │   ├── llm/           # LLM providers (OpenAI, WatsonX)
│   │   ├── mcp/           # Garmin MCP client
│   │   └── prompts/       # AI prompts
│   ├── venv/              # Python virtual environment
│   └── requirements.txt
├── backend/                # Node.js/TypeScript API
│   ├── src/
│   ├── dist/              # Compiled JavaScript
│   └── package.json
├── frontend/               # React/Vite web app
│   ├── src/
│   └── dist/              # Production build
├── config/                 # Configuration files
│   ├── .env               # API keys and secrets
│   ├── llm.config.json    # LLM provider settings
│   └── app.config.json    # App configuration
├── logs/                   # Service logs
│   ├── agent-service.log
│   ├── backend.log
│   └── frontend.log
└── scripts/
    └── start.sh           # Unified startup script
```

## Services Overview

| Service | Port | Technology | Description |
|---------|------|------------|-------------|
| Agent Service | 5001 | Python/FastAPI | AI agents with OpenAI LLM + Garmin MCP integration |
| Backend | 3000 | Node.js/TypeScript | REST API, authentication, data persistence |
| Frontend | 5173 | React/Vite | Web user interface |

## Quick Start

### Start All Services

```bash
cd /Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final
./scripts/start.sh
```

This script will:
1. Start the Python Agent Service (port 5001)
2. Build and start the Node.js Backend (port 3000)
3. Build and start the React Frontend (port 5173)

### Stop All Services

Press `Ctrl+C` in the terminal running the services, or:

```bash
# Kill all pace42 services
pkill -f "uvicorn src.main:app"
pkill -f "node dist/server.js"
pkill -f "npx serve dist"
```

## Service Details

### Agent Service (Port 5001)

**Location**: `pace42-final/agent-service/`

**Features**:
- OpenAI GPT-4o-mini for AI analysis
- Garmin MCP integration for activity data
- Intent classification
- Run analysis with charts
- Fitness trend analysis

**Health Check**:
```bash
curl http://localhost:5001/health
```

**Manual Start**:
```bash
cd /Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final/agent-service
source venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 5001 --reload
```

**Log Location**: `pace42-final/logs/agent-service.log`

### Backend (Port 3000)

**Location**: `pace42-final/backend/`

**Features**:
- User authentication (JWT)
- Training plans API
- Chat endpoint (routes to AI agents)
- SQLite database

**Health Check**:
```bash
curl http://localhost:3000/health
```

**Manual Start**:
```bash
cd /Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final/backend
npm start
```

**Log Location**: `pace42-final/logs/backend.log`

### Frontend (Port 5173)

**Location**: `pace42-final/frontend/`

**Features**:
- React-based web UI
- Real-time chat with AI coach
- Training plan visualization
- Garmin data display

**Access**: http://localhost:5173

**Manual Start**:
```bash
cd /Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final/frontend
npx serve dist -p 5173
```

**Log Location**: `pace42-final/logs/frontend.log`

## Configuration

### API Keys

Edit `/Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final/config/.env`:

```bash
# OpenAI API Key (required for AI features)
OPENAI_API_KEY=sk-your-key-here

# Session secret (change for production)
SESSION_SECRET=your-secret-key

# Environment
NODE_ENV=development
```

### LLM Provider

Edit `/Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final/config/llm.config.json`:

```json
{
  "provider": "openai",
  "openai": {
    "enabled": true,
    "model": "gpt-4o-mini"
  }
}
```

## Troubleshooting

### Port Already in Use

If you see "Port X in use", kill existing processes:

```bash
kill -9 $(lsof -t -i :5001) 2>/dev/null
kill -9 $(lsof -t -i :3000) 2>/dev/null
kill -9 $(lsof -t -i :5173) 2>/dev/null
```

### API Key Issues

If AI features return errors:
1. Check the API key in `config/.env`
2. Verify the key at https://platform.openai.com/api-keys
3. Restart the agent service

### Garmin Connection Issues

Check Garmin MCP configuration in `config/app.config.json`:
```json
"mcp": {
  "garmin": {
    "command": "/Users/anupk/devops/mcp/garmin_mcp/.venv/bin/python",
    "args": ["/Users/anupk/devops/mcp/garmin_mcp/garmin_mcp_server.py"]
  }
}
```

## Viewing Logs

```bash
# Agent Service
tail -f /Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final/logs/agent-service.log

# Backend
tail -f /Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final/logs/backend.log

# Frontend
tail -f /Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final/logs/frontend.log
```

## API Endpoints

### Backend (Port 3000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/auth/signup` | POST | User registration |
| `/api/v1/auth/login` | POST | User login |
| `/api/v1/chat` | POST | Chat with AI coach |
| `/api/v1/training-plans/active` | GET | Get active training plan |

### Agent Service (Port 5001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/classify-intent` | POST | Classify user intent (AI) |
| `/analyze-latest-run` | POST | Analyze latest Garmin run |
| `/analyze-fitness-trends` | POST | Analyze fitness trends |
| `/running-conditions` | POST | Get weather-based conditions |

## Development Notes

- **Active services are in `pace42-final/`** - other directories contain older/test versions
- The `start.sh` script handles building TypeScript and setting up Python venv
- First startup may take 1-2 minutes for dependency installation
- Garmin data requires valid Garmin credentials in the MCP server

## Support

For issues, check:
1. Service logs in `pace42-final/logs/`
2. Browser console for frontend errors
3. Network tab for API request failures
