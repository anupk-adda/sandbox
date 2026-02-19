# Data Flow Analysis - Running Coach App

## Problem Statement

After 4+ hours of testing, the system is technically functional (all layers communicate correctly), but **no actual run data is being extracted from Garmin**. The LLM consistently responds with "no data available" messages.

## Root Cause Analysis

### 1. Data Structure Mismatch

**The Critical Issue**: The normalizer code assumes Garmin data has a **flat structure**, but according to `data_format.md`, all metrics are **deeply nested inside `summaryDTO`**.

#### Current Implementation (WRONG)
```python
# Line 70-71 in normalizer.py
distance = raw_data.get("distance", 0)  # Returns 0
duration = raw_data.get("duration", 0)  # Returns 0
```

#### Actual Garmin Structure (from data_format.md)
```json
{
  "activityId": 21639489343,
  "activityName": "Singapore Running",
  "summaryDTO": {
    "distance": 5050.85,        // ← Metrics are HERE
    "duration": 1867.262,        // ← Not at top level
    "averageHR": 161.0,
    "maxHR": 178.0,
    "averageRunCadence": 163.421875,
    "averagePower": 280.0,
    "trainingEffect": 3.799999952316284
  }
}
```

### 2. Splits Data Structure Mismatch

**Current Code** (lines 89-112 in normalizer.py):
```python
splits_data = data.get("splits", {})  # Looking for "splits" key
```

**Actual Structure** (from MCP `get_activity_splits`):
```json
{
  "lapDTOs": [
    {
      "distance": 1000.0,
      "duration": 300.0,
      "averageHR": 160.0
    }
  ]
}
```

### 3. HR Zones Logic Error

**Location**: `garmin_client_async.py` lines 318-326

**Current Code**:
```python
# In get_activity_splits (WRONG FUNCTION!)
if isinstance(data, dict) and "zoneNumber" in data:
    logger.info("HR zones returned as single dict, wrapping in list")
    return [data]
elif isinstance(data, list):
    return data
else:
    logger.warning(f"HR zones data has unexpected structure: {type(data)}")
    return []  # ← Returns empty list!
```

**Problem**: This HR zone handling logic is in `get_activity_splits()` instead of `get_activity_hr_zones()`, and the "unexpected structure" branch returns an empty list.

## Data Flow Diagram

```
User Query: "analyze my last run"
    ↓
Backend API (Intent Classifier)
    ↓ Routes to Agent 1
Agent Service (CurrentRunAnalyzer)
    ↓ Calls base_agent._gather_activity_data()
    ↓
MCP Client (4 parallel calls)
    ├─ get_activity_details() → Returns JSON with summaryDTO ✓
    ├─ get_activity_splits() → Returns JSON with lapDTOs ✓
    ├─ get_activity_hr_zones() → Returns JSON with zones ✓
    └─ get_activity_weather() → Returns JSON ✓
    ↓
GarminDataNormalizer.normalize_activity()
    ├─ Looks for distance at top level → Gets 0 ✗
    ├─ Looks for duration at top level → Gets 0 ✗
    ├─ Looks for splits key → Not found ✗
    └─ All metrics return 0 or empty ✗
    ↓
LLM receives empty data
    ↓
User sees: "No data available"
```

## Affected Code Locations

### Priority 1: Critical Data Extraction Bugs

1. **`agent-service/src/data/normalizer.py`** lines 65-175
   - All metric extraction from `raw_data.get("field")` 
   - Should be `raw_data.get("summaryDTO", {}).get("field")`
   - Affects: distance, duration, HR, cadence, power, training effect

2. **`agent-service/src/data/normalizer.py`** lines 89-112
   - `get_splits_safely()` looks for `data.get("splits")`
   - Should look for `data.get("lapDTOs")`

3. **`agent-service/src/mcp/garmin_client_async.py`** lines 318-326
   - HR zone logic in wrong function
   - Returns empty list for valid data

### Priority 2: Secondary Issues

4. **`agent-service/src/data/normalizer.py`** lines 169-174
   - Metric extraction uses wrong field names
   - `averageRunningCadenceInStepsPerMinute` should be `averageRunCadence`
   - `aerobicTrainingEffect` should be `trainingEffect`

## Correct Data Extraction Pattern

Based on `data_format.md`, here's the correct pattern:

```python
def normalize_activity(self, raw_data: Dict) -> Dict:
    # Basic info at top level
    activity_id = raw_data.get("activityId")
    activity_name = raw_data.get("activityName", "Unnamed Run")
    start_time = raw_data.get("startTimeGMT")
    
    # Activity type nested in DTO
    activity_type_dto = raw_data.get("activityTypeDTO", {})
    activity_type = activity_type_dto.get("typeKey", "running")
    
    # ALL METRICS in summaryDTO
    summary = raw_data.get("summaryDTO", {})
    
    distance_m = summary.get("distance", 0)
    duration_s = summary.get("duration", 0)
    avg_hr = summary.get("averageHR", 0)
    max_hr = summary.get("maxHR", 0)
    avg_cadence = summary.get("averageRunCadence", 0)
    avg_power = summary.get("averagePower", 0)
    training_effect = summary.get("trainingEffect", 0)
    
    # Splits from separate MCP call
    # Comes as {"lapDTOs": [...]}
```

## Testing Strategy

### Phase 1: Fix Data Extraction
1. Update `normalize_activity()` to read from `summaryDTO`
2. Update `get_splits_safely()` to read from `lapDTOs`
3. Fix HR zones logic in correct function
4. Add comprehensive logging at each extraction point

### Phase 2: Verify Data Flow
1. Test with real Garmin activity
2. Verify all metrics are extracted correctly
3. Confirm LLM receives actual data
4. Validate user sees meaningful coaching

### Phase 3: Edge Cases
1. Handle missing `summaryDTO`
2. Handle activities with no splits
3. Handle incomplete HR zone data
4. Test with different activity types

## Success Criteria

✓ Distance and duration extracted correctly (not 0)
✓ HR metrics populated (avg, max)
✓ Cadence and power data available
✓ Training effect captured
✓ Splits/laps extracted from lapDTOs
✓ HR zones properly normalized
✓ LLM receives complete data
✓ User sees actual coaching based on their run

## Implementation Plan

### Step 1: Update normalize_activity() method
- Extract all metrics from `summaryDTO`
- Update field name mappings
- Add defensive checks for missing summaryDTO

### Step 2: Fix splits extraction
- Update `get_splits_safely()` to look for `lapDTOs`
- Handle both dict and list responses
- Ensure proper structure for lap normalization

### Step 3: Fix HR zones
- Move logic to correct function
- Remove "unexpected structure" empty return
- Properly handle single zone vs list

### Step 4: Comprehensive Testing
- Test with real activity data
- Verify end-to-end flow
- Confirm LLM analysis quality

## Notes

- MCP communication is working correctly ✓
- JSON parsing is working correctly ✓
- LLM integration is working correctly ✓
- **Only issue is data structure mismatch in normalizer** ✗

The fix is surgical - update the normalizer to match Garmin's actual data structure as documented in `data_format.md`.