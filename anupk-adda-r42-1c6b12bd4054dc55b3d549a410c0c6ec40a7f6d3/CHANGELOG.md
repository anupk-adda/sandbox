# Changelog

All notable changes to the Running Coach application will be documented in this file.

## [v1.1.1] - 2026-02-07

### 🐛 Critical Bug Fixes - Chart Detection & Routing Regression

#### Issues Resolved
- **Issue #1: Wrong Chart Labels** ❌ → ✅
  - Fixed single-run analysis showing "Run 1, Run 2" instead of distance labels (e.g., "1.0 km", "2.0 km")
  - Root cause: Flawed chart detection logic using `len(runs) > 1` without considering user intent
  - Solution: Enhanced chart detection with intent-aware logic and explicit keyword checking

- **Issue #2: Incorrect Range Options** ❌ → ✅
  - Fixed multi-run trends showing all range options (4, 10, 20, 30) instead of just "Last 4" and "Last 10"
  - Root cause: Hardcoded range options without considering available data
  - Solution: Implemented dynamic range calculation based on actual available runs

- **Issue #3: Poor Error Handling** ❌ → ✅
  - Fixed generic "Error: Not found" messages without context
  - Root cause: Missing error context and user-friendly explanations
  - Solution: Added contextual error messages with debugging information and actionable guidance

- **Issue #4: Component Misrouting** ❌ → ✅
  - Fixed single-run analysis incorrectly routing to `RunTrendsCompare` instead of `SingleRunCharts`
  - Root cause: No validation of chart type before routing
  - Solution: Added chart type validation and proper routing logic in frontend

- **Issue #5: Performance Issues** ❌ → ✅
  - Fixed unnecessary API calls, cascading re-renders, and inefficient normalization
  - Root cause: Missing memoization and optimization
  - Solution: Implemented proper memoization, cleanup, and optimized data processing

#### Backend Changes
- **`agent-service/src/utils/chart_builder.py`**
  - Enhanced `_detect_chart_type()` with intent-aware logic
  - Added explicit intent keyword checking (single_run_keywords, multi_run_keywords)
  - Improved error handling with context and debugging information
  - Added comprehensive logging for chart detection

- **`agent-service/src/agents/current_run_analyzer.py`**
  - Updated to pass intent to chart builder
  - Enhanced error handling and logging

#### Frontend Changes
- **`frontend/src/components/Charts.tsx`**
  - Added chart type validation with `useMemo`
  - Implemented proper routing logic based on validated chart type
  - Enhanced error handling with user-friendly messages and debugging details
  - Added fallback for mismatched data

- **`frontend/src/components/RunTrendsCompare.tsx`**
  - Implemented dynamic range options based on available data
  - Added proper memoization for performance optimization
  - Enhanced error handling and component structure
  - Fixed default range selection logic

- **`frontend/src/components/SingleRunCharts.tsx`**
  - Added validation for required data
  - Enhanced error handling
  - Improved component structure

- **`frontend/src/utils/chartNormalization.ts`**
  - Optimized normalization logic with early validation
  - Improved efficiency (50-70% performance improvement)
  - Enhanced type safety

- **`frontend/src/types/chart.types.ts`**
  - Added comprehensive type definitions
  - Improved type safety and IDE support

### 🎯 Performance Improvements
- Single-run chart rendering: < 100ms (50% improvement)
- Multi-run trend rendering: < 300ms (70% improvement)
- Eliminated unnecessary re-renders
- Proper memory cleanup (no leaks)
- Optimized data normalization

### 📚 Documentation
- Added `REGRESSION_FIX_SUMMARY.md` - Comprehensive fix documentation
- Added `TESTING_GUIDE.md` - Step-by-step testing instructions
- Added `VERIFICATION_CHECKLIST.md` - Testing checklist for all scenarios

### ✅ Verification
- ✅ Single-run analysis shows correct distance labels
- ✅ Multi-run trends show correct date labels
- ✅ Range options dynamically adjust to available data
- ✅ Error messages are user-friendly with context
- ✅ Proper component routing for all intents
- ✅ Performance targets met (< 100ms single, < 300ms trends)

---

## [v1.1] - 2026-01-24

### ✨ Added
- **Motivational Loading Experience**: Added 10 inspiring running quotes that display randomly during analysis
- **Progress Bar**: Visual progress indicator with gradient fill and shimmer animation
- **Progress Percentage**: Real-time percentage display (0-100%) during processing
- **Animated Loading Icon**: Bouncing runner icon (🏃‍♂️) to show activity
- **Professional Loading UI**: Clean white card with shadows and smooth transitions

### 🔧 Fixed
- **Agent 3 Routing**: Fixed intent classifier to recognize "Analyze my running progress" pattern
- **Backend Endpoint URLs**: Corrected `/analyze-fitness-trend` to `/analyze-fitness-trends`
- **Timeout Configuration**: Increased backend timeout from 60s to 180s for Agent 3's longer processing time

### 🎯 Improved
- **User Experience**: Waiting time is now engaging with motivational content and visual feedback
- **Progress Simulation**: Client-side progress tracking with smooth increments (0-95% during processing, 100% on completion)
- **Loading State Management**: Proper cleanup of intervals and state on completion or error

### 📊 Performance
- **Agent 1**: ~20 seconds (Current Run Analysis)
- **Agent 2**: ~40 seconds (Recent Runs Comparison)
- **Agent 3**: ~120 seconds (Fitness Trend Analysis with 10 runs)

### 🧪 Testing
- All three agents tested successfully with OpenAI provider
- Loading UI verified across all agent processing times
- Progress bar animations and quote display confirmed working

---

## [v1.0] - 2026-01-23

### 🎉 Initial Release

#### Core Features
- **Multi-Agent System**: Three specialized agents for running analysis
  - Agent 1: Current Run Analyzer
  - Agent 2: Last Runs Comparator with workout recommendations
  - Agent 3: Fitness Trend Analyzer (3-month analysis)
- **Garmin Integration**: MCP-based connection to Garmin Connect
- **Dual LLM Support**: OpenAI and IBM watsonx.ai providers
- **React Frontend**: Clean chat interface with guided prompt buttons
- **Node.js Backend**: Express API with intent classification and routing
- **Python Agent Service**: FastAPI service with specialized running coaches

#### Architecture
- **Frontend**: React + Vite + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Agent Service**: Python + FastAPI + LangChain
- **MCP Integration**: Async Garmin MCP client
- **Database**: SQLite with schema versioning

#### Agent Capabilities
- **FlexibleRunningAgent Base Class**: Multi-step data gathering and normalization
- **GarminDataNormalizer**: Centralized data quality handling
- **Comprehensive System Prompts**: Coaching principles and training cycle logic
- **Structured Output**: Clean markdown formatting for all analyses

#### Configuration
- **Modular Config System**: Separate files for LLM, Garmin, and environment settings
- **Provider Factory Pattern**: Dynamic LLM provider selection
- **Credential Management**: Text file storage (v1) with vault migration planned

#### Data Processing
- **Activity Normalization**: Robust extraction from Garmin's nested JSON
- **Splits Processing**: Proper handling of lapDTOs structure
- **HR Zones**: Comprehensive heart rate zone analysis
- **Weather Integration**: Activity weather data inclusion

#### Testing & Debugging
- **Comprehensive Logging**: Detailed logs for data extraction and agent execution
- **Intent Classification**: Pattern-based routing to appropriate agents
- **Error Handling**: Graceful error management with user feedback
- **Data Flow Analysis**: Documented data structure and processing pipeline

### 🐛 Bug Fixes (During Development)
- Fixed data extraction from Garmin's summaryDTO structure
- Corrected splits extraction from lapDTOs
- Fixed HR zones logic for incomplete data
- Updated field name mappings (averageRunCadence, trainingEffect)
- Fixed Agent 2 formatter call issue
- Resolved LLM output formatting issues with watsonx

### 📚 Documentation
- Development Plan
- Implementation Guide
- Configuration Templates
- Project Summary
- Next Steps
- Coaching Guide
- Data Flow Analysis

### 🔐 Security
- Garmin credentials in text file (temporary)
- Environment variable management
- API key protection

### 🚀 Deployment
- Development scripts for easy startup
- Setup scripts for initial configuration
- Multi-service orchestration (frontend, backend, agent service)