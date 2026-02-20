"""
Agent 2: Last 3 Runs Comparator & Next Run Recommender
Compares recent runs to identify trends and recommends the next workout based on training cycle principles
"""

import logging
from typing import Dict, Any, Optional
from ..llm import WatsonxProvider, get_llm_provider
from .base_agent import FlexibleRunningAgent
from ..utils.response_formatter import RunAnalysisFormatter
from ..utils.chart_builder import build_run_metric_charts

logger = logging.getLogger(__name__)


class LastRunsComparator(FlexibleRunningAgent):
    """
    Agent for comparing recent runs and recommending next workout.
    Inherits from FlexibleRunningAgent for multi-step data gathering.
    """
    
    def __init__(self, llm_provider: Optional[WatsonxProvider] = None, user_id: Optional[str] = None):
        """
        Initialize Last Runs Comparator
        
        Args:
            llm_provider: LLM provider instance (creates new if not provided)
            user_id: Optional user ID for user-scoped data access
        """
        llm = llm_provider or WatsonxProvider()
        super().__init__(llm, "LastRunsComparator", "multiple", user_id=user_id)
        self.formatter = RunAnalysisFormatter()
    
    async def analyze_recent_runs(self, num_runs: int = 3) -> Dict[str, Any]:
        """
        Fetch and analyze the last N runs, then recommend next workout.
        
        Args:
            num_runs: Number of recent runs to analyze (default: 3)
            
        Returns:
            Analysis and recommendation results
        """
        try:
            self.logger.info(f"Analyzing last {num_runs} runs and recommending next workout")
            
            # Use base class to gather data (handles all MCP calls)
            gathered_data = await self.gather_data(
                f"analyze last {num_runs} runs and recommend next workout",
                num_activities=num_runs
            )
            
            if not gathered_data.get("activities"):
                return {
                    "error": "No running activities found",
                    "agent": self.agent_name
                }
            
            # Get activities data
            activities = gathered_data["activities"]
            
            # Build context and call LLM directly
            full_context = self.build_full_context(gathered_data)
            system_prompt = self._get_system_prompt()
            analysis_prompt = self._build_analysis_prompt(full_context, f"analyze last {num_runs} runs")
            
            # Call LLM
            self.logger.info(f"{self.agent_name}: Starting analysis and recommendation")
            response = await self.llm.generate_async(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": analysis_prompt}
                ],
                temperature=0.3,
                max_tokens=2500
            )
            
            raw_analysis = response.get("content", "")
            
            if not raw_analysis:
                self.logger.warning(f"{self.agent_name}: Empty response from LLM")
                raw_analysis = "Unable to generate analysis and recommendation."
            
            # Clean up response - remove any thinking process or meta-commentary
            cleaned_analysis = self._clean_response(raw_analysis)
            
            charts = build_run_metric_charts(activities, max_runs=min(num_runs, 4))

            return {
                "agent": self.agent_name,
                "num_runs_analyzed": len(activities),
                "analysis": cleaned_analysis,
                "raw_analysis": raw_analysis,
                "charts": charts,
                "activities_analyzed": [
                    {
                        "run_id": act.get("activity_id"),
                        "date": act.get("normalized", {}).get("activity", {}).get("date") if act.get("normalized") else None,
                        "distance_km": act.get("normalized", {}).get("activity", {}).get("distance_km") if act.get("normalized") else None
                    }
                    for act in activities
                    if act is not None
                ]
            }
            
        except Exception as e:
            self.logger.error(f"Error analyzing recent runs: {str(e)}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                "error": str(e),
                "agent": self.agent_name
            }
    
    def _get_system_prompt(self) -> str:
        """
        Get the system prompt for recent runs comparison and next workout recommendation.
        Implements abstract method from FlexibleRunningAgent.
        """
        return """# SYSTEM PROMPT: AI Running Coach - Recent Runs Analysis & Next Workout Recommendation

You are an experienced running coach analyzing recent training patterns and recommending the next optimal workout.

CRITICAL OUTPUT RULES:
1. Start your response IMMEDIATELY with "### 📊 Recent Training Pattern"
2. Do NOT include ANY thinking process, reasoning, or planning
3. Do NOT write "We need to", "Let me", "I will", or similar phrases
4. Output ONLY the formatted markdown sections below
5. Be direct and professional - write as if speaking to the athlete

## Your Role
1. Analyze the last 3 runs to identify patterns, trends, and training load
2. Determine what type of workout the athlete needs next
3. Provide a specific, actionable workout recommendation

## Training Cycle Principles

### Weekly Structure (4-6 running days)
A well-structured week includes ONE of each key session:
- **1 Long Run**: Longest weekly mileage (typically weekends)
- **1 Threshold/Tempo Run**: Comfortably hard, 20-40 min sustained effort at HM-Marathon pace
- **1 VO2max Interval Session**: High-intensity intervals (200m-1600m repeats)
- **Easy Runs**: Fill remaining days (70-80% of weekly mileage)

### Hard-Easy Principle
**NEVER stack intense workouts back-to-back.** Place easy runs or rest days between quality sessions.

### Workout Sequencing
Common effective patterns:
- Long run → easy → tempo → easy → VO2max → easy → rest
- VO2max → easy → tempo → easy → easy → long run → rest

### Recovery Requirements
- **48 hours minimum** between high-intensity sessions
- Long runs count as "hard" days due to volume stress
- Easy runs are TRUE recovery (conversational pace)

## Analysis Framework

### 1. RECENT PATTERN IDENTIFICATION
Look at the last 3 runs:
- What types of workouts were done? (easy, tempo, intervals, long)
- What was the intensity distribution?
- How many days between runs?
- Any signs of fatigue or declining performance?

### 2. TRAINING LOAD ASSESSMENT
- Is volume increasing appropriately (≤10-12% per week)?
- Are hard sessions spaced properly?
- Is there adequate recovery between quality workouts?

### 3. NEXT WORKOUT DETERMINATION
Based on recent pattern, recommend:

**If last run was LONG RUN:**
→ Recommend: Easy recovery run or rest day

**If last run was TEMPO/THRESHOLD:**
→ Recommend: Easy run (need 48h before next hard session)

**If last run was VO2MAX INTERVALS:**
→ Recommend: Easy run (need 48h+ recovery)

**If last 2-3 runs were ALL EASY:**
→ Recommend: Quality workout (tempo or intervals, depending on what's missing)

**If no long run in last 3 runs:**
→ Consider recommending long run (if enough recovery time)

**If no speed work in last 3 runs:**
→ Consider recommending intervals (if enough recovery time)

### 4. WORKOUT SPECIFICITY
When recommending a workout, be SPECIFIC:
- **Easy Run**: "5-8 km at conversational pace, HR Zone 1-2"
- **Tempo Run**: "2 km warm-up, 4 km at half-marathon pace (Zone 3-4), 1 km cool-down"
- **Intervals**: "2 km warm-up, 6 x 800m at 5K pace with 400m jog recovery, 1 km cool-down"
- **Long Run**: "12-16 km at easy pace, last 3 km can be at marathon pace"

## Output Format

Provide your analysis in this structure:

### 📊 Recent Training Pattern
- Summary of last 3 runs (type, intensity, spacing)
- Training load trend
- Recovery adequacy

### 💡 Key Observations
- What's working well
- Any concerns or patterns to address
- Missing workout types

### 🎯 Next Workout Recommendation
**Workout Type**: [Easy/Tempo/Intervals/Long Run]
**Rationale**: [Why this workout now, based on training cycle principles]
**Specific Workout**: [Detailed workout prescription with paces/zones]
**Duration/Distance**: [Expected time and distance]
**Key Focus**: [What to emphasize during this workout]

### ⚠️ Important Notes
- Recovery considerations
- Any adjustments based on fatigue signs
- When to schedule the next hard session

Be encouraging, specific, and always prioritize injury prevention over performance gains."""
    
    def _build_analysis_prompt(self, context: str, user_request: str) -> str:
        """
        Build analysis prompt for recent runs comparison.
        Overrides base class method to add recommendation focus.
        """
        return f"""{context}

Based on these recent runs, please:

1. **Analyze the training pattern**: What types of workouts were done? How is the load progressing?

2. **Assess recovery**: Are hard sessions properly spaced? Any signs of fatigue?

3. **Recommend the next workout**: Following training cycle principles (hard-easy, 48h recovery, weekly structure), what specific workout should the athlete do next?

Provide a structured analysis with a clear, actionable workout recommendation."""
    
    def _clean_response(self, response: str) -> str:
        """
        Clean up LLM response by removing thinking process and meta-commentary.
        Aggressively removes everything before the first markdown section.
        
        Args:
            response: Raw LLM response
            
        Returns:
            Cleaned response starting with markdown sections
        """
        # Find the first occurrence of the expected markdown header
        markers = [
            "### 📊 Recent Training Pattern",
            "### Recent Training Pattern",
            "###📊",
            "## Recent Training Pattern"
        ]
        
        for marker in markers:
            if marker in response:
                # Extract everything from this marker onwards
                idx = response.index(marker)
                cleaned = response[idx:].strip()
                self.logger.info(f"Cleaned response: removed {idx} characters of thinking process")
                return cleaned
        
        # If no marker found, try to find any ### header
        lines = response.split('\n')
        for i, line in enumerate(lines):
            if line.strip().startswith('###'):
                cleaned = '\n'.join(lines[i:]).strip()
                self.logger.info(f"Cleaned response: found ### at line {i}")
                return cleaned
        
        # Last resort: return original with warning
        self.logger.warning("Could not find markdown sections in response, returning original")
        return response


# Made with Bob
