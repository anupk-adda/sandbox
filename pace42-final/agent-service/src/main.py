"""
Running Coach Agent Service
FastAPI application for LangGraph-based multi-agent coaching system
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
from datetime import datetime, timedelta
import logging

# Import configuration
from .config import load_config
from .llm import get_llm_provider
from .agents import CurrentRunAnalyzer

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Running Coach Agent Service",
    description="Multi-agent system for running analysis and coaching",
    version="1.0.0"
)

# Load configuration
config = load_config()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class RunActivity(BaseModel):
    id: str
    distance_meters: float
    duration_seconds: int
    avg_pace_min_per_km: float
    avg_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    avg_cadence: Optional[int] = None
    avg_power: Optional[float] = None
    elevation_gain_meters: Optional[float] = None
    activity_date: str

class FitnessMetrics(BaseModel):
    vo2_max: Optional[float] = None
    training_load: Optional[float] = None
    recovery_time_hours: Optional[int] = None

class AnalysisRequest(BaseModel):
    current_run: RunActivity
    recent_runs: List[RunActivity] = []
    fitness_metrics: Optional[FitnessMetrics] = None

class AnalysisResponse(BaseModel):
    report_id: str
    timestamp: str
    current_run_analysis: dict
    recent_runs_comparison: Optional[dict] = None
    fitness_trend_analysis: Optional[dict] = None
    coaching_narrative: str
    training_plans: List[dict] = []

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

class ChatResponse(BaseModel):
    response: str
    model: str
    usage: dict

class WeatherRequest(BaseModel):
    latitude: float
    longitude: float

class IntentRequest(BaseModel):
    message: str
    context: Optional[dict] = None

class IntentResponse(BaseModel):
    type: str
    confidence: float
    requiresGarminData: bool
    rationale: str

class PlanRequest(BaseModel):
    goal_distance: str
    target_date: str
    days_per_week: int
    runner_profile: Optional[dict] = None
    num_runs: Optional[int] = 8

# Initialize LLM provider and agents using factory
llm_provider = get_llm_provider()
current_run_analyzer = CurrentRunAnalyzer(llm_provider)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "running-coach-agent-service",
        "version": "1.0.0",
        "llm_provider": config.get("llm", {}).get("provider", "watsonx")
    }

# Reset Garmin MCP client endpoint (called when user disconnects Garmin)
@app.post("/reset-garmin-client")
async def reset_garmin_client_endpoint():
    """
    Reset the Garmin MCP client singleton
    
    This should be called when a user disconnects their Garmin account
    to ensure a fresh connection is established on next use.
    """
    try:
        from .mcp.garmin_client_async import reset_garmin_client
        reset_garmin_client()
        logger.info("Garmin MCP client reset successfully")
        return {"status": "success", "message": "Garmin client reset successfully"}
    except Exception as e:
        logger.error(f"Failed to reset Garmin client: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reset Garmin client: {str(e)}")

# Analysis endpoint
@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_run(request: AnalysisRequest):
    """
    Analyze a run using multi-agent system
    
    This endpoint will:
    1. Run Agent 1 (Current Run Analyzer)
    2. Run Agent 2 (Recent Runs Comparator) if recent runs provided
    3. Run Agent 3 (Fitness Trend Analyzer) if fitness metrics provided
    4. Run Coach Agent to synthesize results
    """
    try:
        # TODO: Implement agent orchestration
        # For now, return a mock response
        
        return AnalysisResponse(
            report_id=f"report_{datetime.utcnow().timestamp()}",
            timestamp=datetime.utcnow().isoformat(),
            current_run_analysis={
                "run_type": "easy",
                "pacing_quality": "consistent",
                "effort_level": "moderate"
            },
            coaching_narrative="Great run! Your pacing was consistent throughout.",
            training_plans=[]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Test endpoint for Current Run Analyzer
@app.post("/analyze-run")
async def analyze_single_run(request: RunActivity):
    """
    Test endpoint for analyzing a single run using Agent 1
    
    This endpoint demonstrates the Current Run Analyzer agent
    """
    try:
        # Convert Pydantic model to dict
        run_data = request.dict()
        
        # Analyze with agent
        analysis = current_run_analyzer.analyze(run_data)
        
        return {
            "status": "success",
            "analysis": analysis
        }
    except Exception as e:
        logger.error(f"Run analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to analyze latest run from Garmin
@app.post("/analyze-latest-run")
async def analyze_latest_garmin_run():
    """
    Fetch and analyze the latest run from Garmin
    
    This endpoint fetches the most recent running activity from Garmin
    and analyzes it using the Current Run Analyzer agent
    """
    try:
        # Fetch and analyze latest run from Garmin (await async method)
        analysis = await current_run_analyzer.analyze_latest_run()
        
        return {
            "status": "success",
            "analysis": analysis
        }
    except Exception as e:
        logger.error(f"Latest run analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
# Endpoint to analyze recent runs and recommend next workout
@app.post("/analyze-recent-runs")
async def analyze_recent_runs(num_runs: int = 3):
    """
    Analyze recent runs and recommend next workout
    
    This endpoint fetches the last N running activities from Garmin,
    analyzes training patterns, and recommends the next optimal workout
    based on training cycle principles
    """
    try:
        from .agents import LastRunsComparator
        
        # Initialize agent
        comparator = LastRunsComparator(llm_provider)
        
        # Fetch and analyze recent runs, get recommendation
        analysis = await comparator.analyze_recent_runs(num_runs=num_runs)
        
        return {
            "status": "success",
            "analysis": analysis
        }
    except Exception as e:
        logger.error(f"Recent runs analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to compare recent runs from Garmin
@app.post("/compare-recent-runs")
async def compare_recent_runs(num_runs: int = 3):
    """
    Fetch and compare recent runs from Garmin
    
    This endpoint fetches the last N running activities from Garmin
    and analyzes them for trends using the Last Runs Comparator agent
    """
    try:
        from .agents import LastRunsComparator
        
        # Initialize agent
        comparator = LastRunsComparator(llm_provider)
        
        # Fetch and analyze recent runs
        analysis = await comparator.analyze_recent_runs(num_runs=num_runs)
        
        return {
            "status": "success",
            "analysis": analysis
        }
    except Exception as e:
        logger.error(f"Recent runs comparison error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to analyze fitness trends
@app.post("/analyze-fitness-trends")
async def analyze_fitness_trends(num_runs: int = 8):
    """
    Analyze fitness trends over last N running activities
    
    This endpoint analyzes training patterns, volume, intensity distribution,
    and provides coaching insights using the Fitness Trend Analyzer agent
    """
    try:
        from .agents import FitnessTrendAnalyzer
        
        # Initialize agent
        analyzer = FitnessTrendAnalyzer(llm_provider)
        
        capped_runs = min(max(num_runs, 1), 8)
        # Analyze fitness trends over last N runs
        analysis = await analyzer.analyze_fitness_trends(num_runs=capped_runs)
        
        return {
            "status": "success",
            "analysis": analysis
        }
    except Exception as e:
        logger.error(f"Fitness trend analysis error: {str(e)}")

# Endpoint for general running coaching questions
@app.post("/coach")
async def coach_question(question: str):
    """
    Answer general running-related questions
    
    This endpoint handles general running coaching questions that don't require
    Garmin data analysis. It provides expert advice on training, technique,
    nutrition, injury prevention, and other running topics.
    
    Non-running questions are politely redirected back to running topics.
    """
    try:
        from .agents.coach_agent import CoachAgent
        
        # Initialize coach agent
        coach = CoachAgent()
        
        # Get answer
        result = await coach.answer_question(question)
        
        return {
            "status": "success",
            "analysis": {
                "agent": result["agent"],
                "analysis": result["response"]["content"] if isinstance(result["response"], dict) else result["response"],
                "question": result["question"],
                "requires_garmin_data": result["requires_garmin_data"]
            }
        }
    except Exception as e:
        logger.error(f"Coach agent error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))

# Running conditions / weather endpoint
@app.post("/running-conditions")
async def running_conditions(request: WeatherRequest):
    """
    Get running conditions based on user location.
    """
    try:
        from .agents.weather_agent import WeatherAgent

        agent = WeatherAgent()
        result = await agent.get_running_conditions(
            latitude=request.latitude,
            longitude=request.longitude
        )
        return {
            "status": "success",
            "analysis": result
        }
    except Exception as e:
        logger.error(f"Weather agent error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# LLM-based intent classification
@app.post("/classify-intent", response_model=IntentResponse)
async def classify_intent(request: IntentRequest):
    """
    Classify user intent into known agent routes.
    """
    try:
        system_prompt = """You are a routing classifier for a running coach app.
Return ONLY JSON with:
{
  "type": "last_run" | "recent_runs" | "fitness_trend" | "weather" | "training_plan" | "general" | "non_running" | "profanity",
  "confidence": 0.0-1.0,
  "requiresGarminData": true|false,
  "rationale": "short reason"
}

Rules:
- last_run: requests about the latest/last run or analysis of a single run
- recent_runs: comparing last runs, recommending next run, training pattern
- fitness_trend: progress over weeks/months
- weather: running conditions, weather near me, is it good to run
- training_plan: plan creation, plan requests, goal race planning
- general: running-related Q&A without needing Garmin data
- non_running: unrelated to running
- profanity: abusive or profane
 - If context indicates an ongoing running conversation, short replies (e.g., "yes", "no", "so a tempo run") should be classified as general.
 - Common misspellings like "temp run" (tempo) and "fartlake" (fartlek) are running-related.
"""
        def normalize_typos(text: str) -> str:
            typo_map = {
                "fartlake": "fartlek",
                "temp run": "tempo run"
            }
            normalized = text
            for key, value in typo_map.items():
                normalized = normalized.replace(key, value)
            return normalized

        context_hint = ""
        if request.context:
            try:
                last_intent = request.context.get("last_intent") or request.context.get("last_detected_intent")
                last_agent = request.context.get("last_agent")
                summary = request.context.get("summary")
                last_user_messages = request.context.get("last_user_messages")
                last_assistant_messages = request.context.get("last_assistant_messages")
                parts = []
                if last_intent:
                    parts.append(f"last_intent={last_intent}")
                if last_agent:
                    parts.append(f"last_agent={last_agent}")
                if summary:
                    parts.append(f"summary={str(summary)[:400]}")
                if isinstance(last_user_messages, list) and last_user_messages:
                    parts.append(f"last_user_messages={str(last_user_messages[-3:])[:300]}")
                if isinstance(last_assistant_messages, list) and last_assistant_messages:
                    parts.append(f"last_assistant_messages={str(last_assistant_messages[-3:])[:300]}")
                if parts:
                    context_hint = "Context: " + " | ".join(parts)
            except Exception:
                context_hint = ""

        normalized_message = normalize_typos(request.message.lower())
        user_content = normalized_message if not context_hint else f"{context_hint}\n\nMessage: {normalized_message}"
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        response = await llm_provider.generate_async(
            messages=messages,
            temperature=0.0,
            max_tokens=200
        )
        content = response.get("content", "") if isinstance(response, dict) else ""
        import json as _json
        data = _json.loads(content)
        return IntentResponse(**data)
    except Exception:
        # Fallback heuristic
        text = request.message.lower()
        if request.context:
            has_context = bool(
                request.context.get("last_intent") or
                request.context.get("last_analysis_text") or
                request.context.get("summary")
            )
            if has_context and len(text.strip()) <= 4:
                return IntentResponse(type="general", confidence=0.6, requiresGarminData=False, rationale="short follow-up")
            if has_context and any(term in text for term in ["tempo", "temp run", "fartlek", "fartlake", "interval"]):
                return IntentResponse(type="general", confidence=0.6, requiresGarminData=False, rationale="running follow-up")
        if any(w in text for w in ["weather", "conditions", "rain", "wind", "temperature"]):
            return IntentResponse(type="weather", confidence=0.6, requiresGarminData=False, rationale="keyword")
        if "last run" in text or "latest run" in text:
            return IntentResponse(type="last_run", confidence=0.6, requiresGarminData=True, rationale="keyword")
        if "next run" in text or "recommend" in text:
            return IntentResponse(type="recent_runs", confidence=0.6, requiresGarminData=True, rationale="keyword")
        if "progress" in text or "trend" in text:
            return IntentResponse(type="fitness_trend", confidence=0.6, requiresGarminData=True, rationale="keyword")
        if "plan" in text or "training plan" in text or "marathon plan" in text:
            return IntentResponse(type="training_plan", confidence=0.6, requiresGarminData=False, rationale="keyword")
        return IntentResponse(type="general", confidence=0.4, requiresGarminData=False, rationale="fallback")
# Comprehensive coaching analysis endpoint
@app.post("/comprehensive-coaching")
async def comprehensive_coaching_analysis(
    include_current_run: bool = True,
    include_recent_comparison: bool = True,
    include_fitness_trends: bool = True,
    num_recent_runs: int = 3,
    trend_months: int = 3
):
    """
    Generate comprehensive coaching analysis using all agents
    
    This endpoint orchestrates all three analysis agents and synthesizes
    their outputs into a cohesive coaching narrative with training plans
    """
    try:
        from .agents import CoachOrchestrator
        
        # Initialize coach orchestrator
        coach = CoachOrchestrator(llm_provider)
        
        # Generate comprehensive analysis
        analysis = await coach.generate_comprehensive_analysis(
            include_current_run=include_current_run,
            include_recent_comparison=include_recent_comparison,
            include_fitness_trends=include_fitness_trends,
            num_recent_runs=num_recent_runs,
            trend_months=trend_months
        )
        
        return {
            "status": "success",
            "analysis": analysis
        }
    except Exception as e:
        logger.error(f"Comprehensive coaching error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

        raise HTTPException(status_code=500, detail=str(e))

        logger.error(f"Recent runs comparison error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Training plan generation endpoint
def _to_iso(date_obj: datetime) -> str:
    return date_obj.strftime("%Y-%m-%d")

def _week_start(date_obj: datetime) -> datetime:
    # Monday as start of week
    day_index = (date_obj.weekday() + 0) % 7
    return datetime(date_obj.year, date_obj.month, date_obj.day) - timedelta(days=day_index)

def _summarize_activities(activities: List[Dict[str, Any]]) -> Dict[str, Any]:
    distances = []
    durations = []
    paces = []
    training_effects = []
    dates = []
    for activity in activities:
        normalized = activity.get("normalized", {})
        activity_data = normalized.get("activity", {}) if isinstance(normalized, dict) else {}
        distance_km = activity_data.get("distance_km", 0) or 0
        duration_min = activity_data.get("duration_min", 0) or 0
        avg_pace = activity_data.get("avg_pace_min_per_km", 0) or 0
        training_effect = activity_data.get("training_effect", 0) or 0
        date_str = activity_data.get("date")
        if distance_km:
            distances.append(distance_km)
        if duration_min:
            durations.append(duration_min)
        if avg_pace:
            paces.append(avg_pace)
        if training_effect:
            training_effects.append(training_effect)
        if date_str:
            dates.append(date_str)

    total_distance = round(sum(distances), 2)
    longest_distance = round(max(distances), 2) if distances else 0
    avg_distance = round(sum(distances) / len(distances), 2) if distances else 0
    avg_pace = round(sum(paces) / len(paces), 2) if paces else 0
    avg_training_effect = round(sum(training_effects) / len(training_effects), 2) if training_effects else 0

    return {
        "num_runs": len(distances),
        "total_distance_km": total_distance,
        "avg_distance_km": avg_distance,
        "longest_distance_km": longest_distance,
        "avg_pace_min_per_km": avg_pace,
        "avg_training_effect": avg_training_effect,
        "latest_run_date": dates[0] if dates else None
    }

def _summarize_from_charts(charts: List[Dict[str, Any]]) -> Dict[str, Any]:
    distance_values: List[float] = []
    pace_values: List[float] = []
    cadence_values: List[float] = []
    hr_values: List[float] = []
    for chart in charts or []:
        if not isinstance(chart, dict):
            continue
        for series in chart.get("series", []) or []:
            label = str(series.get("label", "")).lower()
            data = series.get("data", []) or []
            if not isinstance(data, list):
                continue
            if "distance" in label:
                distance_values.extend([v for v in data if isinstance(v, (int, float))])
            if "pace" in label:
                pace_values.extend([v for v in data if isinstance(v, (int, float))])
            if "cadence" in label:
                cadence_values.extend([v for v in data if isinstance(v, (int, float))])
            if "hr" in label or "heart" in label:
                hr_values.extend([v for v in data if isinstance(v, (int, float))])

    num_runs = len(distance_values)
    total_distance = round(sum(distance_values), 2) if distance_values else 0
    avg_distance = round(total_distance / num_runs, 2) if num_runs else 0
    avg_pace = round(sum(pace_values) / len(pace_values), 2) if pace_values else 0
    avg_cadence = round(sum(cadence_values) / len(cadence_values), 2) if cadence_values else 0
    avg_hr = round(sum(hr_values) / len(hr_values), 2) if hr_values else 0

    return {
        "num_runs": num_runs,
        "total_distance_km": total_distance,
        "avg_distance_km": avg_distance,
        "avg_pace_min_per_km": avg_pace,
        "avg_cadence": avg_cadence,
        "avg_hr": avg_hr,
    }

@app.post("/generate-plan")
async def generate_training_plan(request: PlanRequest):
    """Generate a personalized training plan for a specific goal"""
    try:
        from .agents import FitnessTrendAnalyzer
        import json as _json

        goal_distance = request.goal_distance
        target_date = request.target_date
        days_per_week = request.days_per_week

        # Build week dates for current week
        today = datetime.utcnow()
        week_start = _week_start(today)
        week_dates = [_to_iso(week_start + timedelta(days=i)) for i in range(7)]

        logger.info("Plan generator: building runner context")
        activity_summary = {}
        runner_profile = request.runner_profile or {}
        charts_from_profile = []

        try:
            persona = runner_profile.get("profile", {}).get("persona", {})
            history = persona.get("runner_history") or {}
            charts_from_profile = history.get("charts") or []
        except Exception:
            charts_from_profile = []

        if charts_from_profile:
            activity_summary = _summarize_from_charts(charts_from_profile)
        else:
            try:
                analyzer = FitnessTrendAnalyzer(llm_provider)
                gathered = await analyzer.gather_data(
                    user_request="summarize recent training for plan generation",
                    num_activities=min(max(request.num_runs or 4, 1), 4)
                )
                activities = gathered.get("activities", []) if isinstance(gathered, dict) else []
                activity_summary = _summarize_activities(activities)
            except Exception as e:
                logger.warning(f"Plan generator: Garmin data unavailable: {str(e)}")
                activity_summary = {"num_runs": 0}

        system_prompt = """You are an expert running coach generating an adaptive training plan.
Return ONLY valid JSON with this schema:
{
  "summary": {
    "goal_distance": "5k|10k|half|marathon",
    "goal_date": "YYYY-MM-DD",
    "phase": "base|build|peak|taper",
    "weekly_focus": "short phrase",
    "personalized_because": "short reason tied to runner profile + recent training",
    "next_workouts": [
      {"date": "YYYY-MM-DD", "name": "string", "effort": "RPE 3-4"}
    ]
  },
  "week": {
    "week_start": "YYYY-MM-DD",
    "week_end": "YYYY-MM-DD",
    "days": [
      {"date": "YYYY-MM-DD", "name": "string", "intensity": "easy|tempo|interval|long|recovery|rest", "why": "short reason", "effort": "RPE 3-4"}
    ]
  }
}
Rules:
- Use the provided week dates in order.
- Use the runner profile and recent training summary to choose focus (speed vs stamina).
- Keep it coach-like, practical, and safe for the stated days_per_week.
- Ensure days length is 7; use "Rest" with intensity "rest" if needed.
"""

        user_prompt = f"""
Goal distance: {goal_distance}
Target date: {target_date}
Days per week: {days_per_week}
Week dates: {week_dates}

Runner profile (if any): {runner_profile}
Recent training summary: {activity_summary}

Generate a week plan and summary for the current week.
"""

        response = await llm_provider.generate_async(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=1200
        )

        content = response.get("content", "") if isinstance(response, dict) else ""
        plan_data = _json.loads(content)

        if not isinstance(plan_data, dict):
            raise ValueError("Plan generator returned invalid JSON")

        return {
            "status": "success",
            "plan": plan_data
        }
    except Exception as e:
        logger.error(f"Training plan generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Chat endpoint for testing watsonx
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Intelligent chat endpoint with automatic agent routing
    
    This endpoint detects user intent and automatically calls the appropriate
    agents to fetch and analyze Garmin data when needed.
    """
    try:
        from .agents.intent_router import IntentRouter
        from .agents import LastRunsComparator, FitnessTrendAnalyzer, CoachQAAgent
        
        # Get the last user message
        user_message = request.messages[-1].content if request.messages else ""
        
        # Initialize intent router
        router = IntentRouter()
        routing_decision = router.get_routing_decision(user_message)
        
        logger.info(f"User message: {user_message[:100]}...")
        logger.info(f"Routing decision: {routing_decision}")
        
        # If we should use an agent, call it
        if routing_decision['use_agent'] and routing_decision['intent']:
            intent = routing_decision['intent']
            
            if intent == 'analyze_latest_run':
                # Fetch and analyze latest run
                analysis = await current_run_analyzer.analyze_latest_run()
                response_text = f"I've analyzed your latest run from Garmin:\n\n{analysis.get('raw_analysis', 'Analysis complete')}"
                
            elif intent == 'compare_recent_runs':
                # Compare recent runs
                comparator = LastRunsComparator(llm_provider)
                analysis = await comparator.analyze_recent_runs(num_runs=3)
                response_text = f"I've compared your recent runs:\n\n{analysis.get('raw_analysis', 'Comparison complete')}"
                
            elif intent == 'analyze_fitness_trends':
                # Analyze fitness trends
                analyzer = FitnessTrendAnalyzer(llm_provider)
                analysis = await analyzer.analyze_fitness_trends(months=3)
                response_text = f"I've analyzed your fitness trends:\n\n{analysis.get('raw_analysis', 'Trend analysis complete')}"
                
            elif intent == 'comprehensive_coaching':
                # Run comprehensive coaching
                from .agents import CoachOrchestrator
                orchestrator = CoachOrchestrator(llm_provider)
                analysis = await orchestrator.generate_comprehensive_analysis()
                coaching = analysis.get('coaching_narrative', {})
                response_text = coaching.get('full_narrative', 'Comprehensive analysis complete')
            
            else:
                # Fallback to Q&A
                qa_agent = CoachQAAgent(llm_provider)
                result = await qa_agent.answer_question(user_message)
                response_text = result.get('answer', 'I can help you with your running!')
        
        # If we should fetch data but no specific intent, use Q&A with data
        elif routing_decision['should_fetch_data']:
            # Use Q&A agent which can fetch specific activity data
            qa_agent = CoachQAAgent(llm_provider)
            result = await qa_agent.answer_question(user_message)
            response_text = result.get('answer', 'I can help you with your running!')
        
        # Otherwise, use general LLM chat
        else:
            # Convert Pydantic models to dicts
            messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
            
            # Call watsonx
            response = llm_provider.generate(
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens
            )
            response_text = response.get("content", "")
        
        return ChatResponse(
            response=response_text,
            model="openai/gpt-oss-120b",
            usage={"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0}
        )
    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Running Coach Agent Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "chat": "/chat",
            "analyze": "/analyze",
            "generate_plan": "/generate-plan"
        }
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        reload=True,
        log_level="info"
    )

# Made with Bob

# Q&A endpoint - Interactive coaching questions
@app.post("/ask-coach")
async def ask_coach(request: dict):
    """
    Ask the coach a question about your running activities.
    Supports follow-up questions with context from previous analysis.
    
    Request body:
    {
        "question": "Why was my pace slower today?",
        "activity_id": "optional_activity_id",
        "context": {optional previous analysis context}
    }
    """
    try:
        question = request.get("question")
        if not question:
            raise HTTPException(status_code=400, detail="Question is required")
        
        activity_id = request.get("activity_id")
        context = request.get("context")
        force_answer = bool(request.get("force_answer"))
        
        # Initialize Q&A agent
        from .agents import CoachQAAgent
        qa_agent = CoachQAAgent(llm_provider)
        
        # Get answer
        result = await qa_agent.answer_question(
            question=question,
            context=context,
            activity_id=activity_id,
            force_answer=force_answer
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error in ask-coach endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
