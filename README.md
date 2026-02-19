# pace42 - AI Running Coach

Production deployment package for pace42.ai with real weather data integration.

## What's Working

- ✅ **User Authentication** - Signup/Login with JWT tokens, password hashing
- ✅ **Real Weather Data** - Live weather from Open-Meteo API (free, no key needed)
- ✅ **Chat Interface** - Intent classification and AI coaching responses
- ✅ **Training Plans** - Create and manage training plans
- ✅ **Garmin Connect** - Store credentials (ready for data fetch)

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────────┐
│   Frontend  │──────▶│   Backend   │──────▶│  Agent Service  │
│  (React)    │      │  (Node.js)  │      │    (Python)     │
│  Port 5173  │      │  Port 3000  │      │   Port 5001     │
└─────────────┘      └─────────────┘      └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Open-Meteo API │
                                               │  (Weather Data) │
                                               └─────────────────┘
```

## Quick Start (Mac)

### Prerequisites
```bash
brew install node python3
```

### Start Everything (One Command)
```bash
./start-local.sh
```

Then open http://localhost:5173

### Or Start Services Only
```bash
./start-services.sh
```

Then in another terminal:
```bash
cd app && npx serve dist -p 5173
```

## Services

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React app |
| Backend | http://localhost:3000 | Node.js API |
| Agent | http://localhost:5001 | Python AI service |

## Testing

### Test Weather API
```bash
curl -X POST http://localhost:5001/running-conditions \
  -H "Content-Type: application/json" \
  -d '{"latitude": 37.7749, "longitude": -122.4194}'
```

### Test Backend Health
```bash
curl http://localhost:3000/health
```

## Project Structure

```
pace42/
├── app/                 # Frontend (React + Vite)
├── backend/             # Backend (Node.js)
├── agent-service/       # AI Service (Python/FastAPI)
├── start-local.sh       # Start everything
├── start-services.sh    # Start backend services only
└── DEPLOYMENT.md        # Full documentation
```

## Configuration

### Backend (.env)
```bash
PORT=3000
JWT_SECRET=change-this-in-production
AGENT_SERVICE_URL=http://localhost:5001
```

### Agent Service (.env)
```bash
PORT=5001
```

## API Endpoints

### Backend (Port 3000)
- `POST /api/v1/auth/signup` - Create account
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/validate-garmin` - Connect Garmin
- `POST /api/v1/chat` - Send message (requires auth)

### Agent Service (Port 5001)
- `POST /running-conditions` - Get weather for location
- `POST /classify-intent` - Classify message intent
- `POST /ask-coach` - Ask coach a question

## Troubleshooting

**Agent won't start:**
```bash
cd agent-service
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Port already in use:**
```bash
kill -9 $(lsof -t -i :3000)
kill -9 $(lsof -t -i :5001)
```

## Documentation

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment guide.
