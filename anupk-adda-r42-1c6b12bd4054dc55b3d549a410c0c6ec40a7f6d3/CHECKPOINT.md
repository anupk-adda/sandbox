# Running Coach AI - Development Checkpoint

**Date**: 2026-02-06  
**Status**: Major UI/UX overhaul + Weather Agent + Charts + Memory  
**Next Session**: Stabilize outputs, polish weather + chart UX, cleanup repo

---

## ✅ Current State (Latest)

### What’s Working
- **Branding**: pace42.ai + tagline “Run smarter, not harder.”
- **Strava‑style UI**: cleaner layout, coach focus summaries, collapsible full analysis.
- **Charts**: combined trend graph (pace + HR + cadence + distance), labels at points, toggles.
- **Memory & context**: SQLite conversation memory, cached intent responses, follow‑up handling.
- **Intent routing**: last run / recent runs / progress / weather / general.
- **Weather Agent**: Open‑Meteo integration, 12‑hour timeline from current time, color‑coded bars, hover tooltip reasoning, reverse‑geocoded location label.
- **Location**: auto‑request on load, fallback label “Singapore (approx.)” when needed.

### Known Issues / Risks
- **LLM output repetition**: duplicates still appear; currently only UI‑level de‑dupe.
- **Charts are normalized**: values in chart are relative (trend only); averages shown above.
- **Pace formatting**: chart labels currently numeric; min:sec formatting pending.
- **Weather fallback**: location label is “Singapore (approx.)” if geolocation fails.
- **Repo noise**: db/pids/logs/dist artifacts present in git status.

### Key Features Added Since Last Checkpoint
- **Dual LLM provider** (OpenAI + watsonx) with factory selection.
- **Weather agent** endpoint `/running-conditions` + UI widget + location flow.
- **Context manager** (SQLite) + cached responses per intent.
- **Charts pipeline**: agents emit chart payloads → backend → frontend.
- **UI redesign**: coach focus, charts panel, weather widget, branding.

### Primary Files Touched
- `agent-service/src/agents/weather_agent.py`
- `agent-service/src/agents/current_run_analyzer.py`
- `agent-service/src/agents/last_runs_comparator.py`
- `agent-service/src/agents/fitness_trend_analyzer.py`
- `backend/src/routes/chat.routes.ts`
- `backend/src/services/context-manager.ts`
- `backend/src/services/intent-classifier.ts`
- `frontend/src/components/Chat.tsx`
- `frontend/src/components/Charts.tsx`
- `frontend/src/components/Chat.css`
- `frontend/src/services/chatService.ts`
- `database/schema.sql`

### Suggested Next Steps
1. **Backend de‑dupe / formatter cleanup** for repetitive LLM output.
2. **Unit formatting** in charts (pace as min:sec, HR bpm, cadence spm).
3. **Weather summary**: add dew point + heat‑index line to summary.
4. **Repo hygiene**: gitignore db/logs/pids/dist; clean working tree.
5. **Light tests**: add smoke tests for weather + charts payload.

---

## Previous Checkpoint (2026-01-23)

**Date**: 2026-01-23 18:24 SGT  
**Status**: Operational with Data Quality Issues  
**Next Session**: Architecture Review Required

---

## 🎯 Current State

### What's Working ✅
1. **Full stack operational**: Frontend, Backend, Agent Service all running
2. **Garmin MCP integration**: Successfully fetching data via 5 sequential tool calls
3. **IBM watsonx.ai**: LLM analysis working, responses being generated
4. **Intent detection**: Natural language routing functional
5. **End-to-end flow**: User query → Data fetch → AI analysis → Response display

### What's Not Working ❌
1. **Data quality issues**: Garmin API returning incomplete/incorrect data in summary fields
2. **Response formatting**: AI output not properly structured with markdown
3. **Timeout rate**: 33% of requests timing out (1 in 3)
4. **HR zone data**: Only getting Zone 1, missing other zones

---

## 🏗️ Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React) - Port 5173                                │
│  - Chat interface                                            │
│  - Markdown rendering                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend API (Node.js/Express) - Port 3000                   │
│  - Request routing                                           │
│  - CORS handling                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Agent Service (Python/FastAPI) - Port 5001                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Intent Router                                      │    │
│  │  - Pattern matching: "analy[sz]e.*last.*run"       │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│                   ▼                                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Current Run Analyzer                               │    │
│  │  - Hardcoded 5 MCP tool calls                       │    │
│  │  - Data extraction from splits (fallback)           │    │
│  │  - Prompt building with all data                    │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│                   ▼                                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Garmin MCP Client (Async)                          │    │
│  │  - Official MCP SDK                                 │    │
│  │  - Stdio communication                              │    │
│  │  - Sequential tool execution                        │    │
│  └────────────────┬───────────────────────────────────┘    │
└───────────────────┼──────────────────────────────────────────┘
                    │ MCP Protocol
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Garmin MCP Server (External Python Process)                 │
│  Path: /Users/anupk/devops/mcp/garmin_mcp/                  │
│  - OAuth with Garmin Connect                                │
│  - 80+ available tools                                      │
└────────────────────┬────────────────────────────────────────┘
                     │ Garmin API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Garmin Connect API                                          │
└─────────────────────────────────────────────────────────────┘

                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  IBM watsonx.ai                                              │
│  Model: openai/gpt-oss-120b                                 │
│  - IAM authentication                                        │
│  - Response in reasoning_content field                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Identified Issues

### Issue 1: Data Quality from Garmin
**Problem**: Activity summary fields showing 0 or incorrect values
- Distance: 0 km (should be 5 km)
- Duration: 0 minutes (should be ~31 minutes)
- Pace: 0.01 min/km (obviously wrong)

**Current Workaround**: Extract from lap splits
```python
# In _build_comprehensive_prompt()
if distance == 0 and splits_data:
    lap_dtos = splits_data.get("lapDTOs", [])
    total_distance = sum(lap.get("distance", 0) for lap in lap_dtos) / 1000
    total_duration = sum(lap.get("duration", 0) for lap in lap_dtos) / 60
```

**Root Cause**: Unknown - could be:
1. Garmin API returning incomplete data
2. MCP server not parsing correctly
3. Activity not fully synced
4. API endpoint returning wrong data structure

**Action Required**: 
- Debug Garmin MCP server response
- Check if different API endpoint needed
- Verify activity sync status

### Issue 2: Response Formatting
**Problem**: AI output not using markdown headings properly

**Current State**: Plain text with some structure
**Expected**: Proper markdown with # headers, ** bold **, bullet points

**Attempted Fix**: Updated prompt template with explicit markdown instructions
**Status**: Needs testing

### Issue 3: Timeout Rate
**Problem**: 33% of requests timeout after 30 seconds

**Root Cause**: Prompt too long with full lap details
```python
# Current prompt includes full JSON for each lap
for lap in lap_dtos:
    prompt += f"\n### Lap {lap_num}\n"
    prompt += f"- Distance: {lap.get('distance', 0) / 1000:.2f} km\n"
    prompt += f"- Duration: {lap.get('duration', 0) / 60:.2f} minutes\n"
    # ... many more fields
```

**Solution**: Summarize lap data instead of full details
```python
# Proposed: Summary format
prompt += f"\n## Lap Summary\n"
prompt += f"Total laps: {len(lap_dtos)}\n"
prompt += f"Average pace: {avg_pace:.2f} min/km\n"
prompt += f"Pace range: {min_pace:.2f} - {max_pace:.2f} min/km\n"
```

### Issue 4: HR Zone Data
**Problem**: Only Zone 1 returned, missing zones 2-5

**Current Data**:
```json
{"zoneNumber": 1, "secsInZone": 26.0, "zoneLowBoundary": 92}
```

**Expected**: Array of all zones with time distribution

**Possible Causes**:
1. MCP tool returning incomplete data
2. Need different API endpoint
3. Activity doesn't have full HR zone data
4. Parsing issue in MCP server

---

## 📁 Key Files & Locations

### Configuration
```
config/
├── app.config.json              # Main config (watsonx, Garmin paths)
├── garmin.credentials.txt       # OAuth tokens (gitignored)
└── .env                         # Environment vars (gitignored)
```

### Agent Service (Python)
```
agent-service/src/
├── main.py                      # FastAPI app, chat endpoint
├── config.py                    # Config loader
├── llm/
│   └── watsonx_provider.py      # IBM watsonx.ai client
├── mcp/
│   └── garmin_client_async.py   # Async MCP client
└── agents/
    ├── intent_router.py         # Pattern-based routing
    ├── current_run_analyzer.py  # Agent 1 (ACTIVE)
    ├── last_runs_comparator.py  # Agent 2 (implemented)
    ├── fitness_trend_analyzer.py # Agent 3 (implemented)
    └── intelligent_coach_agent.py # Claude-style (foundation)
```

### Backend API (Node.js)
```
backend/src/
├── server.ts                    # Express server
├── config/
│   └── config-loader.ts         # Config management
└── middleware/
    └── error-handler.ts         # Error handling
```

### Frontend (React)
```
frontend/src/
├── App.tsx                      # Main app
├── components/
│   └── Chat.tsx                 # Chat interface
└── services/
    └── api.ts                   # API client
```

---

## 🔧 Technical Details

### MCP Tool Call Sequence
```python
# Current hardcoded sequence in CurrentRunAnalyzer
1. list_activities(activityType="running", limit=1)
   → Returns: activity_id

2. get_activity(activity_id)
   → Returns: Full activity JSON (but summary fields are 0)

3. get_activity_splits(activity_id)
   → Returns: Lap-by-lap data (THIS IS WHERE REAL DATA IS)

4. get_activity_hr_in_timezones(activity_id)
   → Returns: HR zone data (only Zone 1 currently)

5. get_activity_weather(activity_id)
   → Returns: Weather conditions (working correctly)
```

### watsonx.ai Configuration
```json
{
  "model": "openai/gpt-oss-120b",
  "temperature": 0.3,
  "max_tokens": 2000,
  "timeout": 30
}
```

### Response Extraction
```python
# Fixed in watsonx_provider.py line 189
content = message.get('reasoning_content', '') or message.get('content', '')
```

---

## 🎯 Architecture Issues to Address

### Problem 1: Hardcoded Tool Calls
**Current**: Agent always calls same 5 tools in fixed order
**Issue**: Inefficient, not flexible
**Desired**: LLM decides which tools to call based on user request (Claude-style)

**Solution Path**:
1. Implement function calling with watsonx.ai
2. Use IntelligentCoachAgent instead of CurrentRunAnalyzer
3. Let LLM select tools semantically

### Problem 2: Data Extraction Logic
**Current**: Complex fallback logic in prompt builder
**Issue**: Fragile, hard to maintain
**Desired**: Clean data normalization layer

**Solution Path**:
1. Create DataNormalizer class
2. Handle all data quality issues in one place
3. Provide clean, consistent data to agents

### Problem 3: Prompt Management
**Current**: Prompts embedded in agent code
**Issue**: Hard to iterate, version, and optimize
**Desired**: Separate prompt templates

**Solution Path**:
1. Create prompts/ directory
2. Use Jinja2 templates
3. Version control prompts separately

---

## 🚀 Proposed Architecture Improvements

### Option A: Keep Current, Fix Data Issues
**Pros**: Minimal changes, quick fix
**Cons**: Doesn't address root architectural issues

**Steps**:
1. Debug Garmin MCP data quality
2. Optimize prompt length
3. Improve response formatting
4. Add better error handling

**Timeline**: 1-2 days

### Option B: Implement Intelligent Tool Selection
**Pros**: More flexible, scalable, Claude-like
**Cons**: Significant refactoring required

**Steps**:
1. Add function calling to watsonx provider
2. Switch to IntelligentCoachAgent
3. Let LLM decide tool sequence
4. Add tool result caching

**Timeline**: 3-5 days

### Option C: Hybrid Approach (RECOMMENDED)
**Pros**: Best of both worlds
**Cons**: Moderate complexity

**Steps**:
1. Fix immediate data quality issues (Option A)
2. Create clean data layer
3. Gradually migrate to intelligent selection (Option B)
4. Keep both approaches available

**Timeline**: 2-3 days for Phase 1, ongoing for Phase 2

---

## 📊 Test Data

### Latest Test Run
```
Activity ID: 21639489343
Name: Singapore Running
Date: 2026-01-23 20:39:22 SGT
Type: Running

Summary Data (from API - INCORRECT):
- Distance: 0 km
- Duration: 0 minutes
- Pace: 0.01 min/km

Lap Data (CORRECT):
- Lap 1: 1.0 km in 6:34 (394s)
- Lap 2: 1.0 km in 6:02 (362s)
- Lap 3: 1.0 km in 6:01 (361s)
- Lap 4: 1.0 km in 6:11 (371s)
- Lap 5: 1.0 km in 6:08 (368s)

Calculated Totals:
- Distance: 5.0 km
- Duration: 30:56 (1856s)
- Average Pace: 6:11 min/km

HR Data:
- Average: 174 bpm
- Max: ~190 bpm (estimated)
- Zone 1: 26 seconds

Weather:
- Temp: 80°F (27°C)
- Humidity: 79%
- Wind: 6 mph NNE
```

---

## 🔄 Next Session Action Plan

### Immediate (Start Here)
1. **Debug Garmin Data**
   - Check MCP server logs
   - Test different API endpoints
   - Verify activity sync status
   - Document actual vs expected data structure

2. **Test Response Formatting**
   - Run "analyze last run" with new prompt
   - Verify markdown rendering in UI
   - Adjust prompt if needed

3. **Optimize Prompt Length**
   - Implement lap data summarization
   - Reduce timeout rate to <10%
   - Measure performance improvement

### Short Term (Next 1-2 Days)
4. **Create Data Normalization Layer**
   ```python
   class GarminDataNormalizer:
       def normalize_activity(self, raw_data):
           # Handle all data quality issues
           # Return clean, consistent structure
   ```

5. **Improve Error Handling**
   - Better user feedback on failures
   - Retry logic for timeouts
   - Graceful degradation

6. **Add Response Streaming**
   - Show analysis as it's generated
   - Better UX for long-running requests

### Medium Term (Next Week)
7. **Implement Intelligent Tool Selection**
   - Add function calling to watsonx
   - Create tool selection prompt
   - Test with various user queries

8. **Complete Coach Orchestrator**
   - Synthesize all 3 agents
   - Generate comprehensive narrative
   - Produce training plans

9. **Add Observability**
   - Structured logging
   - Metrics collection
   - Prompt tracking

---

## 💾 State Preservation

### Running Services
```bash
# Terminal 1: Backend (Port 3000)
cd /Users/anupk/devops/R42/backend && npm run dev

# Terminal 2: Frontend (Port 5173)
cd /Users/anupk/devops/R42/frontend && npm run dev

# Terminal 3: Agent Service (Port 5001)
cd /Users/anupk/devops/R42/agent-service
source venv/bin/activate
python -m uvicorn src.main:app --reload --port 5001
```

### Environment
- Python: 3.10.12
- Node.js: Latest LTS
- Garmin MCP: /Users/anupk/devops/mcp/garmin_mcp/

### Git Status
- Branch: main (assumed)
- Uncommitted changes: Yes (all new files)
- .gitignore: Configured for credentials

---

## 📝 Key Decisions Made

1. **LLM Provider**: IBM watsonx.ai (openai/gpt-oss-120b)
2. **MCP Integration**: Official SDK with async/await
3. **Architecture**: Multi-service (Frontend, Backend, Agent Service)
4. **Data Extraction**: Fallback to lap splits when summary is empty
5. **Intent Detection**: Pattern-based routing (simple, effective for v1)
6. **Response Format**: Markdown with structured sections

---

## 🎓 Lessons Learned

### What Worked
- Official MCP SDK integration straightforward
- Async architecture handles concurrent requests well
- Pattern-based intent routing effective for v1
- Fallback data extraction saved the day

### What Didn't Work
- Assuming Garmin API summary data would be complete
- Long prompts with full lap details (timeouts)
- Expecting perfect markdown formatting without explicit instructions

### What to Try Next
- Intelligent tool selection (Claude-style)
- Data normalization layer
- Prompt templates with versioning
- Response streaming for better UX

---

## 🔗 Related Documents

- `SYSTEM_STATUS.md` - Comprehensive system overview
- `DEVELOPMENT_PLAN.md` - Original architecture plan
- `NEXT_STEPS.md` - Detailed action items
- `README.md` - Quick start guide
- `sports_app_spec.md` - Original requirements

---

## 📞 Resume Instructions

When resuming this project:

1. **Read this checkpoint first** - Get full context
2. **Check running services** - Verify all 3 are up
3. **Review test data** - Understand current data quality issues
4. **Pick action plan item** - Start with "Immediate" section
5. **Update this checkpoint** - Document new findings

---

**Checkpoint Created**: 2026-01-23 18:24 SGT  
**Next Review**: When resuming development  
**Status**: Ready for architecture review and data quality fixes
