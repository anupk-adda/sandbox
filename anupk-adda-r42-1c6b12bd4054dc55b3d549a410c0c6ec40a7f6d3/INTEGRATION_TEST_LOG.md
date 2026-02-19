# Integration Test Log - Running Coach Application

## Test Date: 2026-01-24

## Current Architecture

```
Frontend (React, Port 5173)
    ↓
Agent Service (FastAPI, Port 5001)
    ↓
├─→ Garmin MCP Server (via stdio)
└─→ IBM watsonx.ai (via REST API)

Backend (Express, Port 3000) - Currently not in the flow
```

## Test Scenario 1: "What about my last run?"

### Expected Flow:
1. User types question in frontend
2. Frontend sends to `/chat` endpoint on agent service
3. Agent service needs to:
   - Parse intent (last run = Agent 1)
   - Call Agent 1
   - Agent 1 makes 5 MCP calls
   - Agent 1 calls watsonx.ai
   - Format response
   - Return to frontend

### Current Implementation Gaps:
- ❌ No `/chat` endpoint in agent service (only `/analyze-latest-run`)
- ❌ No intent classification
- ❌ No Coach Agent orchestrator
- ❌ Frontend expects chat interface, agent service has direct endpoints

### What We Have:
- ✅ Frontend chat UI
- ✅ Agent 1 (Current Run Analyzer) working
- ✅ MCP integration working
- ✅ watsonx.ai integration working
- ✅ Basic formatting

## Required Components to Build

### 1. Chat Endpoint in Agent Service
**File**: `agent-service/src/main.py`
**Endpoint**: `POST /chat`
**Input**: `{ "messages": [...], "temperature": 0.7, "max_tokens": 2000 }`
**Output**: `{ "response": "...", "model": "...", "usage": {...} }`

### 2. Intent Classifier
**Purpose**: Determine which agent to call based on user question
**Logic**:
- "last run", "latest run", "recent run" → Agent 1
- "last 3 runs", "recent runs", "compare" → Agent 2  
- "fitness", "trend", "getting fitter", "VO2" → Agent 3
- Other → General chat with watsonx.ai

### 3. Coach Agent Orchestrator
**Purpose**: Route to appropriate agent and synthesize responses
**Responsibilities**:
- Intent classification
- Agent selection
- Context management
- Response formatting

### 4. Session/Context Management
**Purpose**: Keep conversation history for follow-up questions
**Implementation**: In-memory dict or Redis

## Test Execution

### Test 1: Direct Agent Service Call (Current)
```bash
curl -X POST http://localhost:5001/analyze-latest-run
```

**Status**: ✅ Working (with normalization warning)
**Response Time**: ~16-18 seconds
**Issues**: 
- Normalization error (non-critical)
- No chat interface integration

### Test 2: Frontend to Agent Service (Planned)
**URL**: http://localhost:5173
**Action**: Type "What about my last run?"
**Expected**: Error (no /chat endpoint)

### Test 3: Full Integration (After Implementation)
**Flow**: Frontend → Chat Endpoint → Intent → Agent 1 → Response
**Expected**: Formatted analysis displayed in chat

## Implementation Priority

### Phase 1: Minimal Viable Integration (30 min)
1. Add `/chat` endpoint to agent service
2. Simple intent classifier (keyword matching)
3. Route to Agent 1 for "last run" questions
4. Return formatted response

### Phase 2: Enhanced Integration (1 hour)
1. Add Coach Agent orchestrator
2. Support all 3 agents
3. Add context management
4. Improve formatting

### Phase 3: Production Ready (2 hours)
1. Error handling
2. Logging
3. Performance optimization
4. Rich text formatting with graphics

## Next Steps

1. **Immediate**: Create `/chat` endpoint
2. **Short-term**: Test frontend → agent service flow
3. **Medium-term**: Build Coach Agent
4. **Long-term**: Add all missing features

## Errors to Monitor

### Current Known Issues:
1. **Normalization Error**: `'str' object has no attribute 'get'`
   - Location: `normalizer.py` line 73-89
   - Impact: Low (self-correction works)
   - Fix: Add better JSON parsing

2. **No Chat Endpoint**: Frontend expects `/chat`, doesn't exist
   - Impact: High (blocks integration)
   - Fix: Create endpoint

3. **No Intent Classification**: Can't route to correct agent
   - Impact: High (blocks multi-agent)
   - Fix: Build classifier

## Success Metrics

- [ ] User can ask question in frontend
- [ ] Question reaches agent service
- [ ] Intent is correctly identified
- [ ] Correct agent is called
- [ ] All MCP calls succeed
- [ ] watsonx.ai generates analysis
- [ ] Response is formatted
- [ ] Response displays in frontend
- [ ] Response time < 30 seconds
- [ ] No unhandled errors