"""
Agent 3: Fitness Trend Analyzer
Analyzes 10+ running activities to identify long-term patterns, trends, and provide coaching insights
"""

import logging
from typing import Dict, Any, Optional
from pathlib import Path
from .base_agent import FlexibleRunningAgent
from ..utils.response_formatter import RunAnalysisFormatter
from ..utils.chart_builder import build_run_metric_charts

logger = logging.getLogger(__name__)


class FitnessTrendAnalyzer(FlexibleRunningAgent):
    """
    Agent for analyzing fitness trends and patterns over 10+ runs.
    Inherits from FlexibleRunningAgent for multi-step data gathering.
    """
    
    def __init__(self, llm_provider: Optional[Any] = None):
        """
        Initialize Fitness Trend Analyzer
        
        Args:
            llm_provider: LLM provider instance (creates new if not provided)
        """
        from ..llm import get_llm_provider
        llm = llm_provider or get_llm_provider()
        super().__init__(llm, "FitnessTrendAnalyzer", "multiple")
        # Note: We don't use RunAnalysisFormatter for multi-run analysis
        # The LLM produces well-structured markdown directly
    
    async def analyze_fitness_trends(self, num_runs: int = 8) -> Dict[str, Any]:
        """
        Fetch and analyze fitness trends over the last N runs.
        
        Args:
            num_runs: Number of recent runs to analyze (default: 10)
            
        Returns:
            Fitness trend analysis and coaching insights
        """
        try:
            capped_runs = min(max(num_runs, 1), 8)
            self.logger.info(f"Analyzing fitness trends over last {capped_runs} runs")
            
            # Use base class to gather data (handles all MCP calls)
            user_request = f"analyze fitness trends over last {capped_runs} runs"
            gathered_data = await self.gather_data(
                user_request,
                num_activities=capped_runs
            )
            
            if not gathered_data.get('activities'):
                return {
                    "error": "No running activities found",
                    "agent": self.agent_name
                }
            
            # Build full context
            full_context = self.build_full_context(gathered_data)
            
            # Get system prompt
            system_prompt = self._get_system_prompt()
            
            # Build analysis prompt
            analysis_prompt = self._build_analysis_prompt(full_context, user_request)
            
            # Call LLM directly (skip base class analyze to avoid single-activity formatter)
            self.logger.info(f"{self.agent_name}: Starting analysis")
            response = await self.llm.generate_async(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": analysis_prompt}
                ],
                temperature=0.3,
                max_tokens=3000
            )
            
            raw_analysis = response.get("content", "")
            
            if not raw_analysis:
                self.logger.warning(f"{self.agent_name}: Empty response from LLM")
                return {
                    "agent": self.agent_name,
                    "num_activities": len(gathered_data['activities']),
                    "raw_analysis": "Unable to generate analysis."
                }
            
            # Clean response (remove any thinking process)
            cleaned_analysis = self._clean_response(raw_analysis)
            
            self.logger.info(f"{self.agent_name}: Analysis complete")
            
            charts = build_run_metric_charts(gathered_data.get("activities", []), max_runs=min(capped_runs, 8))

            return {
                "agent": self.agent_name,
                "num_activities": len(gathered_data['activities']),
                "raw_analysis": cleaned_analysis,
                "charts": charts
            }
            
        except Exception as e:
            self.logger.error(f"Error analyzing fitness trends: {str(e)}", exc_info=True)
            raise
    
    def _get_system_prompt(self) -> str:
        """
        Get system prompt for fitness trend analysis.
        Required by FlexibleRunningAgent base class.
        """
        prompt_file = Path(__file__).parent.parent / "prompts" / "fitness_trend_system_prompt.md"
        try:
            with open(prompt_file, 'r') as f:
                return f.read()
        except FileNotFoundError:
            self.logger.warning(f"System prompt file not found: {prompt_file}, using fallback")
            return self._get_fallback_system_prompt()
    
    def _get_fallback_system_prompt(self) -> str:
        """Fallback system prompt if file not found"""
        return """You are an expert running coach analyzing fitness trends over 10+ runs.

Analyze volume, consistency, intensity distribution (80/20 rule), heart rate patterns,
running form metrics, and training load. Identify patterns like "Gray Zone Trap",
"Weekend Warrior", or overtraining indicators.

Provide structured analysis with:
- Training volume & consistency
- Intensity distribution (vs 80/20 ideal)
- Heart rate patterns
- Running form assessment
- Training load & recovery
- Pattern recognition
- Race readiness (10K, Half, Marathon)
- Specific coaching recommendations

Use data to support observations and provide actionable advice."""
    
    def _build_analysis_prompt(self, context: str, user_request: str) -> str:
        """
        Build analysis prompt for fitness trend analysis.
        Required by FlexibleRunningAgent base class.
        
        Args:
            context: Full data context from base class
            user_request: User's request
            
        Returns:
            Analysis prompt string
        """
        prompt = f"{context}\n\n"
        prompt += f"User Request: {user_request}\n\n"
        prompt += """
Based on these activities, provide a comprehensive fitness trend analysis following the structured format in your system prompt.

Focus on:
1. Volume and consistency patterns
2. Intensity distribution (are they following 80/20 rule?)
3. Heart rate patterns and zones
4. Running form metrics and trends
5. Training load and recovery adequacy
6. Specific pattern recognition (Gray Zone, Weekend Warrior, etc.)
7. Race readiness for 10K, Half Marathon, Marathon
8. Actionable coaching recommendations

Use the data to support your observations and provide specific, actionable advice."""
        
        return prompt
    
    def _build_trend_analysis_prompt(self, gathered_data: Dict[str, Any]) -> str:
        """Build comprehensive trend analysis prompt from gathered data"""
        
        activities = gathered_data.get('activities', [])
        
        if not activities:
            return "No activities available for analysis."
        
        prompt = f"Analyze the following {len(activities)} running activities for fitness trends and patterns:\n\n"
        
        # Add detailed activity information
        for i, activity in enumerate(activities, 1):
            prompt += f"## Run {i}\n"
            prompt += f"**Date:** {activity.get('date', 'Unknown')}\n"
            prompt += f"**Distance:** {activity.get('distance_km', 0):.2f} km\n"
            prompt += f"**Duration:** {activity.get('duration_min', 0):.1f} minutes\n"
            prompt += f"**Avg Pace:** {activity.get('avg_pace', 'N/A')} min/km\n"
            
            if activity.get('avg_hr'):
                prompt += f"**Avg HR:** {activity.get('avg_hr')} bpm (Max: {activity.get('max_hr', 'N/A')} bpm)\n"
            
            if activity.get('avg_cadence'):
                prompt += f"**Cadence:** {activity.get('avg_cadence'):.1f} spm\n"
            
            if activity.get('training_effect'):
                prompt += f"**Training Effect:** {activity.get('training_effect'):.1f}\n"
            
            if activity.get('elevation_gain'):
                prompt += f"**Elevation Gain:** {activity.get('elevation_gain'):.0f} m\n"
            
            # Add splits if available
            splits = activity.get('splits', [])
            if splits:
                prompt += f"**Splits:** "
                split_paces = [f"{s.get('pace', 'N/A')}" for s in splits[:5]]  # First 5 splits
                prompt += ", ".join(split_paces)
                if len(splits) > 5:
                    prompt += f" ... ({len(splits)} total)"
                prompt += "\n"
            
            # Add weather if available
            weather = activity.get('weather', {})
            if weather and weather.get('temp'):
                prompt += f"**Weather:** {weather.get('temp')}°F, {weather.get('humidity', 'N/A')}% humidity\n"
            
            prompt += "\n"
        
        prompt += """
Based on these activities, provide a comprehensive fitness trend analysis following the structured format in your system prompt.

Focus on:
1. Volume and consistency patterns
2. Intensity distribution (are they following 80/20 rule?)
3. Heart rate patterns and zones
4. Running form metrics and trends
5. Training load and recovery adequacy
6. Specific pattern recognition (Gray Zone, Weekend Warrior, etc.)
7. Race readiness for 10K, Half Marathon, Marathon
8. Actionable coaching recommendations

Use the data to support your observations and provide specific, actionable advice."""
        
        return prompt
    
    def _clean_response(self, response: str) -> str:
        """
        Clean LLM response by removing thinking process and meta-commentary.
        Searches for markdown headers and strips everything before them.
        """
        # Look for the first markdown header (## or ###)
        lines = response.split('\n')
        first_header_idx = -1
        
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith('##') or stripped.startswith('###'):
                first_header_idx = i
                break
        
        if first_header_idx > 0:
            # Found a header, remove everything before it
            cleaned = '\n'.join(lines[first_header_idx:])
            removed_chars = len(response) - len(cleaned)
            if removed_chars > 0:
                self.logger.info(f"Cleaned response: removed {removed_chars} characters of thinking process")
            return cleaned
        
        # No header found, return as is
        return response


# Made with Bob
