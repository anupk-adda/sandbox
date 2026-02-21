"""
Coach Q&A Agent - Interactive question answering about running activities
"""
import logging
import json
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime

from ..llm.watsonx_provider import WatsonxProvider
from ..mcp.garmin_client_async import GarminMCPClientAsync

logger = logging.getLogger(__name__)


class CoachQAAgent:
    """
    Interactive Q&A agent that answers user questions about their running activities.
    Maintains conversation context and can reference previous analysis.
    """
    
    def __init__(self, llm_provider: WatsonxProvider):
        self.llm = llm_provider
        self.mcp_client = GarminMCPClientAsync()
        self.conversation_history: List[Dict[str, str]] = []
        self.planner_prompt = self._build_planner_prompt()
        logger.info("Initialized CoachQAAgent")

    def _detect_follow_up(self, question: str, context: Optional[Dict[str, Any]]) -> bool:
        if not context:
            return False
        recent_messages = context.get("recent_messages")
        if not isinstance(recent_messages, list) or len(recent_messages) == 0:
            return False
        lower_q = question.lower().strip()
        followup_starters = (
            "and", "also", "what about", "how about", "then", "so", "now", "ok", "okay", "sure"
        )
        if any(lower_q.startswith(starter) for starter in followup_starters):
            return True
        if len(lower_q.split()) <= 6:
            return True
        if any(token in lower_q for token in ("that", "it", "this", "those", "same", "instead")):
            return True
        if context.get("last_intent") or context.get("summary") or context.get("last_analysis_text"):
            return len(lower_q.split()) <= 10
        return False

    def _format_recent_turns(self, context: Optional[Dict[str, Any]]) -> List[str]:
        if not context:
            return []
        recent_messages = context.get("recent_messages")
        if not isinstance(recent_messages, list) or not recent_messages:
            return []
        lines: List[str] = []
        for msg in recent_messages[-6:]:
            role = msg.get("role", "user")
            content = str(msg.get("content", ""))[:220]
            if content:
                lines.append(f"{role.title()}: {content}")
        return lines
    
    async def answer_question(
        self,
        question: str,
        context: Optional[Dict[str, Any]] = None,
        activity_id: Optional[str] = None,
        force_answer: bool = False
    ) -> Dict[str, Any]:
        """
        Answer a user question about their running activities.
        
        Args:
            question: User's question
            context: Optional context from previous analysis
            activity_id: Optional specific activity to focus on
            
        Returns:
            Dict containing answer and supporting data
        """
        logger.info(f"Processing question: {question[:100]}...")
        
        try:
            plan = await self._plan_action(question, context)
            if force_answer:
                plan["action"] = "answer"
                plan["reason"] = "Forced answer for coachable question."
                logger.info("CoachQAAgent: force_answer applied")
            if plan["action"] == "ask_clarifying" and context:
                persona_profile = context.get("persona_profile")
                if isinstance(persona_profile, dict):
                    runner_profile = persona_profile.get("runner_profile") or {}
                    runner_history = persona_profile.get("runner_history") or {}
                    has_profile = bool(runner_profile.get("proficiency") or runner_profile.get("score"))
                    has_history = bool(runner_history.get("summary"))
                    if has_profile or has_history:
                        plan["action"] = "answer"
                        plan["reason"] = "Profile/history available; answer directly."
            if plan["action"] == "decline_non_running":
                return {
                    "status": "success",
                    "agent": "CoachQAAgent",
                    "question": question,
                    "answer": "I'm specialized in running coaching and training. I can help with running technique, training plans, race preparation, or recovery. What would you like to know about your running?",
                    "timestamp": datetime.utcnow().isoformat(),
                    "plan": plan
                }

            if plan["action"] == "ask_clarifying":
                missing = plan.get("needs_user_info") or []
                if missing:
                    prompt = "I can help—quick clarifying question: " + ", ".join(missing[:1]) + "?"
                else:
                    prompt = "I can help—what's your main goal?"
                return {
                    "status": "success",
                    "agent": "CoachQAAgent",
                    "question": question,
                    "answer": prompt,
                    "timestamp": datetime.utcnow().isoformat(),
                    "plan": plan
                }

            # Fetch activity data if activity_id provided
            activity_data = None
            if activity_id:
                activity_data = await self.mcp_client.get_activity_details(activity_id)
            
            # Build context for the LLM
            system_prompt = self._build_system_prompt()
            user_prompt = self._build_user_prompt(question, context, activity_data)
            
            # Get response from LLM
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            response = await self._call_llm(
                messages=messages,
                temperature=0.7,
                max_tokens=1000
            )
            
            # Extract content from response
            answer = response.get("content", "")
            if not answer:
                # Fallback: check if content is in raw_response
                raw_response = response.get("raw_response", {})
                choices = raw_response.get("choices", [])
                if choices:
                    message = choices[0].get("message", {})
                    # watsonx uses 'reasoning_content' field
                    answer = message.get("content") or message.get("reasoning_content", "")
                    if not answer:
                        answer = "I couldn't generate an answer."
                else:
                    answer = "I couldn't generate an answer."
            
            logger.info(f"Generated answer length: {len(answer)} characters")
            
            # Update conversation history
            self.conversation_history.append({
                "question": question,
                "answer": answer,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Keep only last 10 exchanges
            if len(self.conversation_history) > 10:
                self.conversation_history = self.conversation_history[-10:]
            
            logger.info("Question answered successfully")
            
            return {
                "status": "success",
                "question": question,
                "answer": answer,
                "activity_id": activity_id,
                "timestamp": datetime.utcnow().isoformat(),
                "conversation_length": len(self.conversation_history),
                "plan": plan
            }
            
        except Exception as e:
            logger.error(f"Error answering question: {str(e)}", exc_info=True)
            return {
                "status": "error",
                "question": question,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    def _build_planner_prompt(self) -> str:
        return """You are a routing planner for a running coach assistant.
Return a strict JSON object:
{
  "action": "answer" | "ask_clarifying" | "decline_non_running",
  "reason": "short rationale",
  "needs_user_info": ["string", ...]
}

Rules:
- Only one action.
- Keep reason under 20 words.
- If the question is not about running, set action to "decline_non_running".
- Running-related includes training, technique, race prep, recovery, nutrition, and gear/shoes.
- If context indicates a running analysis or session, treat the question as running-related even if the question is brief.
- Questions about VO2 max, training effect, tags/labels, heart rate zones, pace, splits, cadence, or Garmin metrics are running-related.
- If the user reply is very short (e.g., "y", "yes") and context exists, treat as a running follow-up.
- If missing key details (goal, distance, injury status, experience), use "ask_clarifying".
- Otherwise use "answer".
"""

    async def _plan_action(self, question: str, context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        coachable_terms = [
            "easy pace", "tempo pace", "threshold pace", "expected time", "race time",
            "5k", "10k", "half", "half marathon", "marathon", "training load",
            "recommend my next run", "next run"
        ]
        lower_q = question.lower()
        is_coachable = any(term in lower_q for term in coachable_terms)

        context_hint = ""
        if context:
            parts = []
            last_intent = context.get("last_intent")
            if last_intent:
                parts.append(f"last_intent={last_intent}")
            last_agent = context.get("last_agent")
            if last_agent:
                parts.append(f"last_agent={last_agent}")
            summary = context.get("summary")
            if summary:
                parts.append(f"summary={summary[:400]}")
            last_analysis_text = context.get("last_analysis_text")
            if last_analysis_text:
                parts.append(f"last_analysis={last_analysis_text[:400]}")
            if parts:
                context_hint = "Context: " + " | ".join(parts)

        user_content = question if not context_hint else f"{context_hint}\n\nQuestion: {question}"

        messages = [
            {"role": "system", "content": self.planner_prompt},
            {"role": "user", "content": user_content}
        ]
        response = await self._call_llm(
            messages=messages,
            temperature=0.0,
            max_tokens=200
        )

        content = response.get("content") if isinstance(response, dict) else response
        try:
            plan = json.loads(content) if isinstance(content, str) else {}
        except json.JSONDecodeError:
            plan = {}

        action = plan.get("action")
        if action not in ("answer", "ask_clarifying", "decline_non_running"):
            action = "answer"

        needs_user_info = plan.get("needs_user_info")
        if not isinstance(needs_user_info, list):
            needs_user_info = []

        reason = plan.get("reason")
        if not isinstance(reason, str):
            reason = "Defaulted to answer."

        if context:
            if self._detect_follow_up(question, context) and action != "decline_non_running":
                action = "answer"
                reason = "Follow-up question with context."
            has_running_context = bool(context.get("last_intent") or context.get("last_analysis_text") or context.get("summary"))
            if has_running_context:
                keywords = (
                    "vo2", "v02", "tag", "tagged", "training effect", "heart rate", "hr",
                    "pace", "split", "cadence", "garmin", "run", "workout", "activity", "zone"
                )
                lower_q = question.lower()
                if any(k in lower_q for k in keywords):
                    action = "answer"
                    reason = "Context indicates running follow-up."

                if len(lower_q.strip()) <= 3:
                    action = "answer"
                    reason = "Short follow-up with context."

            persona_profile = context.get("persona_profile")
            if isinstance(persona_profile, dict):
                runner_profile = persona_profile.get("runner_profile") or {}
                runner_history = persona_profile.get("runner_history") or {}
                has_profile = bool(runner_profile.get("proficiency") or runner_profile.get("score"))
                has_history = bool(runner_history.get("summary"))
                if is_coachable and (has_profile or has_history):
                    action = "answer"
                    reason = "Coachable question with profile/history available."

        if is_coachable and action != "decline_non_running":
            action = "answer"
            reason = "Coachable question: answer best-effort."

        return {
            "action": action,
            "reason": reason[:200],
            "needs_user_info": needs_user_info[:5]
        }

    async def _call_llm(self, messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> Dict[str, Any]:
        if hasattr(self.llm, "generate_async"):
            return await self.llm.generate_async(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )

        return await asyncio.to_thread(
            self.llm.generate,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for Q&A"""
        return """You are an expert running coach with deep knowledge of training physiology, 
biomechanics, and performance optimization. You help runners understand their training data 
and make informed decisions about their training.

Your role is to:
1. Answer questions clearly and concisely
2. Provide evidence-based explanations
3. Reference specific data points when available
4. Offer actionable advice
5. Be encouraging and supportive
6. Acknowledge limitations when data is insufficient
7. You have access to the runner's historical data and profile

Communication style:
- Direct and informative
- Use running-specific terminology appropriately
- Provide context and reasoning
- Break down complex concepts
- Be honest about uncertainties
- Treat follow-up questions as continuations; reference the last advice briefly before expanding.
- If clarification is required, ask only one focused question.
- Do not restate entire prior answers; build on them.
- For “next run” requests, look at recent run history and propose a balanced week: include a base/aerobic run, one quality session (tempo or VO2), one long run, and easy/recovery days. Avoid stacking high intensity if recent runs were strenuous.

Critical instruction:
- For common training questions (easy/tempo pace, expected race time, training load, next run),
  provide a best-effort answer using available data. Do NOT ask clarifying questions unless
  there is no history/profile data to base an approximate answer on.

Confidence line:
- End every response with a single short line in this exact format:
  "Confidence: profile-based." if runner profile/history/stats are used,
  or "Confidence: generic guidance." if you had to answer without any user data."""
    
    def _build_user_prompt(
        self,
        question: str,
        context: Optional[Dict[str, Any]],
        activity_data: Optional[Dict[str, Any]]
    ) -> str:
        """Build user prompt with question and context"""
        
        prompt_parts = []

        follow_up = self._detect_follow_up(question, context)
        if follow_up:
            prompt_parts.append("## Follow-up Context")
            prompt_parts.append("Treat this as a follow-up; anchor to the prior advice unless the user changes topic.")
            prompt_parts.append("")

        recent_turns = self._format_recent_turns(context)
        if recent_turns:
            prompt_parts.append("## Conversation Memory")
            prompt_parts.extend(recent_turns)
            prompt_parts.append("")

        # Add conversation history if exists (agent-local)
        if self.conversation_history:
            prompt_parts.append("## Agent Memory")
            for exchange in self.conversation_history[-3:]:
                prompt_parts.append(f"Q: {exchange['question']}")
                prompt_parts.append(f"A: {exchange['answer'][:180]}...")
            prompt_parts.append("")
        
        # Add analysis context if provided
        if context:
            prompt_parts.append("## Recent Analysis Context")

            summary = context.get("summary")
            if summary:
                prompt_parts.append("**Session Summary:**")
                prompt_parts.append(summary)

            last_analysis_text = context.get("last_analysis_text")
            if last_analysis_text:
                prompt_parts.append("\n**Last Analysis Text:**")
                prompt_parts.append(last_analysis_text[:800])

            analysis_by_intent = context.get("analysis_by_intent")
            if isinstance(analysis_by_intent, dict) and analysis_by_intent:
                prompt_parts.append("\n**Analysis By Intent:**")
                for intent, text in list(analysis_by_intent.items())[:3]:
                    prompt_parts.append(f"- {intent}: {str(text)[:400]}")

            if "current_run_analysis" in context:
                cra = context["current_run_analysis"]
                prompt_parts.append("\n**Latest Run Analysis:**")
                if isinstance(cra, str):
                    prompt_parts.append(f"- Notes: {cra[:600]}")
                else:
                    prompt_parts.append(f"- Run Type: {cra.get('run_type', 'unknown')}")
                    prompt_parts.append(f"- Execution Quality: {cra.get('execution_quality', 'N/A')}/10")
                    prompt_parts.append(f"- Effort Level: {cra.get('effort_level', 'unknown')}")

            if "recent_runs_comparison" in context:
                rrc = context["recent_runs_comparison"]
                prompt_parts.append("\n**Recent Trends:**")
                if isinstance(rrc, str):
                    prompt_parts.append(f"- Notes: {rrc[:600]}")
                else:
                    prompt_parts.append(f"- Efficiency: {rrc.get('efficiency_trend', 'unknown')}")
                    prompt_parts.append(f"- Consistency: {rrc.get('consistency_rating', 'unknown')}")
                    prompt_parts.append(f"- Recovery: {rrc.get('recovery_status', 'unknown')}")

            if "fitness_trend_analysis" in context:
                fta = context["fitness_trend_analysis"]
                prompt_parts.append("\n**Fitness Trends (3 months):**")
                if isinstance(fta, str):
                    prompt_parts.append(f"- Notes: {fta[:600]}")
                else:
                    vo2_trend = fta.get('vo2_max_trend', {})
                    prompt_parts.append(f"- VO2 Max: {vo2_trend.get('direction', 'unknown')}")
                    prompt_parts.append(f"- Training Phase: {fta.get('fitness_phase', 'unknown')}")

            persona_profile = context.get("persona_profile")
            if isinstance(persona_profile, dict):
                runner_profile = persona_profile.get("runner_profile", {})
                if runner_profile:
                    prompt_parts.append("\n## Runner Profile")
                    prompt_parts.append(f"- Proficiency: {runner_profile.get('proficiency', 'unknown')}")
                    prompt_parts.append(f"- Score: {runner_profile.get('score', 'N/A')}")
                    tags = runner_profile.get("tags") or []
                    if isinstance(tags, list) and tags:
                        prompt_parts.append(f"- Focus Tags: {', '.join(tags[:6])}")
                    stats = runner_profile.get("stats") or {}
                    if isinstance(stats, dict) and stats:
                        stat_bits = []
                        if stats.get("avg_pace_min_per_km") is not None:
                            stat_bits.append(f"avg_pace_min_per_km={stats['avg_pace_min_per_km']:.2f}")
                        if stats.get("avg_distance_km") is not None:
                            stat_bits.append(f"avg_distance_km={stats['avg_distance_km']:.2f}")
                        if stats.get("avg_hr") is not None:
                            stat_bits.append(f"avg_hr={stats['avg_hr']:.0f}")
                        if stats.get("avg_cadence") is not None:
                            stat_bits.append(f"avg_cadence={stats['avg_cadence']:.0f}")
                        if stat_bits:
                            prompt_parts.append("- Runner stats: " + ", ".join(stat_bits))

                runner_history = persona_profile.get("runner_history")
                if isinstance(runner_history, dict):
                    summary = runner_history.get("summary", "")
                    if summary:
                        prompt_parts.append("\n## Runner History (last 10 runs)")
                        prompt_parts.append(summary[:900])

                    capsule_bits = []
                    if runner_profile:
                        capsule_bits.append(f"proficiency={runner_profile.get('proficiency', 'unknown')}")
                        if runner_profile.get("score") is not None:
                            capsule_bits.append(f"score={runner_profile.get('score')}")
                    if summary:
                        capsule_bits.append("history_summary=available")
                    if capsule_bits:
                        prompt_parts.append("\n## Profile Capsule")
                        prompt_parts.append(", ".join(capsule_bits))

            user_profile = context.get("user_profile")
            if isinstance(user_profile, dict):
                history_summary = user_profile.get("history_summary")
                if history_summary:
                    prompt_parts.append("\n## Session Continuity")
                    prompt_parts.append(history_summary[:900])

            prompt_parts.append("")
        
        # Add specific activity data if provided
        if activity_data:
            prompt_parts.append("## Specific Activity Data")
            prompt_parts.append(f"Activity ID: {activity_data.get('activityId', 'unknown')}")
            prompt_parts.append(f"Name: {activity_data.get('activityName', 'unknown')}")
            prompt_parts.append(f"Distance: {activity_data.get('distance', 0)/1000:.2f} km")
            prompt_parts.append(f"Duration: {activity_data.get('duration', 0)/60:.1f} min")
            
            if 'averageHR' in activity_data:
                prompt_parts.append(f"Avg HR: {activity_data.get('averageHR')} bpm")
            if 'averageRunningCadenceInStepsPerMinute' in activity_data:
                prompt_parts.append(f"Avg Cadence: {activity_data.get('averageRunningCadenceInStepsPerMinute')} spm")
            
            prompt_parts.append("")
        
        # Add the actual question
        prompt_parts.append("## User Question")
        prompt_parts.append(question)
        prompt_parts.append("\nPlease provide a clear, helpful answer based on the available data.")
        
        return "\n".join(prompt_parts)
    
    def clear_history(self):
        """Clear conversation history"""
        self.conversation_history = []
        logger.info("Conversation history cleared")
    
    def get_history(self) -> List[Dict[str, str]]:
        """Get conversation history"""
        return self.conversation_history

# Made with Bob
