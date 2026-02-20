"""
Agent 1: Current Run Analyzer
Analyzes a single run activity for pacing, HR drift, cadence, power, and execution quality

Refactored to use FlexibleRunningAgent base class for improved flexibility and data handling.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta, timezone
from ..llm import WatsonxProvider
from .base_agent import FlexibleRunningAgent
from ..utils.response_formatter import RunAnalysisFormatter
from ..utils.chart_builder import build_single_run_detail_charts

logger = logging.getLogger(__name__)


class CurrentRunAnalyzer(FlexibleRunningAgent):
    """
    Agent for analyzing current/single run activities.
    Inherits from FlexibleRunningAgent for multi-step data gathering and self-correction.
    """
    
    def __init__(self, llm_provider: Optional[WatsonxProvider] = None, user_id: Optional[str] = None):
        """
        Initialize Current Run Analyzer
        
        Args:
            llm_provider: LLM provider instance (creates new if not provided)
            user_id: Optional user ID for user-scoped data access
        """
        llm = llm_provider or WatsonxProvider()
        super().__init__(llm, "CurrentRunAnalyzer", "single", user_id=user_id)
        self.formatter = RunAnalysisFormatter()
    
    async def analyze_latest_run(self) -> Dict[str, Any]:
        """
        Fetch the latest run from Garmin and analyze it.
        Uses base class methods for flexible data gathering.
        
        Returns:
            Analysis results dictionary with formatted output
        """
        try:
            self.logger.info("Analyzing latest run")
            
            # Use base class to gather data (handles all MCP calls)
            gathered_data = await self.gather_data("analyze latest run", num_activities=4)
            
            if not gathered_data.get("activities"):
                return {
                    "error": "No running activities found",
                    "agent": self.agent_name
                }
            
            # Get activity data
            activity = gathered_data["activities"][0]
            normalized = activity.get("normalized")
            
            # Handle case where normalization failed
            if not normalized:
                return {
                    "agent": self.agent_name,
                    "run_id": activity.get("activity_id"),
                    "analysis": "Unable to analyze - data normalization failed",
                    "has_splits": False,
                    "has_hr_zones": False,
                    "has_weather": False,
                    "warning": "Data normalization incomplete"
                }
            
            activity_data = normalized.get("activity", {})
            
            # Build context and call LLM directly (not using base class analyze)
            full_context = self.build_full_context(gathered_data)
            system_prompt = self._get_system_prompt()
            analysis_prompt = self._build_analysis_prompt(full_context, "analyze latest run")
            
            # Call LLM
            self.logger.info(f"{self.agent_name}: Starting analysis")
            response = await self.llm.generate_async(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": analysis_prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            raw_analysis = response.get("content", "")
            
            if not raw_analysis:
                self.logger.warning(f"{self.agent_name}: Empty response from LLM")
                raw_analysis = "Unable to generate analysis."
            
            # Format the raw LLM output into structured markdown
            formatted_analysis = self.formatter.format_analysis(raw_analysis, activity_data)
            
            # Build single-run detail charts with time/distance on X-axis
            # (not multi-run trend charts with "Run 1, Run 2" labels)
            charts = build_single_run_detail_charts(
                activity_data=activity_data,
                metrics=['pace', 'hr', 'cadence', 'power']
            )

            run_samples = self._build_run_samples(activity_data)

            return {
                "agent": self.agent_name,
                "run_id": activity.get("activity_id"),
                "analysis": formatted_analysis,  # Formatted output
                "raw_analysis": raw_analysis,  # Original LLM output
                "has_splits": bool(activity_data.get("laps")),
                "has_hr_zones": bool(normalized.get("hr_zones", {}).get("zones")),
                "has_weather": bool(normalized.get("weather", {}).get("available")),
                "charts": charts,
                "run_samples": run_samples
            }
            
        except Exception as e:
            self.logger.error(f"Error analyzing latest run: {str(e)}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                "error": str(e),
                "agent": self.agent_name
            }
    
    def _get_system_prompt(self) -> str:
        """
        Get the system prompt for current run analysis.
        Implements abstract method from FlexibleRunningAgent.
        Uses comprehensive coaching framework from RUN_COACH_SYSTEM_PROMPT.MD
        """
        return """# SYSTEM PROMPT: AI Running Coach

You are an experienced running coach analyzing Garmin activity data. Your role is to provide constructive, insightful feedback that helps athletes improve their training and performance.

## Your Coaching Philosophy
- Be encouraging and supportive while being honest about performance
- Focus on actionable insights rather than just data recitation
- Consider the whole athlete - training context, fatigue, life stress, weather
- Celebrate effort and execution, not just fast times
- Build confidence while addressing areas for improvement

## Primary Analysis Framework

When analyzing activity data, systematically evaluate these areas:

### 1. PACING & EXECUTION
- **Average pace**: Compare to athlete's typical training paces and goals
- **Split analysis**:
  - Are splits consistent (even pacing)?
  - Positive split (slowing down) vs negative split (speeding up)?
  - Variability indicates pacing discipline or lack thereof
- **Pace progression**: Did they execute the intended workout structure?

### 2. HEART RATE ANALYSIS
- **Zone distribution**: Time spent in each HR zone
  - Zone 1-2: Easy/Recovery (conversational pace)
  - Zone 3: Tempo/Moderate
  - Zone 4-5: Threshold/Hard efforts
- **HR-Pace relationship**:
  - Rising HR at constant pace = fatigue, heat stress, or dehydration
  - This "cardiac drift" is normal but excessive drift is concerning
- **Effort appropriateness**: Does HR match workout intention?
  - Easy runs should stay Zone 1-2 (many athletes go too hard)
  - Hard workouts should reach Zone 4-5

### 3. RUNNING FORM METRICS
- **Cadence (steps per minute)**:
  - Target: 170-180+ spm for most runners
  - Consistency matters - should stay within 5-10 spm range
  - Drops in cadence signal fatigue
  - Low cadence (<160) often indicates overstriding
- **Vertical oscillation & ground contact time** (if available):
  - Lower is generally more efficient

### 4. TRAINING LOAD & RECOVERY
- **Training Effect scores**:
  - Aerobic TE: Builds endurance base
  - Anaerobic TE: Builds speed/power
  - Should align with workout purpose
- **Training Load**: Is volume/intensity appropriate?
- **Performance Condition**: Real-time fitness indicator
  - Positive = performing above fitness level
  - Negative = fatigue or suboptimal conditions

### 5. ENVIRONMENTAL CONTEXT
- **Elevation/Terrain**:
  - Uphills should show slower pace but maintained effort (steady HR)
  - Adjust expectations based on total elevation gain
- **Weather**:
  - Temperature above 60°F (15°C) affects performance
  - Humidity compounds heat stress
  - Wind, rain impact pacing

### 6. WORKOUT-SPECIFIC ANALYSIS
- **Easy/Recovery Runs**: Should be truly easy (Zone 1-2, conversational)
- **Tempo Runs**: Sustained effort at threshold (Zone 3-4)
- **Intervals**: Clear hard/easy structure, appropriate recovery
- **Long Runs**: Even pacing, appropriate effort level for duration

## Red Flags to Identify

- ⚠️ **Cardiac drift**: HR rising significantly while pace stays flat or drops
- ⚠️ **Chronic Zone 3 training**: Too hard for easy days, too easy for hard days
- ⚠️ **Inconsistent splits**: Poor pacing strategy or energy management
- ⚠️ **Low cadence**: Risk of injury from overstriding
- ⚠️ **Training effect mismatch**: Easy run showing high anaerobic effect
- ⚠️ **Performance condition decline**: Persistent negative scores

## Feedback Structure

When providing feedback, use this format:

1. **Positive Opening**: Start with what went well or effort recognition
2. **Key Observations**: 2-4 most important data points with context
3. **Coaching Points**: Specific, actionable advice
4. **Forward Focus**: What to work on next or adjust going forward

## Tone Guidelines

- **Be conversational**: Avoid robotic data dumps
- **Use "we" language**: "Let's work on..." not "You need to..."
- **Provide context**: Explain *why* something matters, not just *what* the data shows
- **Balance honesty with encouragement**: Address issues without deflating confidence
- **Avoid jargon overload**: Explain technical terms when necessary

## Remember

You're not just analyzing data - you're coaching a human being with goals, limitations, and feelings. Every piece of feedback should move them toward better training and performance while maintaining their motivation and enjoyment of running."""
    
    def _build_run_samples(self, activity_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Build run samples from lap data for charting."""
        laps = activity_data.get("laps", []) or []
        if not laps:
            return []

        start_raw = activity_data.get("date")
        start_dt = None
        if isinstance(start_raw, str):
            try:
                start_dt = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
            except ValueError:
                start_dt = None

        elapsed_s = 0.0
        distance_km = 0.0
        samples: List[Dict[str, Any]] = []

        for lap in laps:
            duration_s = float(lap.get("duration_s") or 0)
            lap_distance = float(lap.get("distance_km") or 0)
            elapsed_s += duration_s
            distance_km += lap_distance

            timestamp = None
            if start_dt:
                timestamp = (start_dt + timedelta(seconds=elapsed_s)).astimezone(timezone.utc).isoformat()
            else:
                # Fallback to an ISO-like timestamp based on elapsed seconds
                timestamp = datetime.now(timezone.utc).isoformat()

            samples.append({
                "timestamp": timestamp,
                "distance_km": round(distance_km, 3),
                "metrics": {
                    "heartRate": lap.get("avg_hr") or None,
                    "pace": lap.get("pace_min_per_km") or None,
                    "cadence": lap.get("avg_cadence") or None,
                    "elevation": lap.get("elevation_gain") or None,
                }
            })

        return samples

    def _build_analysis_prompt(self, context: str, user_request: str) -> str:
        """
        Build analysis prompt for current run.
        Implements abstract method from FlexibleRunningAgent.
        
        Args:
            context: Full data context from base class
            user_request: User's original request
            
        Returns:
            Analysis prompt string
        """
        prompt = f"""You are a running coach. Analyze this activity and provide feedback in the exact format shown below.

Here is an example of the format you must use:

## 📊 Run Summary
5.05km in 31:07 (6:10/km avg) - solid moderate-effort training run

## ✅ Strengths
- Excellent pacing consistency: splits 6:34 → 6:01-6:11 (negative split execution)
- Strong HR control: avg 161 bpm, max 178 - stayed in productive zones 3-4
- Good form: 163 spm cadence maintained throughout

## 🎯 Key Metrics
- **Training Effect**: 3.8 aerobic - highly productive endurance session
- **Heart Rate**: 161/178 bpm - appropriate tempo effort
- **Pacing**: Negative split (faster second half) shows good energy management
- **Form**: 163 spm cadence, 280W power - efficient stride

## 💡 Coaching Points
- Running in 80°F/79% humidity is challenging - your effort was excellent given conditions
- HR drift moderate (131→174 bpm) - normal for heat but watch hydration
- Negative split strategy is textbook - you're learning to pace well

## 🔧 Recommendations
- Consider earlier starts when temp >75°F for better performance
- Plan 24-36hr easy recovery before next quality session (TE 3.8 is high)

---
**Bottom Line**: Outstanding effort in tough conditions - mental toughness really showed! 💪

Now analyze this activity data using the same format:

{context}

Respond with your analysis starting with "## 📊 Run Summary"."""
        
        return prompt


# Made with Bob
