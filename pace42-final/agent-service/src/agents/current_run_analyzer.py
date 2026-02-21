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
            
            # Get first valid activity (normalization may fail for some entries)
            activities = gathered_data["activities"]
            activity = next(
                (
                    act for act in activities
                    if isinstance(act, dict)
                    and isinstance(act.get("normalized"), dict)
                    and isinstance(act.get("normalized", {}).get("activity"), dict)
                ),
                activities[0]
            )
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

            # Enforce holistic synthesis contract (4-line output)
            if self._is_holistic_output(raw_analysis):
                formatted_analysis = self._normalize_holistic_output(raw_analysis)
            else:
                self.logger.warning(f"{self.agent_name}: Output not in holistic format, using fallback")
                formatted_analysis = self._fallback_holistic_output(activity_data)
            
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
        return """# SYSTEM PROMPT: AI Running Coach (Holistic Synthesis Mode)

You are an experienced running coach analyzing Garmin activity data. Your role is to provide a concise, decision-quality coaching synthesis.

## Behavioral Architecture (Strict)
This is a reasoning-model change. Do NOT narrate metrics sequentially.

### Internal Reasoning (do not output)
Before writing, internally classify:
- Session type (aerobic base, threshold, VO2, recovery, heat-compensated aerobic, fatigue-accumulated)
- Primary limiter (thermal load, aerobic ceiling, glycogen depletion, pacing misallocation, mechanical breakdown)
- Key interaction (pace vs HR drift, cadence stability vs late fade, training effect vs intensity profile)
- Single highest-impact lever
- Next execution cue with a measurable anchor

### Output Contract (Strict)
Return exactly 4 blocks, each one sentence:
1. Session Diagnosis
2. Primary Limiter
3. Performance Lever
4. Next Execution Cue (one technical cue + one measurable anchor)

Constraints:
- Max 120 words total.
- No per-metric headings or sections.
- No repetition of metrics or numbers; avoid repeating the same number.
- No motivational filler or emojis.
- Weather only if it changes interpretation.

Mental model: multi-signal interpretation → performance classification → prescriptive action."""
    
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
        prompt = f"""You are a running coach. Analyze this activity and follow the strict output contract.

Output format (exactly 4 blocks, each one sentence):
Session Diagnosis: ...
Primary Limiter: ...
Performance Lever: ...
Next Execution Cue: ... (include one technical cue + one measurable anchor)

Constraints:
- Max 120 words total.
- No metric-by-metric narration, headings, or bullets.
- No repeated numbers; avoid repeating the same number.
- No motivational filler or emojis.
- Weather only if it changes interpretation.

Activity data:
{context}
"""
        
        return prompt

    def _is_holistic_output(self, text: str) -> bool:
        lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
        if len(lines) < 4:
            return False
        required_prefixes = [
            "session diagnosis:",
            "primary limiter:",
            "performance lever:",
            "next execution cue:",
        ]
        return all(lines[i].lower().startswith(required_prefixes[i]) for i in range(4))

    def _normalize_holistic_output(self, text: str) -> str:
        lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
        lines = lines[:4]
        output = "\n".join(lines)
        words = output.split()
        if len(words) > 120:
            output = " ".join(words[:120]).rstrip() + "..."
        return output

    def _fallback_holistic_output(self, activity_data: Dict[str, Any]) -> str:
        # Minimal, constraint-safe fallback without repeating numbers.
        session_type = "aerobic base"
        training_effect = activity_data.get("training_effect")
        if isinstance(training_effect, (int, float)) and training_effect >= 3.5:
            session_type = "threshold"
        elif isinstance(training_effect, (int, float)) and training_effect < 1.8:
            session_type = "recovery"

        return "\n".join([
            f"Session Diagnosis: {session_type} session with steady effort and controlled output.",
            "Primary Limiter: Aerobic ceiling limited sustained pace late.",
            "Performance Lever: Smooth early pacing to reduce late drift.",
            "Next Execution Cue: Hold relaxed cadence and cap intensity at conversational effort.",
        ])


# Made with Bob
