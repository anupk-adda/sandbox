# Integration Test Plan - Running Coach Application

## Test Flow Overview

### Step 1: User asks question on web page
- **Input**: Natural language question from user
- **Example**: "What about my last run?"
- **Expected**: Frontend sends question to backend API

### Step 2: Assistant figures out intent
- **Component**: Backend API + Intent classifier
- **Logic**: Determine if question requires Garmin data
- **Decision**: Route to Coach Agent if running-related

### Step 3: Coach Agent routes to specific agent
- **Component**: Coach Agent (orchestrator)
- **Logic**: Analyze question intent
- **Routing**:
  - "last run" → Agent 1 (Current Run Analyzer)
  - "recent runs" → Agent 2 (Last 3 Runs Comparator)
  - "fitness trend" → Agent 3 (3-Month Fitness Trend Analyzer)

### Step 4: Agent 1 multi-function MCP calls
- **Sequence**:
  1. `list_activities` - Get activity IDs
  2. `get_activity` - Get activity details
  3. `get_activity_splits` - Get lap-by-lap data
  4. `get_activity_hr_in_timezones` - Get HR zones
  5. `get_activity_weather` - Get weather conditions
- **Tool Discovery**: Use MCP server to discover available functions

### Step 5: Analysis and formatting
- **Sub-steps**:
  1. Agent 1 passes data to watsonx.ai with system prompt
  2. watsonx.ai analyzes data
  3. Health Coach does advanced analysis
  4. Formatter creates rich text output with graphics
  5. Display on assistant interface

### Step 6: Context management
- **Requirement**: Keep conversation context for follow-up questions
- **Implementation**: Session management with conversation history

## Current Implementation Status

### ✅ Implemented
- Agent 1 (Current Run Analyzer) with multi-step MCP calls
- watsonx.ai integration
- Basic formatting
- MCP client with tool discovery

### ⚠️ Partially Implemented
- Frontend (basic chat UI exists)
- Backend API (basic endpoints exist)
- Data normalization (has bugs)

### ❌ Not Implemented
- Intent classification
- Coach Agent orchestrator
- Advanced health coach analysis
- Rich text formatting with graphics
- Context/session management
- Frontend-to-backend integration

## Test Execution Plan

### Phase 1: Fix Current Issues
1. Fix normalization bug in splits handling
2. Verify Agent 1 end-to-end flow
3. Log all errors comprehensively

### Phase 2: Build Missing Components
1. Create intent classifier
2. Implement Coach Agent orchestrator
3. Add session/context management
4. Enhance formatter for rich output

### Phase 3: Integration Testing
1. Test frontend → backend → agent flow
2. Test multi-turn conversations
3. Test all 3 agents
4. Performance testing

### Phase 4: User Acceptance Testing
1. Real user questions
2. Edge cases
3. Error handling
4. Response quality

## Test Cases

### TC1: Simple Last Run Query
**Input**: "What about my last run?"
**Expected Flow**:
1. Frontend → Backend API
2. Intent: "last_run_analysis"
3. Coach → Agent 1
4. Agent 1 → 5 MCP calls
5. Agent 1 → watsonx.ai
6. Format → Display
**Expected Output**: Formatted analysis with strengths, areas to consider, summary

### TC2: Follow-up Question
**Input**: "How does it compare to my previous runs?"
**Expected Flow**:
1. Use context from TC1
2. Intent: "comparison_analysis"
3. Coach → Agent 2
4. Agent 2 → Multiple activity MCP calls
5. Analysis → Display
**Expected Output**: Comparative analysis

### TC3: Fitness Trend Query
**Input**: "Am I getting fitter?"
**Expected Flow**:
1. Intent: "fitness_trend"
2. Coach → Agent 3
3. Agent 3 → Historical data MCP calls
4. Analysis → Display
**Expected Output**: Trend analysis with VO2 max, readiness

## Logging Requirements

### Error Logging
- All exceptions with full stack traces
- MCP call failures
- Data quality issues
- LLM API errors

### Info Logging
- Request flow (step-by-step)
- MCP tool discovery
- Data normalization steps
- Analysis generation

### Debug Logging
- Raw MCP responses
- Normalized data structures
- LLM prompts and responses
- Timing information

## Success Criteria

1. ✅ User can ask question on web page
2. ✅ System correctly identifies intent
3. ✅ Coach routes to correct agent
4. ✅ Agent makes all required MCP calls
5. ✅ Data is normalized correctly
6. ✅ watsonx.ai generates analysis
7. ✅ Output is formatted with rich text
8. ✅ Context is maintained for follow-ups
9. ✅ No unhandled errors
10. ✅ Response time < 30 seconds

## Next Steps

1. **Immediate**: Fix normalization bug
2. **Short-term**: Build Coach Agent orchestrator
3. **Medium-term**: Implement intent classifier
4. **Long-term**: Add rich formatting and graphics