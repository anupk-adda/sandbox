# pace42 - Unified Backend

Clean, unified backend combining:
- ✅ **Authentication** (signup/login with JWT)
- ✅ **Garmin Integration** (credential storage)
- ✅ **Weather Agent** (real data from Open-Meteo)
- ✅ **Chat Interface** (intent classification + AI responses)

## Architecture

```
Frontend (:5173) → Backend (:3000) → Agent Service (:5001) → Open-Meteo API
```

## Quick Start

```bash
cd /mnt/okcomputer/output/pace42-unified
./scripts/start.sh
```

Then open http://localhost:5173

## Project Structure

```
pace42-unified/
├── agent-service/          # Python FastAPI
│   ├── src/
│   │   ├── main.py        # FastAPI app
│   │   └── agents/
│   │       └── weather_agent.py  # Real weather data
│   ├── requirements.txt
│   └── venv/              # Python virtual env (created on setup)
├── backend/               # Node.js API
│   ├── src/
│   │   └── server.js      # Auth + agent client
│   └── package.json
├── frontend/              # React app (copy from app/)
├── database/              # User data storage
│   └── users.json
├── logs/                  # Service logs
├── scripts/
│   └── start.sh           # One-command startup
├── config/
│   └── .env.example       # Environment template
└── README.md
```

## API Endpoints

### Backend (Port 3000)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/api/v1/auth/signup` | POST | No | Create account |
| `/api/v1/auth/login` | POST | No | Login |
| `/api/v1/auth/validate-garmin` | POST | Yes | Connect Garmin |
| `/api/v1/chat` | POST | Yes | Send message |
| `/api/v1/chat/health` | GET | No | Chat health |
| `/api/v1/training-plans/active` | GET | Yes | Get active plan |

### Agent Service (Port 5001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/running-conditions` | POST | Get weather for location |
| `/classify-intent` | POST | Classify message intent |
| `/analyze-latest-run` | POST | Analyze last run |
| `/analyze-fitness-trends` | POST | Analyze fitness trends |
| `/ask-coach` | POST | Ask coach a question |

## Testing

### Test Weather API
```bash
curl -X POST http://localhost:5001/running-conditions \
  -H "Content-Type: application/json" \
  -d '{"latitude": 37.7749, "longitude": -122.4194}'
```

### Test Full Flow
```bash
# Sign up
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "password123"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "password123"}'

# Chat with weather (use token from login)
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "What is the weather?", "location": {"latitude": 37.7749, "longitude": -122.4194}}'
```

## Troubleshooting

### "Agent service call failed"
Agent service isn't running:
```bash
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

## What's Working

| Feature | Status |
|---------|--------|
| User Auth | ✅ JWT with SHA-256 password hashing |
| Weather | ✅ **Real data from Open-Meteo** |
| Chat | ✅ Intent classification |
| Coach Q&A | ✅ Running advice |
| Garmin Connect | ✅ Credential storage |

## Next Steps for Garmin Data

To enable real Garmin data fetching, set up the Garmin MCP server and update the agent service to use it.
