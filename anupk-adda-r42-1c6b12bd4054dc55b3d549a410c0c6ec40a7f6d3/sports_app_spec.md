# Sports App Specification (Running Coach)

## 0. Overview
A running-focused sports app that connects to a user’s Garmin account via an MCP server and uses a multi-agent system to analyze the user’s current run, recent runs, and longer-term fitness trends.

Outputs:
- Coaching narrative for the current run
- Relative progress analysis (recent vs historical)
- Personalized training plans for 10K, Half Marathon, and Marathon

---

## 1. Goals & Non-Goals

### 1.1 Goals
- Connect to Garmin via an MCP server
- Analyze running activities only
- Multi-agent analysis with deterministic orchestration
- Generate adaptive, safe training plans
- Provide explainable coaching insights

### 1.2 Non-Goals
- Non-running sports (v1)
- Medical diagnosis or injury treatment
- Social or competitive features

---

## 2. High-Level Architecture

- Client App (Web-first)
- Backend API
- MCP Integration Service (Garmin)
- Agent Runtime (LangGraph)
- Persistent Data Store

---

## 3. Agent Framework & LLM Stack

### 3.1 Orchestration Framework

**Framework:** LangGraph (LangChain ecosystem)

LangGraph is used to orchestrate the multi-agent workflow with explicit state, parallel execution, and controlled joins.

**Execution Pattern**
- Agent 1, 2, and 3 execute in parallel
- Outputs are merged into shared graph state
- Coach Agent synthesizes final output

```
A1 (Current Run) ─┐
A2 (Last 3 Runs) ├─▶ Coach Agent ─▶ Narrative + Plans
A3 (3-Month Trend)┘
```

---

### 3.2 Tool Layer

**Tool Provider:** Garmin MCP Server (user-provided)
garmin mcp server and command to run:

Command
/Users/anupk/devops/mcp/garmin_mcp/.venv/bin/python

Arguments
/Users/anupk/devops/mcp/garmin_mcp/garmin_mcp_server.py

- OAuth & token lifecycle
- Garmin API access
- Data normalization
- Rate limiting

Agents never call Garmin APIs directly.

---

### 3.3 LLM API

**Provider:** OpenAI  
**API:** OpenAI Responses API

- Structured JSON outputs
- Tool calling support
- Long-context synthesis for Coach Agent
- Streaming support for narrative output

A provider abstraction layer must exist for future portability.

---

## 4. Agent Responsibilities

### 4.1 Agent 1 — Current Run Analyzer
- Classify run type
- Analyze pacing, HR drift, cadence, power
- Identify execution quality
- Output key metrics + observations

### 4.2 Agent 2 — Last 3 Runs Comparator
- Compare efficiency and trends
- Detect consistency and load issues
- Highlight risk flags

### 4.3 Agent 3 — 3-Month Fitness Trend Analyzer
- Analyze VO2 max trend
- Load and recovery trajectory
- Readiness assessment

### 4.4 Coach Agent (Orchestrator)
- Synthesize all agent outputs
- Generate coaching narrative
- Produce training plans:
  - 10K
  - Half Marathon
  - Marathon

---

## 5. Training Plan Generation

- Phase-based plans (Base, Build, Peak, Taper)
- Weekly structure with key workouts
- Intensity via pace, HR, or power
- Safety constraints:
  - ≤ 2 hard sessions/week
  - Volume increase ≤ 10–12%
  - Long run ≤ 35% weekly volume

---

## 6. Data Model (Canonical)

### Entities
- User
- RunActivity
- FitnessMetricSnapshot
- AnalysisReport
- TrainingPlan

All inputs and outputs must be versioned and reproducible.

---

## 7. Observability & Safety

- Agent execution logs
- Prompt and model version tracking
- Data quality flags
- Explicit assumptions in narrative output

---

## 8. Security & Privacy

- Encrypted Garmin tokens
- Least-privilege scopes
- Data export and deletion support

---

## 9. Roadmap

### v1
- Garmin MCP integration
- Multi-agent analysis
- Training plan generation

### v1.1
- Auto-sync
- Weekly plan adaptation

### v2
- Multisport extension
- Advanced fatigue modeling
