# Testing Guide - Chart Detection & Routing Fixes

**Version:** 1.0  
**Date:** February 7, 2026  
**Purpose:** Step-by-step testing instructions for verifying regression fixes

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Environment Setup](#test-environment-setup)
3. [Test Scenarios](#test-scenarios)
4. [Expected Results](#expected-results)
5. [Troubleshooting](#troubleshooting)
6. [Performance Testing](#performance-testing)

---

## Prerequisites

### Required Data
- ✅ At least 1 run in the system (for single-run tests)
- ✅ At least 4 runs in the system (for trend tests)
- ✅ At least 10 runs in the system (for full range tests)

### Tools Needed
- Chrome or Firefox browser (latest version)
- Chrome DevTools (for performance testing)
- React DevTools extension (optional, for debugging)

### System Requirements
- All services running (frontend, backend, agent-service)
- Garmin MCP connection active
- Database populated with test data

---

## Test Environment Setup

### Step 1: Start All Services

```bash
# From project root directory
cd /Users/anupk/devops/codex/R42X

# Start all services
./scripts/start-dev.sh

# Verify services are running
./scripts/status.sh
```

**Expected Output:**
```
✅ Frontend: Running on http://localhost:5173
✅ Backend: Running on http://localhost:3000
✅ Agent Service: Running on http://localhost:8000
```

### Step 2: Open Browser

```bash
# Open browser to frontend
open http://localhost:5173
```

### Step 3: Open Developer Tools

```
Press F12 (or Cmd+Option+I on Mac)
- Console tab: For error checking
- Network tab: For API call monitoring
- Performance tab: For performance testing
```

---

## Test Scenarios

### Scenario 1: Single-Run Analysis ✅

**Objective:** Verify single-run analysis shows correct distance labels and routes to correct component.

#### Test 1.1: Basic Single-Run Query

**Steps:**
1. Clear any previous chat history
2. Enter query: `"Analyze my last run"`
3. Wait for response
4. Observe the charts

**Expected Results:**
- ✅ Response routes to `SingleRunCharts` component
- ✅ X-axis labels show distance (e.g., "1.0 km", "2.0 km", "3.0 km")
- ✅ NO "Run 1, Run 2" labels appear
- ✅ No range selector visible
- ✅ No mode toggle visible
- ✅ Charts display: Pace, Heart Rate, Cadence, Power (if available)
- ✅ Rendering time < 100ms

**Visual Verification:**
```
Expected Chart Layout:
┌─────────────────────────────────────┐
│  Pace Chart                         │
│  X-axis: 0 km, 1 km, 2 km, 3 km... │
│  Y-axis: Pace (min/km)              │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Heart Rate Chart                   │
│  X-axis: 0 km, 1 km, 2 km, 3 km... │
│  Y-axis: BPM                        │
└─────────────────────────────────────┘
```

**Screenshot Location:** Save as `test-1.1-single-run.png`

---

#### Test 1.2: Alternative Single-Run Queries

Test these variations to ensure intent detection works:

**Query A:** `"Show me my recent run"`
- ✅ Should route to SingleRunCharts
- ✅ Distance labels visible

**Query B:** `"Analyze my current run"`
- ✅ Should route to SingleRunCharts
- ✅ Distance labels visible

**Query C:** `"How was my last run?"`
- ✅ Should route to SingleRunCharts
- ✅ Distance labels visible

---

#### Test 1.3: Single-Run with Missing Metrics

**Setup:** Use a run that doesn't have power data

**Steps:**
1. Enter query: `"Show my power data for last run"`
2. Observe response

**Expected Results:**
- ✅ Charts still render for available metrics
- ✅ Friendly message: "Power data not available for this run"
- ✅ No error thrown
- ✅ Other charts (pace, HR) still visible

---

### Scenario 2: Multi-Run Trends ✅

**Objective:** Verify multi-run trends show correct date labels and proper range options.

#### Test 2.1: Last 4 Runs Query

**Steps:**
1. Clear chat history
2. Enter query: `"Show my last 4 runs"`
3. Wait for response
4. Observe the charts and controls

**Expected Results:**
- ✅ Response routes to `RunTrendsCompare` component
- ✅ X-axis labels show dates (e.g., "Jan 15", "Jan 22", "Feb 03")
- ✅ Range selector visible with ONLY 2 options:
  - "Last 4" (selected by default)
  - "Last 10"
- ✅ Mode toggle visible (Relative/Actual)
- ✅ Charts display: Distance, Pace, Heart Rate trends
- ✅ Rendering time < 300ms

**Visual Verification:**
```
Expected Layout:
┌─────────────────────────────────────┐
│  Range: [Last 4 ▼] [Last 10]       │
│  Mode:  [Relative] [Actual]        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Distance Trend                     │
│  X-axis: Jan 15, Jan 22, Jan 29... │
│  Y-axis: Distance (km)              │
└─────────────────────────────────────┘
```

**Screenshot Location:** Save as `test-2.1-last-4-runs.png`

---

#### Test 2.2: Last 10 Runs Query

**Steps:**
1. Enter query: `"Compare my last 10 runs"`
2. Observe response

**Expected Results:**
- ✅ Routes to `RunTrendsCompare`
- ✅ Range selector shows "Last 10" selected by default
- ✅ Both range options available
- ✅ Date labels on x-axis
- ✅ Can switch to "Last 4"

---

#### Test 2.3: Range Selector Functionality

**Steps:**
1. Start with "Last 4 runs" query
2. Click range selector dropdown
3. Select "Last 10"
4. Observe chart update

**Expected Results:**
- ✅ Charts update smoothly (< 50ms)
- ✅ X-axis now shows 10 date labels
- ✅ No page reload
- ✅ No console errors
- ✅ Selection persists

---

#### Test 2.4: Mode Toggle Functionality

**Steps:**
1. Start with "Last 4 runs" query
2. Click "Actual" mode toggle
3. Observe chart update
4. Click "Relative" mode toggle
5. Observe chart update

**Expected Results:**
- ✅ Charts update smoothly
- ✅ "Relative" mode: Shows percentage changes
- ✅ "Actual" mode: Shows absolute values
- ✅ No console errors
- ✅ Toggle state persists

---

### Scenario 3: Error Handling ✅

**Objective:** Verify error messages are user-friendly and provide context.

#### Test 3.1: No Runs Available

**Setup:** Clear all runs from database (or use fresh install)

**Steps:**
1. Enter query: `"Analyze my last run"`
2. Observe error message

**Expected Results:**
- ✅ User-friendly error message displayed
- ✅ Message: "No runs found. Please sync your Garmin data."
- ✅ Clear explanation of the issue
- ✅ Actionable guidance provided
- ✅ No generic "Error: Not found" message
- ✅ No stack trace visible to user

**Visual Verification:**
```
Expected Error Display:
┌─────────────────────────────────────┐
│  ⚠️ No Runs Found                   │
│                                     │
│  We couldn't find any runs in your │
│  account. Please sync your Garmin  │
│  data to get started.              │
│                                     │
│  [Sync Now] [Learn More]           │
└─────────────────────────────────────┘
```

---

#### Test 3.2: Network Error

**Setup:** Disconnect network or stop backend service

**Steps:**
1. Stop backend: `./scripts/stop.sh`
2. Enter query: `"Show my last run"`
3. Observe error message

**Expected Results:**
- ✅ Network error message displayed
- ✅ Message: "Unable to connect to server. Please check your connection."
- ✅ Retry button available
- ✅ No cryptic error codes

---

#### Test 3.3: Missing Metric Data

**Steps:**
1. Enter query: `"Show my power data"` (for run without power meter)
2. Observe response

**Expected Results:**
- ✅ Friendly message: "Power data not available for this run"
- ✅ Explanation: "This metric requires a power meter"
- ✅ Alternative suggestions provided
- ✅ Other available charts still shown

---

### Scenario 4: Edge Cases ✅

#### Test 4.1: Very Short Run

**Setup:** Use a run < 1 km

**Steps:**
1. Enter query: `"Analyze my last run"`
2. Observe charts

**Expected Results:**
- ✅ Charts render correctly
- ✅ Distance labels appropriate (e.g., "0.2 km", "0.4 km")
- ✅ No errors or warnings

---

#### Test 4.2: Very Long Run

**Setup:** Use a run > 42 km (marathon+)

**Steps:**
1. Enter query: `"Analyze my last run"`
2. Observe charts

**Expected Results:**
- ✅ Charts render correctly
- ✅ Distance labels appropriate (e.g., "10 km", "20 km", "30 km")
- ✅ No performance issues
- ✅ Smooth scrolling

---

#### Test 4.3: Exactly 4 Runs Available

**Setup:** Ensure database has exactly 4 runs

**Steps:**
1. Enter query: `"Show my last 4 runs"`
2. Check range selector

**Expected Results:**
- ✅ "Last 4" option available and selected
- ✅ "Last 10" option disabled or hidden
- ✅ Charts show all 4 runs
- ✅ No errors

---

#### Test 4.4: Only 3 Runs Available

**Setup:** Ensure database has exactly 3 runs

**Steps:**
1. Enter query: `"Show my last 4 runs"`
2. Observe response

**Expected Results:**
- ✅ Shows all 3 available runs
- ✅ Message: "Showing 3 runs (requested 4)"
- ✅ Range selector adjusted appropriately
- ✅ No errors

---

## Expected Results Summary

### ✅ Single-Run Analysis Checklist

- [ ] Routes to `SingleRunCharts` component
- [ ] Shows distance labels (e.g., "1.0 km", "2.0 km")
- [ ] Does NOT show "Run 1, Run 2" labels
- [ ] No range selector visible
- [ ] No mode toggle visible
- [ ] Pace chart displays correctly
- [ ] Heart rate chart displays correctly
- [ ] Cadence chart displays correctly
- [ ] Power chart displays (if available)
- [ ] Rendering time < 100ms
- [ ] No console errors

### ✅ Multi-Run Trends Checklist

- [ ] Routes to `RunTrendsCompare` component
- [ ] Shows date labels (e.g., "Jan 15", "Feb 03")
- [ ] Range selector shows ONLY "Last 4" and "Last 10"
- [ ] Default selection matches query intent
- [ ] Mode toggle present and functional
- [ ] Can switch between ranges smoothly
- [ ] Can switch between modes smoothly
- [ ] Distance trend chart displays
- [ ] Pace trend chart displays
- [ ] Heart rate trend chart displays
- [ ] Rendering time < 300ms
- [ ] No console errors

### ✅ Error Handling Checklist

- [ ] No generic "Error: Not found" messages
- [ ] Error messages are user-friendly
- [ ] Context provided for all errors
- [ ] Actionable guidance included
- [ ] Debugging info available (in details)
- [ ] No stack traces visible to users
- [ ] Console logs provide debugging info

### ✅ Performance Checklist

- [ ] Single-run rendering < 100ms
- [ ] Trend rendering < 300ms
- [ ] Range switching < 50ms
- [ ] No unnecessary API calls
- [ ] No cascading re-renders
- [ ] Memory usage stable (no leaks)
- [ ] Smooth scrolling and interactions

---

## Troubleshooting

### Issue: Charts Not Rendering

**Symptoms:**
- Blank screen where charts should be
- Loading spinner stuck
- Console shows errors

**Solutions:**
1. Check browser console for errors
2. Verify all services are running: `./scripts/status.sh`
3. Check network tab for failed API calls
4. Clear browser cache and reload
5. Check backend logs: `tail -f backend/logs/app.log`

---

### Issue: Wrong Labels Still Appearing

**Symptoms:**
- Single-run shows "Run 1, Run 2"
- Multi-run shows distance instead of dates

**Solutions:**
1. Clear browser cache completely
2. Hard reload: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. Check backend version: Should be v1.1.1
4. Verify chart_builder.py has latest changes
5. Check console for chart_type value

---

### Issue: Range Options Wrong

**Symptoms:**
- Shows more than 2 range options
- Shows ranges beyond available runs

**Solutions:**
1. Check React DevTools for component props
2. Verify `totalRuns` value is correct
3. Check `RunTrendsCompare.tsx` for hardcoded ranges
4. Clear component state and reload

---

### Issue: Performance Slow

**Symptoms:**
- Charts take > 300ms to render
- UI feels sluggish
- Browser becomes unresponsive

**Solutions:**
1. Open Chrome DevTools Performance tab
2. Record a profile during chart rendering
3. Look for long tasks (> 50ms)
4. Check for memory leaks in Memory tab
5. Verify memoization is working (add console.logs)
6. Check for unnecessary re-renders in React DevTools Profiler

---

## Performance Testing

### Test 1: Single-Run Rendering Time

**Steps:**
1. Open Chrome DevTools
2. Go to Performance tab
3. Click Record (red circle)
4. Enter query: "Analyze my last run"
5. Wait for charts to render
6. Stop recording
7. Analyze timeline

**Target:** < 100ms from data load to chart display

**How to Measure:**
- Look for "Charts" component in timeline
- Measure from first render to last paint
- Should see minimal layout thrashing

---

### Test 2: Trend Rendering Time

**Steps:**
1. Open Chrome DevTools Performance tab
2. Click Record
3. Enter query: "Show my last 4 runs"
4. Wait for charts to render
5. Stop recording
6. Analyze timeline

**Target:** < 300ms from data load to chart display

---

### Test 3: Range Switching Performance

**Steps:**
1. Load "Last 4 runs"
2. Open Performance tab and record
3. Switch to "Last 10"
4. Stop recording
5. Measure update time

**Target:** < 50ms for range switch

---

### Test 4: Memory Leak Check

**Steps:**
1. Open Chrome DevTools Memory tab
2. Take heap snapshot (Snapshot 1)
3. Perform 10 queries (mix of single and multi-run)
4. Take another heap snapshot (Snapshot 2)
5. Compare snapshots

**Target:** Memory should not grow significantly (< 10MB increase)

---

## Test Results Template

Use this template to document your test results:

```markdown
# Test Results - [Date]

## Environment
- Browser: Chrome 120.0
- OS: macOS Sequoia
- Services: All running

## Test Results

### Scenario 1: Single-Run Analysis
- Test 1.1: ✅ PASS - Distance labels correct
- Test 1.2: ✅ PASS - All query variations work
- Test 1.3: ✅ PASS - Missing metrics handled

### Scenario 2: Multi-Run Trends
- Test 2.1: ✅ PASS - Last 4 runs correct
- Test 2.2: ✅ PASS - Last 10 runs correct
- Test 2.3: ✅ PASS - Range selector works
- Test 2.4: ✅ PASS - Mode toggle works

### Scenario 3: Error Handling
- Test 3.1: ✅ PASS - No runs error friendly
- Test 3.2: ✅ PASS - Network error handled
- Test 3.3: ✅ PASS - Missing metric handled

### Scenario 4: Edge Cases
- Test 4.1: ✅ PASS - Short run works
- Test 4.2: ✅ PASS - Long run works
- Test 4.3: ✅ PASS - Exactly 4 runs works
- Test 4.4: ✅ PASS - Only 3 runs works

### Performance Tests
- Single-run rendering: 85ms ✅
- Trend rendering: 245ms ✅
- Range switching: 35ms ✅
- Memory stable: No leaks ✅

## Issues Found
None

## Overall Status
✅ ALL TESTS PASSED
```

---

## Conclusion

This testing guide provides comprehensive coverage of all regression fixes. Follow each scenario carefully and document your results. If any test fails, refer to the troubleshooting section or consult `REGRESSION_FIX_SUMMARY.md` for more details.

**Next Steps:**
1. Complete all test scenarios
2. Document results using template
3. Report any issues found
4. Verify performance targets met
5. Sign off on fixes

---

**Document Version:** 1.0  
**Last Updated:** February 7, 2026  
**Maintained By:** QA Team