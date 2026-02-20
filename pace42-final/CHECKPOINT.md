# pace42 Unified - Checkpoint

**Date:** February 20, 2026  
**Version:** 1.2.2  
**Status:** Functional with known issues  
**Branch:** main (pace42-final)

---

## Executive Summary

Unified version of pace42.ai combining:
- **Frontend:** React-based landing page + chat interface from `app/` directory
- **Backend:** Working Node.js API from `anupk-adda-r42-...` with auth routes added
- **Agent Service:** Python service from `anupk-adda-r42-...` with OpenAI integration

**Known Issues (v1.2.2):**
- Garmin reconnect still fetches data from the previous account (MCP device binding)
- Plan subscription flow not fully wired for dashboard module

---

## Architecture

```
pace42-final/
├── frontend/                 # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── auth/         # Login, Signup, GarminConnect forms
│   │   │   ├── features/     # Weather + Run Analysis widgets
│   │   │   ├── ui/           # Shadcn UI components
│   │   │   ├── Chat.tsx      # Main chat interface
│   │   │   ├── Chat.css      # Chat & graph styles
│   │   │   └── Navigation.tsx
│   │   ├── sections/         # Landing page sections
│   │   │   ├── v2/           # V2 sections (Hero, Garmin, Weather, etc.)
│   │   │   └── DashboardSection.tsx  # NEW: Training plan dashboard
│   │   ├── services/
│   │   │   ├── authService.ts   # Auth state, JWT, session (30min)
│   │   │   └── chatService.ts   # API calls, chat messages
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── backend/                  # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.routes.ts       # NEW: JWT auth, login/signup
│   │   │   ├── chat.routes.ts       # Chat endpoints, intent routing
│   │   │   └── training-plan.routes.ts  # UPDATED: Auth middleware
│   │   ├── services/
│   │   │   ├── agent-client/        # HTTP client to Python agent
│   │   │   ├── database/            # SQLite wrapper
│   │   │   ├── training-plan-service.ts  # Plan creation/management
│   │   │   └── intent-classifier.ts
│   │   ├── server.ts
│   │   └── utils/
│   └── package.json
├── agent-service/            # Python + FastAPI
│   ├── src/
│   │   ├── agents/           # LLM agents
│   │   │   ├── base_agent.py
│   │   │   ├── current_run_analyzer.py
│   │   │   ├── fitness_trend_analyzer.py
│   │   │   ├── last_runs_comparator.py
│   │   │   └── weather_agent.py
│   │   ├── llm/              # LLM providers
│   │   │   ├── __init__.py
│   │   │   ├── openai_provider.py
│   │   │   └── watsonx_provider.py
│   │   ├── mcp/              # MCP client for Garmin
│   │   │   └── garmin_client_async.py
│   │   ├── utils/
│   │   │   └── chart_builder.py   # UPDATED: New chart designs
│   │   ├── main.py           # FastAPI app
│   │   └── config.py
│   └── requirements.txt
├── config/                   # Configuration files
│   ├── .env                  # API keys, secrets
│   ├── app.config.json
│   └── llm.config.json
├── database/
│   └── schema.sql            # SQLite schema
└── scripts/
    └── start.sh              # Unified startup script
```

---

## Services & Ports

| Service | Port | Tech Stack | Purpose |
|---------|------|------------|---------|
| Frontend | 5173 | React + Vite + TS | User interface |
| Backend | 3000 | Node.js + Express + TS | API gateway, auth, routing |
| Agent | 5001 | Python + FastAPI | LLM agents, Garmin MCP |

---

## Key Changes Made

### 1. Authentication System (NEW)

**Files:**
- `backend/src/routes/auth.routes.ts` (NEW)
- `frontend/src/services/authService.ts` (MODIFIED)

**Features:**
- JWT-based authentication with 30-minute expiry
- Proper password hashing with bcrypt
- Session persistence with localStorage
- Auto-logout on token expiry
- Middleware for protected routes

**API Endpoints:**
```
POST /api/v1/auth/signup      # Create account
POST /api/v1/auth/login       # Login
POST /api/v1/auth/validate-garmin  # Garmin credentials
GET  /api/v1/auth/me          # Current user
```

### 2. Training Plan Dashboard (NEW)

**Files:**
- `frontend/src/sections/DashboardSection.tsx` (NEW)
- `frontend/src/App.tsx` (MODIFIED - added route)
- `backend/src/routes/training-plan.routes.ts` (MODIFIED)

**Features:**
- `/dashboard` route for subscribed plans
- Shows active plan overview
- Weekly workout schedule
- Subscribe/unsubscribe functionality
- Persistent subscription status in database

**API Endpoints:**
```
GET  /api/v1/training-plans/active
GET  /api/v1/training-plans/subscription-status
POST /api/v1/training-plans/subscribe
```

### 3. Chart System Rebuild (v1.2.2)

**Files:**
- `frontend/src/features/run-analysis/*` (NEW)
- `frontend/src/features/weather/*` (NEW)
- `frontend/src/components/Chat.tsx` (MODIFIED)
- `agent-service/src/agents/current_run_analyzer.py` (MODIFIED)

**Changes:**
- Rebuilt **Run Analysis** chart as a dual-metric overlay with dark-mode selectors and tooltip.
- Rebuilt **Running Conditions** widget with Good/Fair/Poor bars and summary sentence.
- Charts now render **inside assistant responses** (no separate pages required).
- Legacy chart components archived under `backups/legacy-charts-src`.

### 4. Weather Conditions (v1.2.2)

**Changes:**
- Color-coded buckets aligned to thresholds:
  - GOOD: 10–22°C, rain <30%, no lightning, humidity <75%
  - FAIR: 23–30°C, rain 30–60%, light rain, humidity 75–85%
  - POOR: >30°C, rain >60%, thunder risk/heat index high, lightning detected

### 5. Unified Startup Script (NEW)

**Files:**
- `scripts/start.sh` (NEW)

**Features:**
- Starts all 3 services in order
- Installs dependencies if needed
- Health checks for each service
- Port conflict resolution

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,          -- NEW: For auth
    garmin_user_id TEXT UNIQUE,
    preferences TEXT DEFAULT '{}',
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Training Plans Tables
```sql
training_plans          -- Plan definitions
training_plan_weeks     -- Weekly schedule
training_plan_workouts  -- Individual workouts
training_plan_executions -- User completion tracking
```

### Activity Tables
```sql
run_activities          -- Garmin run data
fitness_metric_snapshots -- VO2 max, etc.
analysis_reports        -- Agent analysis results
```

---

## Configuration

### Environment Variables (config/.env)
```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Session
SESSION_SECRET=development-secret

# LLM Provider
LLM_PROVIDER=openai

# Ports
PORT=3000
AGENT_PORT=5001
```

### Frontend Environment
```bash
VITE_BACKEND_API_URL=http://localhost:3000
```

---

## Known Issues & TODOs (v1.2.2)

### Fixed in 1.2.2
1. **Chart Rendering**
   - Tooltip positioning and dark-mode inputs are now consistent
   - Weather widget color coding aligned to Good/Fair/Poor thresholds
   - Charts embedded directly in assistant responses

### Critical (Pending)
2. **Garmin Account Switch**
   - After disconnecting and adding new Garmin credentials, data is still fetched from the old account
   - Likely due to MCP server hardcoded device/account binding

3. **Plan Subscription Flow**
   - Subscription state needs to drive dashboard module behavior

### Medium Priority (Pending)
4. **Code Cleanup Needed**
   - Duplicate CSS variables in index.css and Chat.css
   - Unused imports in DashboardSection.tsx
   - Backend auth routes need error handling refinement

5. **Testing**
   - No test coverage for new auth system
   - No test coverage for dashboard

### Low Priority (Pending)
6. **Performance**
   - Frontend bundle size >500KB (code splitting recommended)
   - No lazy loading for dashboard section

---

## File Inventory

### Source Files (Excluding Dependencies)
- Frontend: ~120 TSX/TS files
- Backend: ~45 TS files  
- Agent: ~35 Python files

### Key Configuration
- `frontend/vite.config.ts`
- `backend/tsconfig.json`
- `agent-service/requirements.txt`

### Documentation
- `README.md` - Project overview
- `CHECKPOINT.md` - This file

---

## Startup Instructions

```bash
cd /Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final
./scripts/start.sh
```

**Access:**
- Landing: http://localhost:5173/
- Chat: http://localhost:5173/chat
- Dashboard: http://localhost:5173/dashboard

---

## API Documentation

### Authentication
All protected endpoints require header:
```
Authorization: Bearer <jwt_token>
```

### Chat Endpoints
```
POST /api/v1/chat              # Send message, get analysis
GET  /api/v1/training-plans/active
POST /api/v1/training-plans    # Create plan (auth required)
```

### Agent Endpoints (Internal)
```
POST /analyze-latest-run
POST /analyze-fitness-trends
POST /running-conditions
POST /classify-intent
```

---

## Credits

- Original r42 backend: `anupk-adda-r42-1c6b12bd4054dc55b3d549a410c0c6ec40a7f6d3`
- Frontend: `app/` directory with React + Vite
- Unified: This checkpoint

---

*Last Updated: February 20, 2026*

---

## Code Cleanup Completed (Feb 20, 2026)

### Changes Made:
1. **Consolidated duplicate CSS** in Chat.css:
   - Merged duplicate `.graph-card` definitions (removed 8 lines)
   - Merged duplicate `.graph-widget` definitions (removed 6 lines)
   - Added min-height and width to main `.graph-widget` definition

2. **Cleaned up backend** server.ts:
   - Removed commented-out duplicate import statements (3 lines)
   - Kept commented route registrations as documentation for future features

### Remaining Cleanup Opportunities:
1. **Frontend**:
   - Chat.css has 91 references to `var(--slate-*)` - could be simplified with CSS custom property defaults
   - Bundle size warning (527KB) - consider code splitting for Dashboard section
   
2. **Backend**:
   - chat.routes.ts has 14 comment lines - mostly documentation, acceptable
   - Some legacy endpoints in training-plan.routes.ts for backward compatibility

3. **Agent Service**:
   - chart_builder.py imports `statistics` but only uses `mean` - could use `sum()/len()`
   - Some commented code in weather_agent.py for future enhancements

### No Action Taken (Intentional):
- Commented route registrations in server.ts (serve as roadmap)
- Legacy API endpoints (backward compatibility)
- Import aliases for readability
