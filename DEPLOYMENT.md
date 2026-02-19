# pace42 Deployment Guide

Production-ready deployment package for pace42.ai - AI Running Coach

## What's Working

- ✅ **User Authentication** - Signup/Login with JWT tokens
- ✅ **Real Weather Data** - Live weather from Open-Meteo API
- ✅ **Chat Interface** - Intent classification and AI responses
- ✅ **Training Plans** - Create and manage training plans
- ✅ **Garmin Connect** - Store credentials (Garmin data fetch ready)

## Project Structure

```
pace42/
├── app/                    # Frontend React application
│   ├── dist/              # Built production files
│   ├── src/               # Source code
│   └── package.json       # Frontend dependencies
├── backend/               # Backend API server (Node.js)
│   ├── src/server.js      # Main server file
│   ├── data/              # User data storage
│   └── package.json
├── agent-service/         # AI Agent Service (Python)
│   ├── src/main.py        # FastAPI application
│   ├── src/agents/        # Agent implementations
│   ├── requirements.txt   # Python dependencies
│   └── venv/              # Virtual environment (created on setup)
├── start-services.sh      # Start both backend services
├── start-local.sh         # Start everything including frontend
└── README.md              # Quick reference
```

---

## Quick Start (macOS)

### Prerequisites

```bash
# Install Node.js 18+
brew install node

# Install Python 3.11+
brew install python3
```

### Option 1: One-Command Start (Everything)

```bash
cd /path/to/pace42
./start-local.sh
```

This starts:
- Agent Service (Python) on port 5001
- Backend (Node.js) on port 3000  
- Frontend on port 5173

### Option 2: Start Services Only (Backend + Agent)

```bash
./start-services.sh
```

Then in another terminal:
```bash
cd app
npx serve dist -p 5173
```

### Option 3: Manual Start (Full Control)

**Terminal 1 - Agent Service:**
```bash
cd agent-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn src.main:app --host 0.0.0.0 --port 5001
```

**Terminal 2 - Backend:**
```bash
cd backend
npm start
```

**Terminal 3 - Frontend:**
```bash
cd app
npx serve dist -p 5173
```

---

## Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Main application |
| Backend Health | http://localhost:3000/health | Backend status |
| Agent Health | http://localhost:5001/health | Agent service status |

---

## Testing the APIs

### Test Weather API

```bash
# Test weather endpoint
curl -X POST http://localhost:5001/running-conditions \
  -H "Content-Type: application/json" \
  -d '{"latitude": 37.7749, "longitude": -122.4194}'
```

### Test Chat API

```bash
# First, login to get a token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "password123"}'

# Then use the token for chat
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "What is the weather like?", "location": {"latitude": 37.7749, "longitude": -122.4194}}'
```

---

## Configuration

### Backend Environment Variables

Create `backend/.env`:

```bash
PORT=3000
JWT_SECRET=your-super-secret-key-change-this
DATA_DIR=./data
AGENT_SERVICE_URL=http://localhost:5001
```

### Agent Service Environment Variables

Create `agent-service/.env`:

```bash
PORT=5001
```

### Frontend Environment Variables

Create `app/.env`:

```bash
VITE_BACKEND_API_URL=http://localhost:3000
```

---

## API Endpoints

### Backend (Port 3000)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/api/v1/auth/signup` | POST | No | Create account |
| `/api/v1/auth/login` | POST | No | Login |
| `/api/v1/auth/validate-garmin` | POST | Yes | Connect Garmin |
| `/api/v1/chat` | POST | Yes | Send chat message |
| `/api/v1/chat/health` | GET | No | Chat service health |
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
| `/generate-plan` | POST | Generate training plan |

---

## Troubleshooting

### Agent Service Won't Start

```bash
# Check Python version
python3 --version  # Should be 3.11+

# Recreate virtual environment
cd agent-service
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Backend Won't Start

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process using port 3000
kill -9 $(lsof -t -i :3000)
```

### Weather Not Working

1. Check agent service is running: `curl http://localhost:5001/health`
2. Check backend can reach agent: `curl http://localhost:3000/health`
3. Ensure location permissions are enabled in browser

### Chat Not Responding

1. Check you're logged in (valid JWT token)
2. Check backend health: `curl http://localhost:3000/health`
3. Check agent service health: `curl http://localhost:5001/health`

---

## Production Deployment

### 1. Deploy Agent Service

```bash
cd agent-service
# Using PM2
pm2 start "python3 -m uvicorn src.main:app --host 0.0.0.0 --port 5001" --name pace42-agent

# Or using Docker
docker build -t pace42-agent .
docker run -p 5001:5001 pace42-agent
```

### 2. Deploy Backend

```bash
cd backend
npm install -g pm2
pm2 start src/server.js --name pace42-backend
```

### 3. Deploy Frontend

Build with production backend URL:
```bash
cd app
export VITE_BACKEND_API_URL=https://api.yourdomain.com
npm run build
# Deploy dist/ folder to your static hosting
```

---

## Security Checklist

Before production deployment:

- [ ] Change `JWT_SECRET` to a secure random string (32+ chars)
- [ ] Enable HTTPS for all services
- [ ] Set up proper CORS origins (not `*`)
- [ ] Configure firewall rules
- [ ] Set up log rotation
- [ ] Enable automated backups for data directory
- [ ] Remove any test accounts

---

## Next Steps for Garmin Integration

To enable real Garmin data fetching:

1. Set up Garmin Developer account
2. Configure OAuth credentials
3. Implement Garmin MCP client
4. Update agent service to fetch real run data

See `GARMIN_DEVELOPER_SETUP.md` in the r42 docs for details.
