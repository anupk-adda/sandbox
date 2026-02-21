# pace42 System Documentation (Single Source of Truth)

**Version:** v2.1.0
**Date:** 2026-02-21

This document is the authoritative reference for architecture, features, APIs, agents, and operational flows. It is intended for future coding assistants and engineers to extend pace42 without breaking the agentic experience.

---

## 1. Product Overview

pace42 is an AI running coach that integrates Garmin data to generate:
- Holistic run analysis
- Training plans and plan tracking
- Contextual coaching and Q&A
- Weather‑aware guidance

Key UX principle:
**User message → Intent analysis → Agent execution → Coach synthesis → Formatted response in assistant UI**

The assistant output must always render in a **3‑section layout**:
1. **Coach Observations** (3–5 concrete observations/advice)
2. **Graph** (single chart – run chart or relevant metric chart)
3. **Full Description** (point‑by‑point narrative detail)

---

## 2. System Architecture

### 2.1 Frontend (React + Vite)
- Located in `pace42-final/frontend`
- HashRouter (`#/chat`, `#/dashboard`), so all deep links must use hashes.

Key UI components:
- `Chat.tsx`: assistant conversation rendering (3‑section output)
- `RunAnalysisInlineCard`: run chart embedded in chat
- `RunCompareChart`: detailed run chart renderer (normalized overlay + efficiency)
- `DashboardSection.tsx`: training dashboard gating + actions

### 2.2 Backend (Node/Express)
- Located in `pace42-final/backend`
- Main routing: `/api/v1/*`
- Orchestrates:
  - Auth
  - Training plans
  - Subscription and limits
  - Chat routing + agent calls

### 2.3 Agent Service (Python/FastAPI)
- Located in `pace42-final/agent-service`
- Handles coaching logic and Garmin MCP calls
- Agents:
  - `CurrentRunAnalyzer`
  - `LastRunsComparator`
  - `FitnessTrendAnalyzer`
  - `CoachQAAgent`

### 2.4 Garmin MCP
- MCP wrapper and server code for token exchange and Garmin data retrieval.
- Backend pre‑creates token directories.

---

## 3. Core Agentic Flow

### Chat Flow
1. **User message → Intent classifier** (`backend/src/services/intent-classifier.ts`)
2. **Route to agent** (`backend/src/routes/chat.routes.ts`)
3. **Agent runs analysis** (agent-service)
4. **Coach synth + inference layer** returns formatted response
5. **Frontend renders 3‑section layout**

### Key Rules
- **Never revert to metric-by-metric narration.**
- **Output must be concise and decision‑quality.**
- **Charts must show effort/output relationship, drift, and efficiency.**

---

## 4. Features & Behavior

### 4.1 Run Analysis (Latest Run)
- Uses Garmin data
- Output in 4‑line holistic synthesis:
  - Session Diagnosis
  - Primary Limiter
  - Performance Lever
  - Next Execution Cue

Frontend rendering:
- Coach Observations section derived from analysis
- Single graph (run chart)
- Full Description (expanded narrative)

### 4.2 Progress / Fitness Trend
- Fitness trend analysis via `FitnessTrendAnalyzer`
- Uses charts in response
- Rendered in chat with **one** chart and a full description

### 4.3 Next Run Recommendation
- Must consider **last 3 runs**
- Balance week: base + quality (tempo/VO2) + long + easy/recovery
- Avoid stacking intensity

### 4.4 Training Plans
- Created via agent service `/generate-plan`
- One active plan per user (tier‑limited)
- Plan summary shown in chat
- Plan modification supported via chat prompts

### 4.5 Subscription / Gating
- Free tier: 1 plan + query limits
- Premium: unlimited
- Dashboard gated unless subscribed

---

## 5. Key APIs

### Backend Routes

**Auth**
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/validate-garmin`
- `POST /api/v1/auth/disconnect-garmin`

**Chat**
- `POST /api/v1/chat`
  - Returns analysis + charts + runSamples + planSummary
  - Includes `analysisSummary` and `analysisFull` for UI rendering

**Training Plans**
- `POST /api/v1/training-plans` (create)
- `GET /api/v1/training-plans/active`
- `POST /api/v1/training-plans/subscribe`
- `GET /api/v1/training-plans/subscription-status`

**Subscription**
- `GET /api/v1/subscription/status`
- `POST /api/v1/subscription/upgrade`

### Agent Service (FastAPI)
- `POST /analyze-latest-run`
- `POST /analyze-recent-runs`
- `POST /analyze-fitness-trends`
- `POST /generate-plan`
- `POST /ask-coach`

---

## 6. Graph Rendering Requirements

Run analysis graph must:
- Normalize HR/pace or correctly invert pace axis
- Include derived Efficiency Index + Drift
- Use smoothing + despike
- Show insight zones (stable / drift / fade)
- Tooltip must show: time, HR, pace, efficiency, drift

Implementation files:
- `frontend/src/features/run-analysis/RunCompareChart.tsx`
- `frontend/src/features/run-analysis/runAnalysisUtils.ts`

---

## 7. Coach Q&A Requirements

The Coach Q&A agent must:
- Maintain conversation context
- Treat follow‑ups as continuation
- Avoid repeating prior answers
- Ask only one clarifying question when needed
- Provide balanced next‑run suggestions

Implementation file:
- `agent-service/src/agents/coach_qa.py`

---

## 8. Data & Storage

- SQLite database: `backend/database/running_coach.db`
- User preferences include plan subscription flag
- Training plans stored in `training_plans`, `training_plan_workouts`, etc.

---

## 9. Development & Operations

Start services:
```
cd pace42-final
./scripts/start.sh
```
Stop services:
```
./scripts/stop.sh
```

Logs:
- `pace42-final/logs/backend.log`
- `pace42-final/logs/agent-service.log`
- `pace42-final/logs/combined.log`

---

## 10. Testing

Manual smoke:
- Landing page
- Chat login
- Dashboard
- Run analysis

E2E harness:
- `./scripts/test-e2e.sh`

---

## 11. Recent Changes (Agent Behavior Roadmap)

Phases 1–4 complete:
- Holistic synthesis
- Graph rendering improvements
- Plan lifecycle completion
- Contextual Q&A memory and follow‑ups

---

## 12. Extension Guidance

When adding features:
- Preserve agentic flow (intent → agent → coach → formatted UI)
- Keep output consistent with 3‑section UI
- Keep charts meaningful; avoid noisy metrics
- Never degrade holistic synthesis behavior

