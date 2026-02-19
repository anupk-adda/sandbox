"""
Coach Agent: Orchestrator
Coordinates all analysis agents and synthesizes comprehensive coaching insights
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
from ..llm import WatsonxProvider
from .current_run_analyzer import CurrentRunAnalyzer
from .last_runs_comparator import LastRunsComparator
from .fitness_trend_analyzer import FitnessTrendAnalyzer

logger = logging.getLogger(__name__)


class CoachOrchestrator:
    """
    Master coach agent that orchestrates all analysis agents and synthesizes results
    """
    
    def __init__(self, llm_provider: Optional[WatsonxProvider] = None):
        """
        Initialize Coach Orchestrator
        
        Args:
            llm_provider: LLM provider instance (creates new if not provided)
        """
        self.llm = llm_provider or WatsonxProvider()
        self.agent_name = "CoachOrchestrator"
        
        # Initialize sub-agents
        self.current_run_analyzer = CurrentRunAnalyzer(self.llm)
        self.runs_comparator = LastRunsComparator(self.llm)
        self.fitness_analyzer = FitnessTrendAnalyzer(self.llm)
        
        logger.info(f"Initialized {self.agent_name} with 3 sub-agents")
    
    async def generate_comprehensive_analysis(
        self,
        include_current_run: bool = True,
        include_recent_comparison: bool = True,
        include_fitness_trends: bool = True,
        num_recent_runs: int = 3,
        trend_months: int = 3
    ) -> Dict[str, Any]:
        """
        Generate comprehensive coaching analysis by orchestrating all agents
        
        Args:
            include_current_run: Include current run analysis
            include_recent_comparison: Include recent runs comparison
            include_fitness_trends: Include fitness trend analysis
            num_recent_runs: Number of recent runs to compare
            trend_months: Number of months for trend analysis
            
        Returns:
            Comprehensive coaching analysis
        """
        try:
            logger.info("Starting comprehensive coaching analysis")
            
            results = {
                "timestamp": datetime.utcnow().isoformat(),
                "agent": self.agent_name
            }
            
            # Run agents in parallel (or sequentially for now)
            # Agent 1: Current Run Analysis
            if include_current_run:
                try:
                    logger.info("Running Agent 1: Current Run Analyzer")
                    current_run_analysis = await self.current_run_analyzer.analyze_latest_run()
                    results["current_run_analysis"] = current_run_analysis
                    logger.info("Agent 1 complete")
                except Exception as e:
                    logger.error(f"Agent 1 failed: {str(e)}")
                    results["current_run_analysis"] = {"error": str(e)}
            
            # Agent 2: Recent Runs Comparison
            if include_recent_comparison:
                try:
                    logger.info(f"Running Agent 2: Last {num_recent_runs} Runs Comparator")
                    comparison_analysis = await self.runs_comparator.analyze_recent_runs(num_recent_runs)
                    results["recent_runs_comparison"] = comparison_analysis
                    logger.info("Agent 2 complete")
                except Exception as e:
                    logger.error(f"Agent 2 failed: {str(e)}")
                    results["recent_runs_comparison"] = {"error": str(e)}
            
            # Agent 3: Fitness Trend Analysis
            if include_fitness_trends:
                try:
                    logger.info(f"Running Agent 3: {trend_months}-Month Fitness Trend Analyzer")
                    fitness_analysis = await self.fitness_analyzer.analyze_fitness_trends(trend_months)
                    results["fitness_trend_analysis"] = fitness_analysis
                    logger.info("Agent 3 complete")
                except Exception as e:
                    logger.error(f"Agent 3 failed: {str(e)}")
                    results["fitness_trend_analysis"] = {"error": str(e)}
            
            # Synthesize all results into coaching narrative
            logger.info("Synthesizing coaching narrative")
            coaching_narrative = self._synthesize_coaching_narrative(results)
            results["coaching_narrative"] = coaching_narrative
            
            # Generate training plans
            logger.info("Generating training plans")
            training_plans = self._generate_training_plans(results)
            results["training_plans"] = training_plans
            
            logger.info("Comprehensive coaching analysis complete")
            return results
            
        except Exception as e:
            logger.error(f"Error in comprehensive analysis: {str(e)}")
            raise
    
    def _synthesize_coaching_narrative(self, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Synthesize all agent outputs into a cohesive coaching narrative
        
        Args:
            analysis_results: Combined results from all agents
            
        Returns:
            Coaching narrative with key insights and recommendations
        """
        try:
            logger.info("Synthesizing coaching narrative from all agents")
            
            # Build synthesis prompt
            prompt = self._build_synthesis_prompt(analysis_results)
            
            # Call LLM for synthesis
            messages = [
                {
                    "role": "system",
                    "content": self._get_synthesis_system_prompt()
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
            
            response = self.llm.generate(
                messages=messages,
                temperature=0.4,  # Slightly higher for more natural narrative
                max_tokens=3000
            )
            
            narrative = {
                "full_narrative": response.get("content", ""),
                "key_insights": self._extract_key_insights(response.get("content", "")),
                "priority_recommendations": self._extract_priority_recommendations(response.get("content", "")),
                "training_focus": self._extract_training_focus(response.get("content", "")),
                "model_used": response.get("model")
            }
            
            logger.info("Coaching narrative synthesis complete")
            return narrative
            
        except Exception as e:
            logger.error(f"Error synthesizing narrative: {str(e)}")
            return {
                "error": str(e),
                "full_narrative": "Unable to generate coaching narrative"
            }
    
    def _get_synthesis_system_prompt(self) -> str:
        """Get system prompt for narrative synthesis"""
        return """You are an expert running coach synthesizing insights from multiple analysis agents.

Your role is to:
1. Integrate insights from current run, recent trends, and long-term fitness analysis
2. Identify the most important patterns and insights
3. Provide a cohesive, actionable coaching narrative
4. Prioritize recommendations based on impact and urgency
5. Maintain a supportive, motivating tone while being data-driven

Consider:
- Immediate concerns (current run issues, injury risk)
- Short-term trends (recent consistency, load progression)
- Long-term trajectory (fitness development, race readiness)
- Balance between pushing forward and recovery
- Realistic, achievable next steps

Create a narrative that feels like a conversation with an experienced coach who knows the athlete's full history."""
    
    def _build_synthesis_prompt(self, results: Dict[str, Any]) -> str:
        """Build synthesis prompt from all agent results"""
        
        prompt = "Synthesize these running analyses into a comprehensive coaching narrative:\n\n"
        
        # Add current run analysis
        if "current_run_analysis" in results and "error" not in results["current_run_analysis"]:
            current = results["current_run_analysis"]
            prompt += "**CURRENT RUN ANALYSIS:**\n"
            prompt += f"- Run Type: {current.get('run_type', 'Unknown')}\n"
            prompt += f"- Pacing: {current.get('pacing_quality', 'Unknown')}\n"
            prompt += f"- Effort: {current.get('effort_level', 'Unknown')}\n"
            prompt += f"- Execution Quality: {current.get('execution_quality', 'N/A')}/10\n"
            if current.get('raw_analysis'):
                prompt += f"\nDetailed Analysis:\n{current['raw_analysis'][:500]}...\n\n"
        
        # Add recent runs comparison
        if "recent_runs_comparison" in results and "error" not in results["recent_runs_comparison"]:
            comparison = results["recent_runs_comparison"]
            prompt += "**RECENT RUNS COMPARISON:**\n"
            prompt += f"- Efficiency Trend: {comparison.get('efficiency_trend', 'Unknown')}\n"
            prompt += f"- Consistency: {comparison.get('consistency_rating', 'Unknown')}\n"
            prompt += f"- Load Progression: {comparison.get('load_progression', 'Unknown')}\n"
            prompt += f"- Recovery Status: {comparison.get('recovery_status', 'Unknown')}\n"
            if comparison.get('risk_flags'):
                prompt += f"- Risk Flags: {', '.join(comparison['risk_flags'])}\n"
            prompt += "\n"
        
        # Add fitness trend analysis
        if "fitness_trend_analysis" in results and "error" not in results["fitness_trend_analysis"]:
            fitness = results["fitness_trend_analysis"]
            prompt += "**FITNESS TREND ANALYSIS:**\n"
            vo2_trend = fitness.get('vo2_max_trend', {})
            prompt += f"- VO2 Max Trend: {vo2_trend.get('direction', 'Unknown')}\n"
            prompt += f"- Training Load: {fitness.get('training_load_trend', 'Unknown')}\n"
            prompt += f"- Fitness Phase: {fitness.get('fitness_phase', 'Unknown')}\n"
            prompt += f"- Trajectory: {fitness.get('fitness_trajectory', 'Unknown')}\n"
            
            race_readiness = fitness.get('race_readiness', {})
            if race_readiness:
                prompt += f"- Race Readiness: 10K={race_readiness.get('10k', 'N/A')}/10, "
                prompt += f"Half={race_readiness.get('half_marathon', 'N/A')}/10, "
                prompt += f"Marathon={race_readiness.get('marathon', 'N/A')}/10\n"
            prompt += "\n"
        
        prompt += """
Please provide a comprehensive coaching narrative with:

1. **Overall Assessment**: Current state and trajectory (2-3 sentences)
2. **Key Insights**: Top 3 most important observations
3. **Priority Recommendations**: Top 3 actionable steps, ordered by importance
4. **Training Focus**: What should be the primary focus for the next 2-4 weeks?
5. **Motivation & Context**: Encouraging perspective on progress and next steps

Format as a cohesive narrative that flows naturally."""
        
        return prompt
    
    def _extract_key_insights(self, narrative: str) -> list:
        """Extract key insights from narrative"""
        insights = []
        lines = narrative.split('\n')
        in_insights = False
        
        for line in lines:
            line = line.strip()
            if 'key insight' in line.lower() or 'important observation' in line.lower():
                in_insights = True
                continue
            
            if in_insights and (line.startswith('-') or line.startswith('•') or 
                               line[0:2].replace('.', '').isdigit()):
                insight = line.lstrip('-•0123456789. ').strip()
                if insight:
                    insights.append(insight)
            
            if in_insights and line.startswith('**') and 'insight' not in line.lower():
                break
        
        return insights[:3]
    
    def _extract_priority_recommendations(self, narrative: str) -> list:
        """Extract priority recommendations from narrative"""
        recommendations = []
        lines = narrative.split('\n')
        in_recommendations = False
        
        for line in lines:
            line = line.strip()
            if 'priority recommendation' in line.lower() or 'actionable step' in line.lower():
                in_recommendations = True
                continue
            
            if in_recommendations and (line.startswith('-') or line.startswith('•') or 
                                      line[0:2].replace('.', '').isdigit()):
                rec = line.lstrip('-•0123456789. ').strip()
                if rec:
                    recommendations.append(rec)
            
            if in_recommendations and line.startswith('**') and 'recommendation' not in line.lower():
                break
        
        return recommendations[:3]
    
    def _extract_training_focus(self, narrative: str) -> str:
        """Extract training focus from narrative"""
        lines = narrative.split('\n')
        
        for i, line in enumerate(lines):
            if 'training focus' in line.lower():
                # Get the next non-empty line
                for j in range(i+1, min(i+5, len(lines))):
                    focus = lines[j].strip().lstrip('-•:').strip()
                    if focus and not focus.startswith('**'):
                        return focus
        
        return "Continue building consistent training base"
    
    def _generate_training_plans(self, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate training plans based on analysis results
        
        Args:
            analysis_results: Combined analysis from all agents
            
        Returns:
            Training plans for different race distances
        """
        try:
            logger.info("Generating training plans")
            
            # For now, return placeholder plans
            # In full implementation, this would use the training plan generation engine
            plans = {
                "10k": {
                    "goal": "10K Race",
                    "duration_weeks": 8,
                    "status": "ready_to_generate",
                    "readiness_score": analysis_results.get("fitness_trend_analysis", {}).get("race_readiness", {}).get("10k", 5)
                },
                "half_marathon": {
                    "goal": "Half Marathon",
                    "duration_weeks": 12,
                    "status": "ready_to_generate",
                    "readiness_score": analysis_results.get("fitness_trend_analysis", {}).get("race_readiness", {}).get("half_marathon", 5)
                },
                "marathon": {
                    "goal": "Marathon",
                    "duration_weeks": 16,
                    "status": "ready_to_generate",
                    "readiness_score": analysis_results.get("fitness_trend_analysis", {}).get("race_readiness", {}).get("marathon", 5)
                }
            }
            
            logger.info("Training plans generated (placeholder)")
            return plans
            
        except Exception as e:
            logger.error(f"Error generating training plans: {str(e)}")
            return {"error": str(e)}


# Made with Bob