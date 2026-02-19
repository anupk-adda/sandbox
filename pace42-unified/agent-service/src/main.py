"""
pace42 Agent Service
FastAPI application for AI agents with weather integration
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
from datetime import datetime
import logging
import os

from .agents.weather_agent import WeatherAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="pace42 Agent Service",
    description="AI agent service for running coaching",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WeatherRequest(BaseModel):
    latitude: float
    longitude: float

class IntentRequest(BaseModel):
    message: str
    context: Optional[Dict] = None

class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict] = None

class AnalysisResponse(BaseModel):
    agent: str
    analysis: str
    charts: Optional[List[Dict]] = None
    weather: Optional[Dict] = None
    error: Optional[str] = None

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "pace42-agent-service",
        "version": "1.0.0"
    }

@app.post("/running-conditions", response_model=AnalysisResponse)
async def get_running_conditions(request: WeatherRequest):
    try:
        agent = WeatherAgent()
        result = await agent.get_running_conditions(
            latitude=request.latitude,
            longitude=request.longitude
        )
        return AnalysisResponse(
            agent=result["agent"],
            analysis=result["analysis"],
            weather=result["weather"]
        )
    except Exception as e:
        logger.error(f"Weather error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/classify-intent")
async def classify_intent(request: IntentRequest):
    message = request.message.lower()
    
    if any(word in message for word in ["weather", "conditions", "temperature", "rain", "sunny"]):
        return {"type": "weather", "confidence": 0.95, "requiresGarminData": False}
    
    if any(word in message for word in ["last run", "analyze", "my run", "recent run"]):
        return {"type": "last_run", "confidence": 0.90, "requiresGarminData": True}
    
    if any(word in message for word in ["trend", "progress", "fitness", "vo2"]):
        return {"type": "fitness_trend", "confidence": 0.85, "requiresGarminData": True}
    
    if any(word in message for word in ["plan", "training plan", "schedule"]):
        return {"type": "training_plan", "confidence": 0.85, "requiresGarminData": False}
    
    if any(word in message for word in ["recommend", "suggestion", "next run"]):
        return {"type": "recommendation", "confidence": 0.80, "requiresGarminData": True}
    
    return {"type": "general", "confidence": 0.70, "requiresGarminData": False}

@app.post("/analyze-latest-run", response_model=AnalysisResponse)
async def analyze_latest_run():
    return AnalysisResponse(
        agent="Current Run Analyzer",
        analysis="## Run Analysis\n\nConnect your Garmin account to see detailed run analysis.\n\nI'll analyze:\n- Pace consistency\n- Heart rate zones\n- Cadence and form\n- Elevation changes",
        charts=[]
    )

@app.post("/analyze-fitness-trends", response_model=AnalysisResponse)
async def analyze_fitness_trends(num_runs: int = 8):
    return AnalysisResponse(
        agent="Fitness Trend Analyzer",
        analysis=f"## Fitness Trend Analysis\n\nConnect your Garmin account to see fitness trends over the last {num_runs} runs.\n\nI'll track:\n- VO2 Max estimates\n- Training load progression\n- Recovery patterns\n- Performance improvements",
        charts=[]
    )

@app.post("/ask-coach", response_model=AnalysisResponse)
async def ask_coach(request: ChatRequest):
    message = request.message.lower()
    
    if "easy pace" in message:
        return AnalysisResponse(
            agent="Coach Agent",
            analysis="**Easy Pace**\n\nEasy runs should feel conversational.\n\n- **Heart Rate**: Zone 1-2 (60-70% max HR)\n- **RPE**: 3-4 out of 10\n- **Purpose**: Build aerobic base\n\nAbout 80% of weekly mileage should be easy."
        )
    
    if "tempo" in message:
        return AnalysisResponse(
            agent="Coach Agent",
            analysis="**Tempo Pace**\n\nTempo runs are at lactate threshold - comfortably hard.\n\n- **Heart Rate**: Zone 3-4 (80-90% max HR)\n- **RPE**: 6-7 out of 10\n- **Purpose**: Improve lactate threshold\n\nYou can say a few words but not hold a conversation."
        )
    
    if "interval" in message:
        return AnalysisResponse(
            agent="Coach Agent",
            analysis="**Interval Training**\n\nHigh-intensity efforts with recovery.\n\n- **Heart Rate**: Zone 4-5 (90-95% max HR)\n- **RPE**: 8-9 out of 10\n- **Purpose**: Improve VO2 max and speed\n\nExample: 6 x 400m at 5K pace with 90s recovery."
        )
    
    return AnalysisResponse(
        agent="Coach Agent",
        analysis=f"I'm here to help with your running!\n\nI can help with:\n- Training paces (easy, tempo, interval)\n- Race preparation\n- Recovery strategies\n- Weekly training structure\n\nWhat would you like to know?"
    )

@app.post("/generate-plan")
async def generate_plan(request: Dict[str, Any]):
    goal_distance = request.get("goal_distance", "5k")
    target_date = request.get("target_date", datetime.now().isoformat()[:10])
    days_per_week = request.get("days_per_week", 4)
    
    return {
        "status": "success",
        "plan": {
            "summary": {
                "goal_distance": goal_distance,
                "goal_date": target_date,
                "phase": "Base Building",
                "weekly_focus": "Build aerobic base with easy runs",
                "personalized_because": f"Based on {days_per_week} days/week availability",
                "next_workouts": [
                    {"date": "Tomorrow", "name": "Easy Run", "effort": "Easy"},
                    {"date": "Day 3", "name": "Tempo Run", "effort": "Moderate"},
                    {"date": "Day 5", "name": "Long Run", "effort": "Easy"}
                ]
            },
            "week": {
                "week_start": datetime.now().isoformat()[:10],
                "week_end": datetime.now().isoformat()[:10],
                "days": [
                    {"date": datetime.now().isoformat()[:10], "name": "Easy Run", "intensity": "Low", "why": "Build base"}
                ]
            }
        }
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
