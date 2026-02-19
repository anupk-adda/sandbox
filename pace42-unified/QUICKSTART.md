# pace42 Unified - Quick Start

## What You Get

A **single, unified backend** that combines:
1. ✅ **Authentication** (signup/login with JWT tokens)
2. ✅ **Garmin Integration** (credential storage)
3. ✅ **Weather Agent** (real data from Open-Meteo)
4. ✅ **Chat Interface** (intent classification + AI responses)

## Architecture

```
Frontend (Port 5173)
    ↓
Backend (Port 3000) - Auth + API Gateway
    ↓
Agent Service (Port 5001) - Weather + AI
    ↓
Open-Meteo API (Real Weather Data)
```

## Quick Start

### Option 1: One Command

```bash
cd /mnt/okcomputer/output/pace42-unified
./scripts/start.sh
```

Then open http://localhost:5173

### Option 2: Manual Start

**Terminal 1 - Agent Service:**
```bash
cd agent-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn src.main:app --host 0.0.0.0 --port 5001
```

**Terminal 2 - Backend:**
```bash
cd backend
npm start
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npx serve dist -p 5173
```

## Testing

### Test Weather API
```bash
curl -X POST http://localhost:5001/running-conditions \
  -H "Content-Type: application/json" \
  -d '{"latitude": 37.7749, "longitude": -122.4194}'
```

### Test Full Flow
```bash
# 1. Sign up
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "password123"}'

# 2. Login (save the token)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "password123"}'

# 3. Chat with weather
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "What is the weather?", "location": {"latitude": 37.7749, "longitude": -122.4194}}'
```

## What's Working

| Feature | Status |
|---------|--------|
| User Signup/Login | ✅ JWT with SHA-256 password hashing |
| Weather Data | ✅ **Real data from Open-Meteo** |
| Chat | ✅ Intent classification |
| Coach Q&A | ✅ Running advice |
| Garmin Connect | ✅ Credential storage |

## File Structure

```
pace42-unified/
├── agent-service/          # Python FastAPI with weather agent
├── backend/               # Node.js with auth + agent client
├── frontend/              # React app (pre-built)
├── database/              # User data storage
├── logs/                  # Service logs
├── scripts/
│   └── start.sh           # One-command startup
├── config/
│   └── .env.example       # Environment template
├── README.md              # Full documentation
└── QUICKSTART.md          # This file
```

## Troubleshooting

### "Agent service call failed"
The agent service isn't running. Start it manually:
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

## Next Steps for Garmin Data

To enable real Garmin data fetching:
1. Set up Garmin MCP server
2. Update agent service to use it
3. Restart services
