# pace42 Quick Start Guide

## The Problem

Your error logs show:
```
Agent service call failed: fetch failed
ECONNREFUSED
```

This means the **Python agent service on port 5001 is NOT running**. The backend tries to connect to it but fails.

## The Solution

You need to start **3 services** in this order:

1. **Agent Service** (Python) - Port 5001 - Provides weather, AI responses
2. **Backend** (Node.js) - Port 3000 - API gateway, auth
3. **Frontend** - Port 5173 - React app

## Quick Start

### Step 1: Go to the r42 folder

```bash
cd /path/to/anupk-adda-r42-1c6b12bd4054dc55b3d549a410c0c6ec40a7f6d3
```

### Step 2: Run the startup script

```bash
./scripts/start-all.sh
```

This script will:
- ✅ Set up Python virtual environment
- ✅ Install Python dependencies
- ✅ Start Agent Service on port 5001
- ✅ Build and start Backend on port 3000
- ✅ Build and start Frontend on port 5173
- ✅ Wait for each service to be ready before starting the next

### Step 3: Access the app

Open http://localhost:5173

---

## Manual Start (If script fails)

### Terminal 1: Agent Service

```bash
cd agent-service

# Create virtual environment (first time only)
python3 -m venv venv

# Activate and install dependencies
source venv/bin/activate
pip install -r requirements.txt

# Start the service
python -m uvicorn src.main:app --host 0.0.0.0 --port 5001
```

**Verify it's running:**
```bash
curl http://localhost:5001/health
```

### Terminal 2: Backend

```bash
cd backend

# Install dependencies (first time only)
npm install

# Build TypeScript
npm run build

# Start the backend
npm start
```

**Verify it's running:**
```bash
curl http://localhost:3000/health
```

### Terminal 3: Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Build production
npm run build

# Serve the built files
npx serve dist -p 5173
```

---

## Testing the APIs

### Test Weather (requires agent service)

```bash
curl -X POST http://localhost:5001/running-conditions \
  -H "Content-Type: application/json" \
  -d '{"latitude": 37.7749, "longitude": -122.4194}'
```

### Test Backend Chat (requires agent service + backend)

```bash
# 1. Sign up
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "password123"}'

# 2. Login (save the token)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "password123"}'

# 3. Chat with weather (use token from login)
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "What is the weather?", "location": {"latitude": 37.7749, "longitude": -122.4194}}'
```

---

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────────┐      ┌──────────────┐
│   Frontend  │──────▶│   Backend   │──────▶│  Agent Service  │──────▶│  Open-Meteo  │
│   (React)   │      │  (Node.js)  │      │    (Python)     │      │   (Weather)  │
│   :5173     │      │    :3000    │      │     :5001       │      │              │
└─────────────┘      └─────────────┘      └─────────────────┘      └──────────────┘
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │ Garmin MCP   │
                                              │ (Optional)   │
                                              └──────────────┘
```

---

## Troubleshooting

### "Agent service call failed: fetch failed"

**Cause:** Agent service is not running on port 5001

**Fix:**
```bash
# Check if port 5001 is in use
lsof -i :5001

# Start agent service manually
cd agent-service
source venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 5001
```

### "Cannot find module" errors

**Fix:**
```bash
# Reinstall backend dependencies
cd backend
rm -rf node_modules package-lock.json
npm install
npm run build

# Reinstall agent service dependencies
cd agent-service
source venv/bin/activate
pip install -r requirements.txt
```

### Port already in use

**Fix:**
```bash
# Kill processes on specific ports
kill -9 $(lsof -t -i :5001)
kill -9 $(lsof -t -i :3000)
kill -9 $(lsof -t -i :5173)
```

---

## What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| User Auth | ✅ | Signup/Login with JWT |
| Weather | ✅ | Real data from Open-Meteo |
| Chat | ✅ | Intent classification + AI responses |
| Training Plans | ✅ | Basic plan generation |
| Garmin Connect | ⚠️ | Stores credentials, needs MCP setup for data |

---

## Next Steps for Garmin Integration

To enable real Garmin data fetching:

1. Set up Garmin MCP server (see `GARMIN_DEVELOPER_SETUP.md`)
2. Update `config/app.config.json` with MCP paths:
   ```json
   "mcp": {
     "garmin": {
       "command": "/path/to/python",
       "args": ["/path/to/garmin_mcp_server.py"]
     }
   }
   ```
3. Restart agent service

---

## File Locations

- **Backend:** `backend/src/server.ts`
- **Agent Service:** `agent-service/src/main.py`
- **Weather Agent:** `agent-service/src/agents/weather_agent.py`
- **Config:** `config/app.config.json`
- **Env:** `config/.env`
- **Startup Script:** `scripts/start-all.sh`
