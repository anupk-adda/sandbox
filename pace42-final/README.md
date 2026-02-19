# pace42 - Unified Application

Complete running coach application with:
- ✅ **Frontend** (React) - User registration, Garmin connect, chat interface
- ✅ **Backend** (Node.js/Express) - Auth, intent classification, agent routing
- ✅ **Agent Service** (Python/FastAPI) - Weather, Garmin data via MCP, AI analysis

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────────┐      ┌──────────────┐
│   Frontend  │──────▶│   Backend   │──────▶│  Agent Service  │──────▶│  Garmin MCP  │
│   (React)   │      │  (Node.js)  │      │    (Python)     │      │   (Real Data) │
│   :5173     │      │    :3000    │      │     :5001       │      │              │
└─────────────┘      └─────────────┘      └─────────────────┘      └──────────────┘
                            │                                            │
                            ▼                                            ▼
                     ┌─────────────┐                              ┌──────────────┐
                     │   SQLite    │                              │ Open-Meteo   │
                     │  (Users,    │                              │  (Weather)   │
                     │  Context)   │                              │              │
                     └─────────────┘                              └──────────────┘
```

## Quick Start

```bash
cd /mnt/okcomputer/output/pace42-final
./scripts/start.sh
```

Then open http://localhost:5173

## What's Included

| Component | Technology | Port | Features |
|-----------|------------|------|----------|
| **Frontend** | React + Vite | 5173 | User auth, Garmin connect, chat UI |
| **Backend** | Node.js + Express | 3000 | Auth API, intent classifier, agent client |
| **Agent Service** | Python + FastAPI | 5001 | Weather agent, Garmin agents (via MCP), Coach agent |

## API Endpoints

### Auth (Backend)
- `POST /api/v1/auth/signup` - Create account
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/validate-garmin` - Connect Garmin
- `GET /api/v1/auth/me` - Get current user

### Chat (Backend)
- `POST /api/v1/chat` - Send message (classifies intent, routes to agent)
- `GET /api/v1/chat/health` - Health check

### Agent Service
- `POST /running-conditions` - Get weather for location
- `POST /analyze-latest-run` - Analyze last run (uses MCP)
- `POST /analyze-recent-runs` - Analyze recent runs (uses MCP)
- `POST /analyze-fitness-trends` - Analyze fitness trend (uses MCP)
- `POST /ask-coach` - General running questions

## Testing

### Test Weather
```bash
curl -X POST http://localhost:5001/running-conditions \
  -H "Content-Type: application/json" \
  -d '{"latitude": 37.7749, "longitude": -122.4194}'
```

### Test Auth
```bash
# Sign up
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "password123"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "password123"}'
```

### Test Chat
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "What is the weather?", "location": {"latitude": 37.7749, "longitude": -122.4194}}'
```

## File Structure

```
pace42-final/
├── agent-service/          # Python FastAPI
│   ├── src/
│   │   ├── main.py        # FastAPI app
│   │   ├── agents/        # Weather, Garmin, Coach agents
│   │   ├── mcp/           # MCP client for Garmin
│   │   └── llm/           # Watsonx provider
│   └── requirements.txt
├── backend/               # Node.js/Express
│   ├── src/
│   │   ├── server.ts      # Main server
│   │   ├── routes/
│   │   │   ├── chat.routes.ts      # Chat endpoint
│   │   │   ├── auth.routes.ts      # Auth endpoints (NEW)
│   │   │   └── training-plan.routes.ts
│   │   ├── services/
│   │   │   ├── agent-client/       # Agent service client
│   │   │   ├── database/           # SQLite service
│   │   │   ├── intent-classifier.ts
│   │   │   └── context-manager.ts
│   │   └── utils/
│   ├── package.json
│   └── tsconfig.json
├── frontend/              # React app (pre-built)
│   └── dist/              # Built files
├── database/
│   └── schema.sql         # Database schema
├── scripts/
│   └── start.sh           # One-command startup
└── README.md
```

## Troubleshooting

### "Agent service call failed"
```bash
# Check if agent is running
curl http://localhost:5001/health

# Start agent manually
cd agent-service
source venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 5001
```

### Port already in use
```bash
kill -9 $(lsof -t -i :5001)
kill -9 $(lsof -t -i :3000)
kill -9 $(lsof -t -i :5173)
```

### Check logs
```bash
tail -f logs/backend.log
tail -f logs/agent-service.log
```

## Environment Variables

Create `backend/.env`:
```
JWT_SECRET=your-secret-key
AGENT_SERVICE_URL=http://localhost:5001
```

Create `agent-service/.env`:
```
WATSONX_API_KEY=your-watsonx-key
WATSONX_PROJECT_ID=your-project-id
```

## Next Steps

1. **Configure Watsonx** - Add your Watsonx API key for AI analysis
2. **Configure Garmin MCP** - Set up Garmin MCP server with your credentials
3. **Restart agent service** - After Garmin credentials are saved

The Garmin username/password from frontend will be used to restart the MCP server dynamically.
