# Fix Implementation Plan - Data Normalization Issues

## Overview

This document outlines the specific code changes needed to fix the data extraction bugs identified in `DATA_FLOW_ANALYSIS.md`.

## Critical Fixes Required

### Fix 1: Update normalize_activity() - Extract from summaryDTO

**File**: `agent-service/src/data/normalizer.py`
**Lines**: 61-175

**Current Code (WRONG)**:
```python
normalized = {
    "activity_id": raw_data.get("activityId"),
    "name": raw_data.get("activityName", "Unnamed Run"),
    "date": raw_data.get("startTimeGMT"),
    "type": raw_data.get("activityTypeDTO", {}).get("typeKey", "running"),
    "description": raw_data.get("description", "")
}

# Get metrics from summary or calculate from splits
distance = raw_data.get("distance", 0)  # ← WRONG: Returns 0
duration = raw_data.get("duration", 0)  # ← WRONG: Returns 0
```

**Fixed Code (CORRECT)**:
```python
# Extract activity type from nested DTO
activity_type_dto = raw_data.get("activityTypeDTO", {})
if isinstance(activity_type_dto, dict):
    activity_type = activity_type_dto.get("typeKey", "running")
else:
    activity_type = "running"

normalized = {
    "activity_id": raw_data.get("activityId"),
    "name": raw_data.get("activityName", "Unnamed Run"),
    "date": raw_data.get("startTimeGMT"),
    "type": activity_type,
    "description": raw_data.get("description", "")
}

# ALL METRICS are in summaryDTO
summary = raw_data.get("summaryDTO", {})
if not isinstance(summary, dict):
    self.logger.warning(f"summaryDTO is not a dict, type: {type(summary)}")
    summary = {}

# Extract metrics from summaryDTO
distance = summary.get("distance", 0)  # ← CORRECT: Gets actual value
duration = summary.get("duration", 0)  # ← CORRECT: Gets actual value
```

**Additional Metrics to Extract from summaryDTO** (lines 169-174):
```python
# Current (WRONG field names)
normalized["avg_hr"] = raw_data.get("averageHR", 0)
normalized["max_hr"] = raw_data.get("maxHR", 0)
normalized["calories"] = raw_data.get("calories", 0)
normalized["avg_cadence"] = raw_data.get("averageRunningCadenceInStepsPerMinute", 0)
normalized["training_effect"] = raw_data.get("aerobicTrainingEffect", 0)

# Fixed (CORRECT - from summaryDTO)
normalized["avg_hr"] = summary.get("averageHR", 0)
normalized["max_hr"] = summary.get("maxHR", 0)
normalized["calories"] = summary.get("calories", 0)
normalized["avg_cadence"] = summary.get("averageRunCadence", 0)  # Correct field name
normalized["training_effect"] = summary.get("trainingEffect", 0)  # Correct field name
normalized["avg_power"] = summary.get("averagePower", 0)  # Add power
normalized["max_power"] = summary.get("maxPower", 0)  # Add max power
```

### Fix 2: Update get_splits_safely() - Extract from lapDTOs

**File**: `agent-service/src/data/normalizer.py`
**Lines**: 74-118

**Current Code (WRONG)**:
```python
def get_splits_safely(data):
    """Safely extract splits from various data formats"""
    # ... defensive parsing ...
    
    splits_data = data.get("splits", {})  # ← WRONG: No "splits" key
    
    if isinstance(splits_data, dict):
        if "lapDTOs" in splits_data:
            lap_dtos = splits_data.get("lapDTOs", [])
            # ...
```

**Fixed Code (CORRECT)**:
```python
def get_splits_safely(data):
    """Safely extract splits from various data formats"""
    # CRITICAL: Check if data itself is a string first!
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            self.logger.warning("Failed to parse data as JSON")
            return []
    
    # Now safe to call .get() on data
    if not isinstance(data, dict):
        self.logger.warning(f"Data is not a dict after parsing, type: {type(data)}")
        return []
    
    # CORRECT: Look for lapDTOs directly
    lap_dtos = data.get("lapDTOs", [])
    
    # Ensure lap_dtos is a list
    if isinstance(lap_dtos, list):
        return lap_dtos
    elif isinstance(lap_dtos, str):
        try:
            parsed = json.loads(lap_dtos)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            self.logger.warning("Failed to parse lapDTOs as JSON")
    
    self.logger.warning(f"lapDTOs has unexpected type: {type(lap_dtos)}")
    return []
```

### Fix 3: Fix HR Zones Logic

**File**: `agent-service/src/mcp/garmin_client_async.py`
**Lines**: 318-326 (in WRONG function - get_activity_splits)

**Problem**: HR zone handling logic is in `get_activity_splits()` instead of `get_activity_hr_zones()`

**Current Code in get_activity_splits() (WRONG LOCATION)**:
```python
try:
    data = json.loads(content_text)
    # CRITICAL: Ensure we return a list of zones
    # If data is a single zone dict, wrap it in a list
    if isinstance(data, dict) and "zoneNumber" in data:
        logger.info("HR zones returned as single dict, wrapping in list")
        return [data]
    elif isinstance(data, list):
        return data
    else:
        logger.warning(f"HR zones data has unexpected structure: {type(data)}")
        return []  # ← Returns empty list for valid data!
```

**Fixed Code in get_activity_hr_zones() (CORRECT LOCATION)**:
```python
# In get_activity_hr_zones() function (lines 336-377)
try:
    data = json.loads(content_text)
    
    # Handle different response structures
    if isinstance(data, list):
        # Already a list of zones
        return data
    elif isinstance(data, dict):
        # Check if it's a single zone
        if "zoneNumber" in data:
            logger.info("HR zones returned as single dict, wrapping in list")
            return [data]
        # Check if zones are nested
        elif "zones" in data:
            zones = data.get("zones", [])
            if isinstance(zones, list):
                return zones
        # Check for hrZones key
        elif "hrZones" in data:
            hr_zones = data.get("hrZones", [])
            if isinstance(hr_zones, list):
                return hr_zones
    
    # If we get here, return the data as-is and let normalizer handle it
    logger.info(f"HR zones data structure: {type(data)}, returning as-is")
    return data if isinstance(data, (list, dict)) else []
    
except json.JSONDecodeError:
    logger.warning("Failed to parse HR zones as JSON")
    return []
```

**And REMOVE the HR zone logic from get_activity_splits()**:
```python
# In get_activity_splits() - just return the parsed data
try:
    data = json.loads(content_text)
    return data  # Let the normalizer handle the structure
except json.JSONDecodeError:
    return {}
```

### Fix 4: Add Comprehensive Logging

Add logging at each extraction point to verify data flow:

```python
def normalize_activity(self, raw_data: Dict) -> Dict:
    # ... existing code ...
    
    # Log what we're extracting
    self.logger.info(f"Extracting from summaryDTO: {list(summary.keys())[:10]}")
    
    distance = summary.get("distance", 0)
    duration = summary.get("duration", 0)
    
    self.logger.info(f"Extracted distance: {distance}m, duration: {duration}s")
    
    # ... rest of extraction ...
    
    self.logger.info(f"Normalized activity: distance={normalized['distance_km']}km, "
                    f"duration={normalized['duration_min']}min, "
                    f"avg_hr={normalized['avg_hr']}bpm")
```

## Implementation Order

### Phase 1: Core Fixes (Critical)
1. ✅ Fix `normalize_activity()` to extract from `summaryDTO`
2. ✅ Fix `get_splits_safely()` to extract from `lapDTOs`
3. ✅ Fix HR zones logic in correct function
4. ✅ Update field name mappings

### Phase 2: Verification (Testing)
5. Add comprehensive logging
6. Test with real Garmin activity
7. Verify all metrics extracted correctly
8. Confirm LLM receives data

### Phase 3: Validation (User Testing)
9. Test end-to-end flow
10. Verify coaching quality
11. Check edge cases

## Testing Checklist

After implementing fixes, verify:

- [ ] Distance extracted correctly (not 0)
- [ ] Duration extracted correctly (not 0)
- [ ] Average HR populated
- [ ] Max HR populated
- [ ] Cadence data available
- [ ] Power data available (if present)
- [ ] Training effect captured
- [ ] Splits/laps extracted from lapDTOs
- [ ] HR zones properly normalized
- [ ] LLM receives complete data
- [ ] User sees actual coaching

## Rollback Plan

If fixes cause issues:
1. Revert `normalizer.py` to previous version
2. Revert `garmin_client_async.py` to previous version
3. Review logs to identify specific issue
4. Apply fixes incrementally

## Success Metrics

**Before Fix**:
- Distance: 0 km
- Duration: 0 min
- HR: 0 bpm
- LLM response: "No data available"

**After Fix**:
- Distance: 5.05 km (actual value)
- Duration: 31.1 min (actual value)
- HR: 161 bpm avg, 178 bpm max (actual values)
- LLM response: Detailed coaching based on actual run data

## Notes

- All MCP communication is working ✓
- JSON parsing is working ✓
- LLM integration is working ✓
- **Only issue is data structure mismatch** ✗

The fixes are surgical and focused on the normalizer layer. No changes needed to:
- MCP client communication
- LLM provider
- Backend API
- Frontend UI
- Agent orchestration

## Next Steps After Fixes

Once data extraction is working:
1. Refactor agents to use base class
2. Implement Coach Agent orchestrator
3. Add training plan generation
4. Enhance observability
5. Add security layer