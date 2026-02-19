# Frontend UI Testing Guide

## Test Setup Complete ✅

All services are running:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Agent Service**: http://localhost:5001

## How to Test

### 1. Open the Frontend
Open your browser and navigate to:
```
http://localhost:5173
```

### 2. Test Questions

Try these questions to test different intents:

#### Test 1: Last Run Analysis (Agent 1)
```
What about my last run?
How did my latest run go?
Analyze my most recent run
```
**Expected**: Should route to Agent 1 (Current Run Analyzer)

#### Test 2: Recent Runs Comparison (Agent 2)
```
How have my last few runs been?
Compare my recent runs
Show me my last 3 runs
```
**Expected**: Should route to Agent 2 (Last Runs Comparator)

#### Test 3: Fitness Trend (Agent 3)
```
How is my fitness trending?
What's my VO2 max trend?
Am I getting fitter?
```
**Expected**: Should route to Agent 3 (Fitness Trend Analyzer)

#### Test 4: General Question
```
What should I eat before a run?
How do I prevent injuries?
```
**Expected**: Should return general response (no Garmin data needed)

## What to Look For

### In the Browser
1. ✅ Chat interface loads
2. ✅ You can type messages
3. ✅ Messages appear in chat history
4. ✅ AI responses appear after a few seconds
5. ✅ Loading indicator shows while waiting

### In the Terminal Logs

**Terminal 4 (Backend)** should show:
```
Chat POST handler called
Intent classified: { type: "last_run", confidence: 0.9 }
Routing to Agent 1: Current Run Analyzer
Agent service response received
```

**Terminal 3 (Agent Service)** should show:
```
Analyzing latest run
Fetching running activities
Calling watsonx.ai
Analysis complete
```

## Expected Response Format

The AI should return a structured analysis like:
```
## Run Analysis

**Activity**: Singapore Running
**Date**: 2026-01-23
**Distance**: 5.0 km
**Duration**: 26:14

### Performance
- Average pace: 5:15/km
- Heart rate: 145 bpm avg
- Cadence: 168 spm

### Observations
[AI-generated insights about the run]
```

## Troubleshooting

### If frontend doesn't load:
```bash
cd frontend
npm run dev
```

### If you get CORS errors:
Check that backend CORS is configured for `http://localhost:5173`

### If responses are slow:
- First request may take 10-15 seconds (watsonx.ai cold start)
- Subsequent requests should be faster (5-8 seconds)

### If you get 404 errors:
Make sure all services are running:
```bash
# Check processes
lsof -i :3000  # Backend
lsof -i :5001  # Agent service
lsof -i :5173  # Frontend
```

## Success Criteria

✅ Frontend loads without errors
✅ Can send messages
✅ Intent classification works (check logs)
✅ Agent routing works (check logs)
✅ Receives AI-generated analysis
✅ Response displays in chat UI

## Next Steps After Testing

Once frontend testing is complete:
1. Add session management for multi-turn conversations
2. Implement context tracking
3. Add error handling UI
4. Build Coach Agent orchestrator
5. Add training plan generation

---

**Ready to test!** Open http://localhost:5173 in your browser and try the test questions above.