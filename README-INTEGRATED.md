# pace42 - Integrated Application

This integrates **my frontend** with the **r42 backend services**.

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   My Frontend   │──────▶│   r42 Backend   │──────▶│  r42 Agent      │
│   (React/Vite)  │      │   (Node.js)     │      │  (Python)       │
│    Port 5173    │      │    Port 3000    │      │   Port 5001     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                       │
                                                       ▼
                                                ┌──────────────┐
                                                │ Open-Meteo   │
                                                │  (Weather)   │
                                                └──────────────┘
```

## Quick Start

### Option 1: One Command (Recommended)

```bash
cd /mnt/okcomputer/output
./start-pace42.sh
```

Then open http://localhost:5173

### Option 2: Manual Start

**Terminal 1 - Agent Service (r42):**
```bash
cd anupk-adda-r42-1c6b12bd4054dc55b3d549a410c0c6ec40a7f6d3/agent-service
source venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 5001
```

**Terminal 2 - Backend (r42):**
```bash
cd anupk-adda-r42-1c6b12bd4054dc55b3d549a410c0c6ec40a7f6d3/backend
npm run build
npm start
```

**Terminal 3 - Frontend (my app):**
```bash
cd app
npx serve dist -p 5173
```

## Services

| Service | Source | Port | Description |
|---------|--------|------|-------------|
| Frontend | `app/` | 5173 | My React UI with auth, chat, Garmin connect |
| Backend | `anupk-adda-r42/.../backend/` | 3000 | r42 Node.js API with auth routes |
| Agent | `anupk-adda-r42/.../agent-service/` | 5001 | r42 Python service with weather, AI |

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

# 2. Login (save token)
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
| User Signup/Login | ✅ JWT auth with r42 backend |
| Weather Data | ✅ Real from Open-Meteo via r42 agent |
| Chat | ✅ Intent classification + AI responses |
| Garmin Connect | ✅ Stores credentials (needs MCP for data) |
| Training Plans | ✅ Basic plan generation |

## Troubleshooting

### "Agent service call failed"

Agent service isn't running. Start it:
```bash
cd anupk-adda-r42-1c6b12bd4054dc55b3d549a410c0c6ec40a7f6d3/agent-service
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
tail -f logs/frontend.log
```

## File Structure

```
/mnt/okcomputer/output/
├── start-pace42.sh          # Main startup script
├── app/                      # My frontend (React + Vite)
│   ├── src/
│   │   ├── services/
│   │   │   ├── authService.ts    # Auth API client
│   │   │   └── chatService.ts    # Chat API client
│   │   └── ...
│   └── dist/                 # Built frontend
├── anupk-adda-r42-1c6b12bd4054dc55b3d549a410c0c6ec40a7f6d3/
│   ├── backend/              # r42 Node.js backend
│   │   ├── src/server.ts
│   │   └── ...
│   ├── agent-service/        # r42 Python agent service
│   │   ├── src/main.py
│   │   └── src/agents/
│   │       └── weather_agent.py   # Real weather data
│   └── config/
│       └── app.config.json
└── logs/                     # Service logs
```

## Next Steps for Garmin Data

To enable real Garmin data fetching:

1. Set up Garmin MCP server
2. Update `config/app.config.json`:
   ```json
   "mcp": {
     "garmin": {
       "command": "/path/to/python",
       "args": ["/path/to/garmin_mcp_server.py"]
     }
   }
   ```
3. Restart agent service

See `anupk-adda-r42-1c6b12bd4054dc55b3d549a410c0c6ec40a7f6d3/GARMIN_DEVELOPER_SETUP.md`
