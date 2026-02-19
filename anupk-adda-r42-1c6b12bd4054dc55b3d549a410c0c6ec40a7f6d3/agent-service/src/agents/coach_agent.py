"""
Coach Agent - General Running Coach
Handles general running-related questions without requiring Garmin data
"""

from typing import Dict, Any, Optional
import json
import logging
from ..llm import get_llm_provider

logger = logging.getLogger(__name__)


class CoachAgent:
    """
    General Running Coach Agent
    
    Responds to running-related questions with expert coaching advice.
    Politely redirects non-running questions back to running topics.
    """
    
    def __init__(self):
        self.llm = get_llm_provider()
        self.system_prompt = self._get_system_prompt()
        self.planner_prompt = self._get_planner_prompt()
        logger.info("Initialized CoachAgent")
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for the coach agent"""
        return """You are an expert running coach with deep knowledge of:
- Running training principles and methodologies
- Exercise physiology and biomechanics
- Injury prevention and recovery
- Nutrition for runners
- Race preparation and strategy
- Mental aspects of running
- Training plan design
- Running gear and equipment

## Your Role
You provide evidence-based coaching advice on all aspects of running. You are knowledgeable, supportive, and focused on helping runners improve safely and effectively.

## Response Guidelines

### For Running-Related Questions:
- Provide clear, actionable advice
- Base recommendations on established training principles
- Consider safety and injury prevention
- Be specific and practical
- Use examples when helpful
- Acknowledge when you need more information about the runner's specific situation
- Never make medical diagnoses or provide medical treatment advice

### For Non-Running Questions:
Politely redirect the conversation back to running topics. Use responses like:
- "I'm specialized in running coaching and training. I'd be happy to help with questions about running, training plans, race preparation, or running-related topics. What would you like to know about your running?"
- "That's outside my area of expertise as a running coach. However, I can help you with running technique, training strategies, race preparation, or any other running-related questions. What can I help you with?"

## Important Rules
1. **No Hallucination**: Only provide information you're confident about. If unsure, say so.
2. **No Medical Advice**: Never diagnose injuries or prescribe treatments. Recommend seeing a healthcare professional for injuries or medical concerns.
3. **Safety First**: Always prioritize runner safety and injury prevention.
4. **Stay Focused**: Keep responses focused on running and training.
5. **Be Supportive**: Encourage and motivate runners while being realistic.

## Response Format
- Use clear, conversational language
- Structure longer responses with bullet points or sections
- Be concise but thorough
- End with an invitation for follow-up questions when appropriate

Remember: You are a running coach, not a doctor, nutritionist, or general fitness trainer. Stay within your expertise."""

    def _get_planner_prompt(self) -> str:
        """Get the planner prompt for bounded reasoning"""
        return """You are a routing planner for a running coach assistant.
You must output a strict JSON object with the following schema:
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
- If missing key details (goal, distance, injury status, experience), use "ask_clarifying".
- Otherwise use "answer".
"""

    async def answer_question(self, question: str) -> Dict[str, Any]:
        """
        Answer a general running-related question
        
        Args:
            question: The user's question
            
        Returns:
            Dict containing the response and metadata
        """
        logger.info(f"CoachAgent: Answering question: {question[:100]}...")
        
        try:
            plan = await self._plan_action(question)
            result = await self._execute_plan(question, plan)
            logger.info("CoachAgent: Response generated successfully")
            return result
            
        except Exception as e:
            logger.error(f"CoachAgent: Error generating response: {str(e)}")
            return {
                "agent": "CoachAgent",
                "question": question,
                "error": str(e),
                "response": "I apologize, but I encountered an error processing your question. Please try again."
            }

    async def _plan_action(self, question: str) -> Dict[str, Any]:
        """Plan the action with bounded output."""
        messages = [
            {"role": "system", "content": self.planner_prompt},
            {"role": "user", "content": question}
        ]
        response = await self.llm.generate_async(messages)
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

        return {
            "action": action,
            "reason": reason[:200],
            "needs_user_info": needs_user_info[:5]
        }

    async def _execute_plan(self, question: str, plan: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the planned action without tools."""
        action = plan.get("action")
        if action == "decline_non_running":
            response_text = (
                "I'm specialized in running coaching and training. "
                "I can help with running technique, training plans, race prep, or recovery. "
                "What would you like to know about your running?"
            )
            return {
                "agent": "CoachAgent",
                "question": question,
                "response": {"content": response_text},
                "requires_garmin_data": False,
                "plan": plan
            }

        if action == "ask_clarifying":
            missing = plan.get("needs_user_info") or []
            if missing:
                prompt = "I can help—quick clarifying question: " + ", ".join(missing[:3]) + "?"
            else:
                prompt = "I can help—what's your goal, recent mileage, and any injuries?"
            return {
                "agent": "CoachAgent",
                "question": question,
                "response": {"content": prompt},
                "requires_garmin_data": False,
                "plan": plan
            }

        # Default: answer
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": question}
        ]
        response = await self.llm.generate_async(messages)
        return {
            "agent": "CoachAgent",
            "question": question,
            "response": response,
            "requires_garmin_data": False,
            "plan": plan
        }

# Made with Bob
