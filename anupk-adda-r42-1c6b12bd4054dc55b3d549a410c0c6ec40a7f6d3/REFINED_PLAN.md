# Running Coach AI - Refined Implementation Plan

**Date**: 2026-01-24 14:47 SGT  
**Based on**: User feedback and current checkpoint analysis  
**Goal**: Create flexible, self-correcting agents with proper formatting

---

## 🎯 Core Requirements (From Feedback)

### 1. Agent Definition
**Highly flexible agents that can:**
- Handle complex multi-step tasks scoped to running activity
- Self-correct based on results
- Work well with ambiguous requests
- Make multiple MCP function calls to extract comprehensive information
- Analyze data intelligently

**Key Insight**: All 3 agents follow similar architecture - only the data scope differs:
- Agent 1: Single run (current)
- Agent 2: Last 3 runs (comparison)
- Agent 3: 3 months of data (trends)

### 2. Architecture for Large Context
**Problem**: Data appears incomplete or curtailed
**Solution**: Pass complete, untruncated Garmin data to agents
- No summarization before LLM sees it
- Let LLM decide what's important
- Provide full lap details, HR zones, weather, etc.

### 3. Output Formatting
**Required Format** (from example):
```
**Strengths:**
- Great negative split strategy - you warmed up properly in lap 1
- Excellent consistency in laps 2-5 (all within 6 seconds)
- Strong cadence throughout
- High training effect shows you pushed yourself appropriately

**Areas to Consider:**
- Running in 79% humidity is challenging!
- You spent a lot of time in Zone 5
- The heart rate progression (131 → 163 → 168 → 174 → 172) shows good pacing

This was a solid tempo-style run with excellent execution!
```

**Key Elements**:
- Bold section headers with colons
- Bullet points for lists
- Specific data points (lap times, HR values, percentages)
- Conversational, encouraging tone
- Summary statement at end

---

## 🏗️ Refined Architecture

### Current Code to Reuse
✅ **Keep These (Working Well)**:
1. Frontend (React chat interface)
2. Backend API (Node.js routing)
3. MCP Client (async Garmin integration)
4. Intent Router (pattern matching)
5. watsonx Provider (LLM integration)
6. Basic agent structure

### Components to Enhance

#### 1. Base Agent Class (NEW)
Create a flexible base class that all agents inherit from:

```python
class FlexibleRunningAgent:
    """
    Base class for all running analysis agents
    Provides multi-step MCP calling and self-correction
    """
    
    def __init__(self, llm_provider, agent_name, data_scope):
        self.llm = llm_provider
        self.agent_name = agent_name
        self.data_scope = data_scope  # "single", "recent", "trend"
        self.mcp_client = get_garmin_client_async()
    
    async def gather_data(self, user_request: str) -> Dict:
        """
        Multi-step data gathering based on user request
        Self-correcting: if data incomplete, fetch more
        """
        # Step 1: Determine what data is needed
        data_plan = await self._plan_data_gathering(user_request)
        
        # Step 2: Execute MCP calls sequentially
        gathered_data = {}
        for tool_call in data_plan:
            result = await self._execute_mcp_call(tool_call)
            gathered_data[tool_call['name']] = result
            
            # Self-correction: check if we need more data
            if self._needs_more_data(gathered_data, user_request):
                additional_calls = await self._plan_additional_data()
                for call in additional_calls:
                    result = await self._execute_mcp_call(call)
                    gathered_data[call['name']] = result
        
        return gathered_data
    
    async def analyze(self, data: Dict, user_request: str) -> str:
        """
        Analyze gathered data with proper formatting
        """
        # Build analysis prompt with full context
        prompt = self._build_analysis_prompt(data, user_request)
        
        # Call LLM
        response = self.llm.generate(
            messages=[
                {"role": "system", "content": self._get_system_prompt()},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )
        
        # Format output
        formatted = self._format_output(response.get("content", ""))
        return formatted
    
    def _format_output(self, raw_text: str) -> str:
        """
        Ensure output follows required format:
        - **Bold headers:**
        - Bullet points
        - Specific data
        - Encouraging tone
        """
        # Post-process to ensure proper formatting
        # Add bold headers if missing
        # Ensure bullet points
        # Add summary if missing
        return formatted_text
```

#### 2. Data Normalizer (NEW)
Handle all data quality issues in one place:

```python
class GarminDataNormalizer:
    """
    Normalize Garmin data from MCP calls
    Handle incomplete/incorrect data
    Provide clean, complete context to agents
    """
    
    def normalize_activity(self, raw_data: Dict) -> Dict:
        """
        Normalize single activity data
        Extract from splits if summary is empty
        """
        normalized = {
            "activity_id": raw_data.get("activityId"),
            "name": raw_data.get("activityName"),
            "date": raw_data.get("startTimeGMT"),
            "type": raw_data.get("activityTypeDTO", {}).get("typeKey")
        }
        
        # Get metrics from summary or calculate from splits
        if raw_data.get("distance", 0) == 0:
            # Extract from splits
            splits = raw_data.get("splits", {}).get("lapDTOs", [])
            normalized["distance_km"] = sum(s.get("distance", 0) for s in splits) / 1000
            normalized["duration_min"] = sum(s.get("duration", 0) for s in splits) / 60
            normalized["laps"] = self._normalize_laps(splits)
        else:
            # Use summary
            normalized["distance_km"] = raw_data.get("distance") / 1000
            normalized["duration_min"] = raw_data.get("duration") / 60
        
        # Calculate derived metrics
        if normalized["distance_km"] > 0 and normalized["duration_min"] > 0:
            normalized["avg_pace_min_per_km"] = normalized["duration_min"] / normalized["distance_km"]
        
        return normalized
    
    def normalize_hr_zones(self, raw_zones: Dict) -> Dict:
        """
        Normalize HR zone data
        Handle incomplete zone data
        """
        # If only Zone 1, estimate others based on typical distribution
        # Or mark as incomplete
        pass
    
    def provide_full_context(self, activity_data, splits_data, hr_data, weather_data) -> str:
        """
        Combine all data into comprehensive context string
        NO TRUNCATION - provide everything to LLM
        """
        context = f"""
# Activity Overview
- ID: {activity_data['activity_id']}
- Name: {activity_data['name']}
- Date: {activity_data['date']}
- Distance: {activity_data['distance_km']:.2f} km
- Duration: {activity_data['duration_min']:.1f} minutes
- Average Pace: {activity_data['avg_pace_min_per_km']:.2f} min/km

# Lap-by-Lap Performance
"""
        # Include FULL lap details - don't summarize
        for i, lap in enumerate(activity_data.get('laps', []), 1):
            context += f"""
## Lap {i}
- Distance: {lap['distance_km']:.2f} km
- Duration: {lap['duration_min']:.2f} minutes
- Pace: {lap['pace_min_per_km']:.2f} min/km
- Average HR: {lap.get('avg_hr', 'N/A')} bpm
- Max HR: {lap.get('max_hr', 'N/A')} bpm
- Cadence: {lap.get('cadence', 'N/A')} spm
"""
        
        # Include HR zones
        context += "\n# Heart Rate Zones\n"
        # ... full HR zone data
        
        # Include weather
        context += "\n# Weather Conditions\n"
        # ... full weather data
        
        return context
```

#### 3. Output Formatter (NEW)
Ensure consistent, well-formatted output:

```python
class OutputFormatter:
    """
    Format LLM output to match required style
    """
    
    def format_analysis(self, raw_analysis: str) -> str:
        """
        Ensure output has:
        - **Bold section headers:**
        - Bullet points
        - Specific data points
        - Encouraging summary
        """
        # Parse raw analysis
        sections = self._parse_sections(raw_analysis)
        
        # Reformat with proper markdown
        formatted = ""
        
        # Strengths section
        if "strengths" in sections or "positive" in sections:
            formatted += "**Strengths:**\n"
            for point in sections.get("strengths", []):
                formatted += f"- {point}\n"
            formatted += "\n"
        
        # Areas to consider
        if "areas" in sections or "improvements" in sections:
            formatted += "**Areas to Consider:**\n"
            for point in sections.get("areas", []):
                formatted += f"- {point}\n"
            formatted += "\n"
        
        # Summary
        if "summary" in sections:
            formatted += sections["summary"]
        
        return formatted
    
    def ensure_data_specificity(self, text: str, data: Dict) -> str:
        """
        Ensure specific data points are included
        e.g., "lap 1" → "lap 1 (6:34)"
        """
        # Add specific values where generic references exist
        pass
```

---

## 📋 Implementation Steps (Reusing Existing Code)

### Phase 1: Core Enhancements (2-3 hours)

#### Step 1: Create Base Agent Class
**File**: `agent-service/src/agents/base_agent.py`
**Action**: Create FlexibleRunningAgent base class
**Reuses**: Existing MCP client, LLM provider
**New**: Multi-step data gathering, self-correction logic

#### Step 2: Create Data Normalizer
**File**: `agent-service/src/data/normalizer.py`
**Action**: Centralize all data quality handling
**Reuses**: Existing data extraction logic from current_run_analyzer
**New**: Clean interface, full context provision

#### Step 3: Create Output Formatter
**File**: `agent-service/src/formatting/output_formatter.py`
**Action**: Ensure consistent output format
**Reuses**: None (new component)
**New**: Format enforcement, data specificity

### Phase 2: Update Existing Agents (1-2 hours)

#### Step 4: Refactor Current Run Analyzer
**File**: `agent-service/src/agents/current_run_analyzer.py`
**Action**: Inherit from FlexibleRunningAgent
**Changes**:
```python
class CurrentRunAnalyzer(FlexibleRunningAgent):
    def __init__(self, llm_provider):
        super().__init__(llm_provider, "CurrentRunAnalyzer", "single")
    
    async def analyze_latest_run(self):
        # Use base class methods
        data = await self.gather_data("analyze latest run")
        normalized = self.normalizer.normalize_activity(data)
        full_context = self.normalizer.provide_full_context(normalized)
        analysis = await self.analyze(full_context, "analyze latest run")
        return self.formatter.format_analysis(analysis)
```

#### Step 5: Update Last Runs Comparator
**File**: `agent-service/src/agents/last_runs_comparator.py`
**Action**: Inherit from FlexibleRunningAgent
**Scope**: Last 3 runs instead of 1

#### Step 6: Update Fitness Trend Analyzer
**File**: `agent-service/src/agents/fitness_trend_analyzer.py`
**Action**: Inherit from FlexibleRunningAgent
**Scope**: 3 months of data

### Phase 3: Improve Prompts (1 hour)

#### Step 7: Update System Prompts
**Action**: Add explicit formatting instructions
**Example**:
```python
def _get_system_prompt(self):
    return """You are an expert running coach providing analysis.

CRITICAL FORMATTING RULES:
1. Start with **Strengths:** section
   - Use bullet points
   - Include specific data (lap times, HR values, paces)
   - Be encouraging and specific

2. Follow with **Areas to Consider:** section
   - Use bullet points
   - Mention specific metrics
   - Be constructive, not critical

3. End with a summary statement
   - One encouraging sentence
   - Mention the run type and overall quality

EXAMPLE FORMAT:
**Strengths:**
- Great negative split strategy - lap 1 (6:34) then consistent 6:01-6:11
- Excellent HR control - stayed in zones 3-4 for 85% of run
- Strong cadence of 180 spm throughout

**Areas to Consider:**
- Running in 79% humidity is challenging - consider earlier start times
- HR drift of 15 bpm suggests good effort but watch for overtraining

This was a solid tempo run with excellent pacing discipline!

Be specific with numbers. Be encouraging. Be concise."""
```

### Phase 4: Testing & Refinement (1 hour)

#### Step 8: Test with Real Data
- Run "analyze last run"
- Verify format matches example
- Check data completeness
- Ensure no timeouts

#### Step 9: Adjust Timeout Handling
- Increase max_tokens if needed
- Add retry logic
- Implement graceful degradation

---

## 🎯 Expected Outcomes

### After Phase 1-2 (Core + Agents)
✅ Flexible agents that can handle ambiguous requests
✅ Multi-step MCP data gathering
✅ Self-correction when data incomplete
✅ Clean data normalization
✅ Full context passed to LLM (no truncation)

### After Phase 3 (Prompts)
✅ Consistent output formatting
✅ Bold headers and bullet points
✅ Specific data points in analysis
✅ Encouraging, conversational tone
✅ Proper summary statements

### After Phase 4 (Testing)
✅ <10% timeout rate (down from 33%)
✅ 95%+ success rate
✅ Output matches required format
✅ All data quality issues handled

---

## 📊 Code Reuse Strategy

### Keeping (90% of existing code)
- ✅ Frontend (React) - no changes
- ✅ Backend API (Node.js) - no changes
- ✅ MCP Client - no changes
- ✅ watsonx Provider - minor enhancement
- ✅ Intent Router - no changes
- ✅ Database schema - no changes
- ✅ Configuration system - no changes

### Enhancing (10% new/modified)
- 🔄 Agent classes - inherit from new base
- 🔄 Data extraction - move to normalizer
- 🔄 Prompt building - use full context
- 🆕 Base agent class - new
- 🆕 Data normalizer - new
- 🆕 Output formatter - new

---

## 🚀 Quick Start (Next Session)

```bash
# 1. Create new components
touch agent-service/src/agents/base_agent.py
touch agent-service/src/data/normalizer.py
touch agent-service/src/formatting/output_formatter.py

# 2. Implement base agent (30 min)
# 3. Implement normalizer (30 min)
# 4. Implement formatter (30 min)
# 5. Update current_run_analyzer (30 min)
# 6. Test (30 min)

# Total: ~2.5 hours for working system
```

---

## 📝 Success Criteria

### Must Have
- [ ] Agents can handle "analyze last run", "compare recent runs", "show trends"
- [ ] Output format matches example (bold headers, bullets, specific data)
- [ ] Full Garmin data passed to LLM (no truncation)
- [ ] <10% timeout rate
- [ ] Self-correction when data incomplete

### Nice to Have
- [ ] Response streaming
- [ ] Caching of recent analyses
- [ ] Multiple output formats (detailed vs summary)
- [ ] Training plan generation

---

## 🔄 Migration Path

### Week 1: Core (This Plan)
- Implement base agent, normalizer, formatter
- Update 3 existing agents
- Test and refine

### Week 2: Intelligence
- Add LLM-driven tool selection
- Implement conversation memory
- Add more intents

### Week 3: Features
- Coach orchestrator
- Training plans
- Progress tracking

---

**Plan Created**: 2026-01-24 14:47 SGT  
**Estimated Time**: 2-3 hours for Phase 1-2  
**Risk**: Low (reusing 90% of existing code)  
**Impact**: High (solves all current issues)