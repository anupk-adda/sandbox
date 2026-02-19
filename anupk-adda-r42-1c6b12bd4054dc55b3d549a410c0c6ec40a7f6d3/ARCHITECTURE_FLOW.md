# Running Coach Application - Proper Architecture Flow

## Desired Flow (As Described by User)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Step 1: User asks question on web page                              │
│ Frontend (React, Port 5173)                                          │
│ User: "What about my last run?"                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 2: Assistant figures out intent                                │
│ Backend API (Express, Port 3000)                                     │
│ - Receives user question                                             │
│ - Classifies intent (last run, recent runs, fitness trend, etc.)    │
│ - Determines if Garmin data is needed                                │
│ - Routes to Coach Agent if running-related                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 3: Coach Agent routes to specific agent                        │
│ Agent Service (FastAPI, Port 5001) - Coach Agent                    │
│ - Receives intent from backend                                       │
│ - Routes based on question:                                          │
│   • "last run" → Agent 1 (Current Run Analyzer)                     │
│   • "recent runs" → Agent 2 (Last 3 Runs Comparator)               │
│   • "fitness trend" → Agent 3 (3-Month Fitness Trend)               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 4: Agent 1 multi-function MCP calls                            │
│ Agent Service → Garmin MCP Server                                    │
│ 1. list_activities → Get activity IDs                               │
│ 2. get_activity → Get activity details                              │
│ 3. get_activity_splits → Get lap-by-lap data                        │
│ 4. get_activity_hr_in_timezones → Get HR zones                      │
│ 5. get_activity_weather → Get weather conditions                    │
│ Uses MCP server to discover available functions                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 5: Analysis and formatting                                     │
│ Agent Service → watsonx.ai → Health Coach → Formatter               │
│ 1. Agent 1 passes data to watsonx.ai with system prompt            │
│ 2. watsonx.ai analyzes data                                         │
│ 3. Health Coach does advanced analysis                              │
│ 4. Formatter creates rich text output with graphics                 │
│ 5. Return to Backend API                                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Backend API processes response                                       │
│ - Receives formatted analysis                                        │
│ - Stores in database (optional)                                      │
│ - Maintains conversation context                                     │
│ - Returns to Frontend                                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 6: Display with context management                             │
│ Frontend displays rich text and graphics                             │
│ - Shows analysis on assistant interface                              │
│ - Keeps context for follow-up questions                              │
│ - User can ask: "How does it compare to last week?"                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Current vs Desired Architecture

### Current (Incorrect)
```
Frontend → Agent Service (Direct)
```

### Desired (Correct)
```
Frontend → Backend API → Agent Service → Garmin MCP + watsonx.ai
                ↓
         Intent Classifier
         Context Manager
         Database
```

## Components to Build

### 1. Backend API Chat Endpoint
**File**: `backend/src/routes/chat.routes.ts`
**Endpoint**: `POST /api/v1/chat`
**Responsibilities**:
- Receive user messages
- Classify intent
- Call appropriate agent service endpoint
- Manage conversation context
- Store in database
- Return formatted response

### 2. Intent Classifier (Backend)
**File**: `backend/src/services/intent-classifier.ts`
**Logic**:
```typescript
interface Intent {
  type: 'last_run' | 'recent_runs' | 'fitness_trend' | 'general';
  confidence: number;
  requiresGarminData: boolean;
}

function classifyIntent(message: string): Intent {
  // Keyword matching or simple ML
  if (message.includes('last run') || message.includes('latest run')) {
    return { type: 'last_run', confidence: 0.9, requiresGarminData: true };
  }
  // ... more patterns
}
```

### 3. Agent Service Client (Backend)
**File**: `backend/src/services/agent-client/agent-client.ts`
**Purpose**: Backend calls agent service
```typescript
class AgentClient {
  async analyzeLastRun(): Promise<Analysis>
  async analyzeRecentRuns(): Promise<Analysis>
  async analyzeFitnessTrend(): Promise<Analysis>
}
```

### 4. Coach Agent (Agent Service)
**File**: `agent-service/src/agents/coach_agent.py`
**Purpose**: Orchestrate analysis agents
```python
class CoachAgent:
    def route_to_agent(self, intent: str) -> Analysis:
        if intent == "last_run":
            return self.current_run_analyzer.analyze()
        elif intent == "recent_runs":
            return self.last_runs_comparator.analyze()
        # ...
```

### 5. Context Manager (Backend)
**File**: `backend/src/services/context-manager.ts`
**Purpose**: Track conversation history
```typescript
interface ConversationContext {
  sessionId: string;
  messages: Message[];
  lastAnalysis?: Analysis;
  userProfile?: UserProfile;
}
```

### 6. Health Coach Enhancer (Agent Service)
**File**: `agent-service/src/agents/health_coach.py`
**Purpose**: Advanced analysis on top of agent output
```python
class HealthCoach:
    def enhance_analysis(self, agent_output: str, context: dict) -> str:
        # Add medical insights
        # Add training recommendations
        # Add motivational content
```

### 7. Rich Formatter (Agent Service)
**File**: `agent-service/src/formatting/rich_formatter.py`
**Purpose**: Create rich text with graphics
```python
class RichFormatter:
    def format_with_graphics(self, analysis: dict) -> dict:
        return {
            "text": formatted_markdown,
            "charts": [pace_chart, hr_chart],
            "metrics": key_metrics,
            "recommendations": action_items
        }
```

## Implementation Steps

### Phase 1: Backend Integration (1 hour)
1. Create `backend/src/routes/chat.routes.ts`
2. Create `backend/src/services/intent-classifier.ts`
3. Create `backend/src/services/agent-client/agent-client.ts`
4. Update `backend/src/server.ts` to include chat routes
5. Update frontend to call backend instead of agent service

### Phase 2: Coach Agent (1 hour)
1. Create `agent-service/src/agents/coach_agent.py`
2. Implement routing logic
3. Add context passing between agents
4. Test with all 3 agents

### Phase 3: Context Management (30 min)
1. Create `backend/src/services/context-manager.ts`
2. Store conversation history
3. Pass context to agents
4. Enable follow-up questions

### Phase 4: Health Coach & Rich Formatting (1 hour)
1. Create `agent-service/src/agents/health_coach.py`
2. Create `agent-service/src/formatting/rich_formatter.py`
3. Add chart generation
4. Add metrics visualization

## API Contracts

### Frontend → Backend
```typescript
POST /api/v1/chat
Request: {
  message: string;
  sessionId?: string;
}
Response: {
  response: string;
  sessionId: string;
  intent: string;
  requiresGarminData: boolean;
  charts?: Chart[];
  metrics?: Metric[];
}
```

### Backend → Agent Service
```typescript
POST /analyze
Request: {
  intent: 'last_run' | 'recent_runs' | 'fitness_trend';
  context?: ConversationContext;
}
Response: {
  analysis: string;
  raw_data: any;
  agent_used: string;
}
```

## Database Schema Updates

### conversations table
```sql
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY,
  session_id TEXT UNIQUE,
  user_id INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### messages table
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER,
  role TEXT, -- 'user' | 'assistant'
  content TEXT,
  intent TEXT,
  agent_used TEXT,
  created_at TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
```

## Testing Strategy

### Test 1: Intent Classification
```
Input: "What about my last run?"
Expected Intent: last_run
Expected Agent: Agent 1
```

### Test 2: Context Preservation
```
Message 1: "What about my last run?"
Message 2: "How does it compare to last week?"
Expected: Agent 2 with context from Message 1
```

### Test 3: Rich Formatting
```
Input: "What about my last run?"
Expected Output:
- Formatted markdown text
- Pace chart
- HR zone chart
- Key metrics table
```

## Success Criteria

- [x] Frontend sends to Backend (not Agent Service directly)
- [ ] Backend classifies intent correctly
- [ ] Backend calls appropriate agent via Agent Service
- [ ] Agent Service routes to correct agent
- [ ] Agent makes all MCP calls successfully
- [ ] watsonx.ai generates analysis
- [ ] Health Coach enhances analysis
- [ ] Rich formatter adds graphics
- [ ] Backend stores conversation
- [ ] Frontend displays rich output
- [ ] Follow-up questions work with context

## Next Steps

1. **Immediate**: Create backend chat routes
2. **Short-term**: Build intent classifier
3. **Medium-term**: Implement Coach Agent
4. **Long-term**: Add Health Coach and rich formatting