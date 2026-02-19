# Running Coach App - Scripts Documentation

This directory contains scripts for managing the Running Coach application.

## Available Scripts

### Setup Script
```bash
./scripts/setup.sh
```
**Purpose:** Initial setup of the application
- Checks prerequisites (Node.js, Python, npm)
- Installs all dependencies for backend, frontend, and agent service
- Creates configuration files from templates
- Initializes the database
- Sets up directory structure

**Run this first** before starting the application.

---

### Development Scripts

#### Start Development Mode
```bash
./scripts/start-dev.sh
```
**Purpose:** Start all services in development mode with hot-reload
- Backend: `npm run dev` (nodemon with tsx)
- Agent Service: `uvicorn --reload`
- Frontend: `npm run dev` (Vite dev server)
- Logs output to console and `logs/` directory
- Press `Ctrl+C` to stop all services

**Use for:** Active development with automatic reloading

---

### Production Scripts

#### Start Production Mode
```bash
./scripts/start.sh
```
**Purpose:** Start all services in production mode
- Backend: Runs compiled JavaScript from `dist/`
- Agent Service: Runs without reload
- Frontend: Serves production build from `dist/`
- Runs services as background processes
- Stores PIDs in `pids/` directory
- Logs to `logs/` directory

**Features:**
- Process management with PID files
- Graceful startup with health checks
- Automatic rollback if services fail to start
- Production-optimized builds

#### Stop Services
```bash
./scripts/stop.sh
```
**Purpose:** Stop all running services
- Gracefully stops all services using PID files
- Waits up to 10 seconds for graceful shutdown
- Force kills if necessary
- Cleans up PID files
- Removes stale processes

#### Restart Services
```bash
./scripts/restart.sh
```
**Purpose:** Restart all services
- Stops all services
- Waits 2 seconds
- Starts all services again

**Use for:** Applying configuration changes or updates

#### Check Status
```bash
./scripts/status.sh
```
**Purpose:** Check the status of all services
- Shows running status of each service
- Displays PID, port, and memory usage
- Checks health endpoints
- Shows recent log entries

**Output includes:**
- Service status (running/stopped)
- Process information (PID, memory, uptime)
- Port listening status
- Health check results
- Recent log entries

---

## Service Ports

| Service | Port | Health Check |
|---------|------|--------------|
| Frontend | 5173 | http://localhost:5173 |
| Backend API | 3000 | http://localhost:3000/health |
| Agent Service | 5000 | http://localhost:5000/health |

---

## Directory Structure

```
scripts/
├── setup.sh          # Initial setup
├── start-dev.sh      # Development mode
├── start.sh          # Production mode
├── stop.sh           # Stop services
├── restart.sh        # Restart services
├── status.sh         # Check status
└── README.md         # This file

pids/                 # Process ID files (created at runtime)
├── backend.pid
├── agent.pid
└── frontend.pid

logs/                 # Log files (created at runtime)
├── backend.log
├── agent-service.log
└── frontend.log
```

---

## Typical Workflows

### First Time Setup
```bash
# 1. Run setup
./scripts/setup.sh

# 2. Configure credentials
nano config/.env
nano config/garmin.credentials.txt

# 3. Start in development mode
./scripts/start-dev.sh
```

### Development Workflow
```bash
# Start development servers
./scripts/start-dev.sh

# Make changes to code (auto-reloads)
# Press Ctrl+C when done
```

### Production Deployment
```bash
# Build and start production
./scripts/start.sh

# Check status
./scripts/status.sh

# View logs
tail -f logs/backend.log
tail -f logs/agent-service.log

# Stop when needed
./scripts/stop.sh
```

### Troubleshooting
```bash
# Check what's running
./scripts/status.sh

# View logs
tail -f logs/backend.log
tail -f logs/agent-service.log
tail -f logs/frontend.log

# Restart if issues
./scripts/restart.sh

# Or stop and start manually
./scripts/stop.sh
./scripts/start.sh
```

---

## Environment Variables

All scripts respect the following environment variables from `config/.env`:

- `NODE_ENV` - Node environment (development/production)
- `PORT` - Backend API port (default: 3000)
- `AGENT_SERVICE_PORT` - Agent service port (default: 5000)
- `DATABASE_PATH` - SQLite database path
- `OPENAI_API_KEY` - OpenAI API key
- `WATSONX_API_KEY` - WatsonX API key
- `GARMIN_CREDENTIALS_PATH` - Path to Garmin credentials

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **SQLite** 3
- **curl** (for health checks)
- **lsof** (for port checking)

---

## Notes

- All scripts should be run from the project root directory
- Scripts create necessary directories (`pids/`, `logs/`) automatically
- PID files prevent duplicate service instances
- Logs are appended, not overwritten
- Use `start-dev.sh` for development (hot reload)
- Use `start.sh` for production (optimized builds)

---

## Troubleshooting

### Services won't start
```bash
# Check if ports are in use
lsof -i :3000
lsof -i :5000
lsof -i :5173

# Check logs
tail -f logs/*.log

# Clean up and retry
./scripts/stop.sh
rm -rf pids/*
./scripts/start.sh
```

### Stale PID files
```bash
# Remove stale PIDs
rm -rf pids/*

# Or use stop script (handles stale PIDs)
./scripts/stop.sh
```

### Permission denied
```bash
# Make scripts executable
chmod +x scripts/*.sh
```

---

Made with Bob