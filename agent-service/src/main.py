"""
pace42 Agent Service
FastAPI application for running coach AI with real weather data
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
from datetime import datetime, timedelta
import logging
import httpx
import os

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="pace42 Agent Service",
    description="AI agent service for running coaching with weather integration",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class WeatherRequest(BaseModel):
    latitude: float
    longitude: float

class WeatherHour(BaseModel):
    time: str
    score: int
    label: str
    details: Dict[str, Any]

class WeatherResponse(BaseModel):
    location_label: str
    summary: str
    recommendation: str
    hours: List[WeatherHour]
    attribution: str

class AnalysisResponse(BaseModel):
    agent: str
    analysis: str
    charts: Optional[List[Dict]] = None
    weather: Optional[Dict] = None
    error: Optional[str] = None

class IntentRequest(BaseModel):
    message: str
    context: Optional[Dict] = None

class IntentResponse(BaseModel):
    type: str
    confidence: float
    requiresGarminData: bool
    rationale: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict] = None

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "pace42-agent-service",
        "version": "1.0.0"
    }

# Calculate running condition score (0-100)
def calculate_run_score(temp: float, humidity: float, wind: float, precip: float) -> int:
    """Calculate a running condition score based on weather parameters"""
    score = 100
    
    # Temperature penalty (ideal: 10-18°C)
    if temp < 0:
        score -= 30
    elif temp < 5:
        score -= 20
    elif temp < 10:
        score -= 10
    elif temp > 25:
        score -= 15
    elif temp > 30:
        score -= 30
    elif temp > 35:
        score -= 50
    
    # Humidity penalty (ideal: 40-60%)
    if humidity > 80:
        score -= 15
    elif humidity > 90:
        score -= 25
    
    # Wind penalty
    if wind > 20:
        score -= 20
    elif wind > 30:
        score -= 35
    
    # Precipitation penalty
    if precip > 0:
        score -= 25
    if precip > 2:
        score -= 40
    
    return max(0, min(100, score))

def get_score_label(score: int) -> str:
    """Get label based on score"""
    if score >= 80:
        return "Good"
    elif score >= 60:
        return "Fair"
    else:
        return "Poor"

# Weather endpoint - REAL DATA from Open-Meteo
@app.post("/running-conditions", response_model=AnalysisResponse)
async def get_running_conditions(request: WeatherRequest):
    """
    Get running conditions based on location using real weather data from Open-Meteo
    """
    try:
        logger.info(f"Fetching weather for lat={request.latitude}, lon={request.longitude}")
        
        # Call Open-Meteo API (free, no API key required)
        async with httpx.AsyncClient() as client:
            # Current weather and forecast
            weather_url = (
                f"https://api.open-meteo.com/v1/forecast?"
                f"latitude={request.latitude}&longitude={request.longitude}"
                f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation"
                f"&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation_probability,precipitation"
                f"&timezone=auto&forecast_days=1"
            )
            
            response = await client.get(weather_url, timeout=15.0)
            response.raise_for_status()
            data = response.json()
        
        current = data.get("current", {})
        hourly = data.get("hourly", {})
        
        # Build hourly forecast (next 6 hours)
        hours = []
        current_hour = datetime.now().hour
        
        for i in range(6):
            hour_idx = current_hour + i
            if hour_idx >= len(hourly.get("temperature_2m", [])):
                break
                
            temp = hourly["temperature_2m"][hour_idx]
            humidity = hourly["relative_humidity_2m"][hour_idx]
            wind = hourly["wind_speed_10m"][hour_idx]
            precip = hourly.get("precipitation", [0] * len(hourly["temperature_2m"]))[hour_idx]
            
            score = calculate_run_score(temp, humidity, wind, precip)
            
            time_label = "Now" if i == 0 else f"+{i}h"
            
            hours.append(WeatherHour(
                time=time_label,
                score=score,
                label=get_score_label(score),
                details={
                    "temperature": round(temp, 1),
                    "humidity": humidity,
                    "wind_speed": round(wind, 1),
                    "precipitation": round(precip, 1),
                    "apparent_temperature": round(hourly["apparent_temperature"][hour_idx], 1)
                }
            ))
        
        # Generate summary and recommendation
        current_score = hours[0].score if hours else 70
        current_temp = hours[0].details.get("temperature", 15) if hours else 15
        
        if current_score >= 80:
            summary = "Excellent conditions for running"
            recommendation = f"Great time for a run! Temperature is comfortable at {current_temp}°C."
        elif current_score >= 60:
            summary = "Fair conditions for running"
            recommendation = f"Conditions are acceptable. Temperature is {current_temp}°C. Stay hydrated!"
        else:
            summary = "Poor conditions for running"
            recommendation = f"Consider indoor training or wait for better conditions. Current temp: {current_temp}°C."
        
        weather_data = {
            "location_label": f"{request.latitude:.2f}°N, {request.longitude:.2f}°E",
            "summary": summary,
            "recommendation": recommendation,
            "hours": [h.model_dump() for h in hours],
            "attribution": "Weather data provided by Open-Meteo",
            "current": {
                "temperature": current.get("temperature_2m"),
                "apparent_temperature": current.get("apparent_temperature"),
                "humidity": current.get("relative_humidity_2m"),
                "wind_speed": current.get("wind_speed_10m"),
                "precipitation": current.get("precipitation"),
                "weather_code": current.get("weather_code")
            }
        }
        
        return AnalysisResponse(
            agent="Weather Agent",
            analysis=f"{summary}. {recommendation}",
            weather=weather_data
        )
        
    except httpx.HTTPError as e:
        logger.error(f"Weather API error: {e}")
        raise HTTPException(status_code=503, detail=f"Weather service unavailable: {str(e)}")
    except Exception as e:
        logger.error(f"Error getting weather: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get weather: {str(e)}")

# Intent classification endpoint
@app.post("/classify-intent", response_model=IntentResponse)
async def classify_intent(request: IntentRequest):
    """
    Classify user message intent
    """
    message = request.message.lower()
    
    # Simple rule-based intent classification
    if any(word in message for word in ["weather", "conditions", "temperature", "rain", "sunny", "forecast"]):
        return IntentResponse(
            type="weather",
            confidence=0.95,
            requiresGarminData=False,
            rationale="User asking about weather conditions"
        )
    
    if any(word in message for word in ["last run", "analyze", "analysis", "my run", "recent run"]):
        return IntentResponse(
            type="last_run",
            confidence=0.90,
            requiresGarminData=True,
            rationale="User asking to analyze their run data"
        )
    
    if any(word in message for word in ["trend", "progress", "fitness", "improvement", "vo2", "training load"]):
        return IntentResponse(
            type="fitness_trend",
            confidence=0.85,
            requiresGarminData=True,
            rationale="User asking about fitness trends"
        )
    
    if any(word in message for word in ["plan", "training plan", "schedule", "workout plan"]):
        return IntentResponse(
            type="training_plan",
            confidence=0.85,
            requiresGarminData=False,
            rationale="User asking about training plans"
        )
    
    if any(word in message for word in ["recommend", "suggestion", "what should", "next run"]):
        return IntentResponse(
            type="recommendation",
            confidence=0.80,
            requiresGarminData=True,
            rationale="User asking for workout recommendations"
        )
    
    return IntentResponse(
        type="general",
        confidence=0.70,
        requiresGarminData=False,
        rationale="General running question"
    )

# Analyze latest run endpoint
@app.post("/analyze-latest-run", response_model=AnalysisResponse)
async def analyze_latest_run():
    """
    Analyze user's latest run
    """
    # TODO: Integrate with Garmin to fetch real data
    # For now, return informative message about Garmin integration
    
    return AnalysisResponse(
        agent="Current Run Analyzer",
        analysis="## Run Analysis\n\nTo see your run analysis, please connect your Garmin account.\n\nOnce connected, I'll analyze:\n- **Pace consistency** throughout your run\n- **Heart rate zones** and effort distribution\n- **Cadence** and form metrics\n- **Elevation** changes and their impact\n- **Split times** for each kilometer",
        charts=[]
    )

# Analyze recent runs endpoint
@app.post("/analyze-recent-runs", response_model=AnalysisResponse)
async def analyze_recent_runs():
    """
    Analyze user's recent runs (last 3)
    """
    return AnalysisResponse(
        agent="Recent Runs Comparator",
        analysis="## Recent Runs Comparison\n\nConnect your Garmin account to compare your recent runs.\n\nI'll compare:\n- Pace trends across runs\n- Consistency in performance\n- Recovery patterns\n- Training load distribution",
        charts=[]
    )

# Analyze fitness trend endpoint
@app.post("/analyze-fitness-trends", response_model=AnalysisResponse)
async def analyze_fitness_trends(num_runs: int = 8):
    """
    Analyze user's fitness trend
    """
    return AnalysisResponse(
        agent="Fitness Trend Analyzer",
        analysis=f"## Fitness Trend Analysis\n\nConnect your Garmin account to see your fitness trends over the last {num_runs} runs.\n\nI'll track:\n- **VO2 Max** estimates\n- **Training load** progression\n- **Recovery** patterns\n- **Performance** improvements",
        charts=[]
    )

# Coach Q&A endpoint
@app.post("/ask-coach", response_model=AnalysisResponse)
async def ask_coach(request: ChatRequest):
    """
    Ask the coach a question
    """
    message = request.message.lower()
    
    # Simple response logic - can be enhanced with LLM
    if "easy pace" in message:
        return AnalysisResponse(
            agent="Coach Agent",
            analysis="**Easy Pace**\n\nEasy runs should feel conversational - you should be able to speak in full sentences.\n\n- **Heart Rate**: Zone 1-2 (60-70% max HR)\n- **RPE**: 3-4 out of 10\n- **Purpose**: Build aerobic base, aid recovery\n\nMost of your weekly mileage (about 80%) should be at easy pace."
        )
    
    if "tempo" in message:
        return AnalysisResponse(
            agent="Coach Agent",
            analysis="**Tempo Pace**\n\nTempo runs are at your lactate threshold - comfortably hard.\n\n- **Heart Rate**: Zone 3-4 (80-90% max HR)\n- **RPE**: 6-7 out of 10\n- **Purpose**: Improve lactate threshold, race pace practice\n\nYou should be able to say a few words but not hold a conversation."
        )
    
    if "interval" in message:
        return AnalysisResponse(
            agent="Coach Agent",
            analysis="**Interval Training**\n\nIntervals are short, high-intensity efforts with recovery periods.\n\n- **Heart Rate**: Zone 4-5 (90-95% max HR)\n- **RPE**: 8-9 out of 10\n- **Purpose**: Improve VO2 max, speed, and running economy\n\nExample: 6 x 400m at 5K pace with 90s recovery jog."
        )
    
    return AnalysisResponse(
        agent="Coach Agent",
        analysis=f"I'm here to help with your running! You asked: \"{request.message}\"\n\nI can help you with:\n- Training paces (easy, tempo, interval)\n- Race preparation\n- Recovery strategies\n- Weekly training structure\n\nWhat specific aspect would you like to know more about?"
    )

# Coach endpoint (simple)
@app.post("/coach", response_model=AnalysisResponse)
async def coach(question: str):
    """
    Simple coach endpoint
    """
    return await ask_coach(ChatRequest(message=question))

# Generate training plan endpoint
@app.post("/generate-plan", response_model=Dict[str, Any])
async def generate_plan(request: Dict[str, Any]):
    """
    Generate a training plan
    """
    goal_distance = request.get("goal_distance", "5k")
    target_date = request.get("target_date", (datetime.now() + timedelta(days=90)).isoformat()[:10])
    days_per_week = request.get("days_per_week", 4)
    
    # Generate a simple plan structure
    plan = {
        "status": "success",
        "plan": {
            "summary": {
                "goal_distance": goal_distance,
                "goal_date": target_date,
                "phase": "Base Building",
                "weekly_focus": "Build aerobic base with easy runs",
                "personalized_because": f"Based on your {days_per_week} days/week availability",
                "next_workouts": [
                    {"date": "Tomorrow", "name": "Easy Run", "effort": "Easy"},
                    {"date": "Day 3", "name": "Tempo Run", "effort": "Moderate"},
                    {"date": "Day 5", "name": "Long Run", "effort": "Easy"}
                ]
            },
            "week": {
                "week_start": datetime.now().isoformat()[:10],
                "week_end": (datetime.now() + timedelta(days=6)).isoformat()[:10],
                "days": [
                    {"date": (datetime.now() + timedelta(days=i)).isoformat()[:10], 
                     "name": "Easy Run" if i % 2 == 0 else "Rest", 
                     "intensity": "Low" if i % 2 == 0 else "Rest",
                     "why": "Build aerobic base" if i % 2 == 0 else "Recovery"}
                    for i in range(7)
                ]
            }
        }
    }
    
    return plan

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
