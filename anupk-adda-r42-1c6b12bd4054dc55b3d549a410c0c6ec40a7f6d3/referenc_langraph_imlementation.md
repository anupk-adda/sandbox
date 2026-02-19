from typing import TypedDict, Annotated, Sequence, Literal
from langgraph.graph import StateGraph, END
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
import operator
from datetime import datetime, timedelta
import json

# ============================================================================
# STATE DEFINITION
# ============================================================================

class TrainingAdvisorState(TypedDict):
    """State for the training advisor agent"""
    messages: Annotated[Sequence[BaseMessage], operator.add]
    user_query: str
    
    # Data collection phase
    recent_activities: list[dict]
    running_activities: list[dict]
    last_3_runs_detailed: list[dict]
    
    # Analysis phase
    training_analysis: dict
    recommendation: str
    
    # Control flow
    current_step: str
    error: str | None


# ============================================================================
# MCP CLIENT WRAPPER
# ============================================================================

class GarminMCPClient:
    """Wrapper for Garmin MCP function calls"""
    
    def __init__(self, mcp_client):
        """
        Args:
            mcp_client: The actual MCP client from your environment
        """
        self.client = mcp_client
    
    async def list_activities(self, limit: int = 10) -> list[dict]:
        """Get recent activities"""
        result = await self.client.call_tool(
            "garmin:list_activities",
            {"limit": limit}
        )
        return self._parse_activity_list(result)
    
    async def get_activity_details(self, activity_id: int) -> dict:
        """Get detailed activity data"""
        result = await self.client.call_tool(
            "garmin:get_activity",
            {"activity_id": activity_id}
        )
        return json.loads(result) if isinstance(result, str) else result
    
    async def get_activity_splits(self, activity_id: int) -> dict:
        """Get lap/split data"""
        result = await self.client.call_tool(
            "garmin:get_activity_splits",
            {"activity_id": activity_id}
        )
        return json.loads(result) if isinstance(result, str) else result
    
    async def get_activity_hr_zones(self, activity_id: int) -> list[dict]:
        """Get heart rate zone data"""
        result = await self.client.call_tool(
            "garmin:get_activity_hr_in_timezones",
            {"activity_id": activity_id}
        )
        return json.loads(result) if isinstance(result, str) else result
    
    def _parse_activity_list(self, result: str) -> list[dict]:
        """Parse the text-based activity list into structured data"""
        activities = []
        current_activity = {}
        
        for line in result.split('\n'):
            line = line.strip()
            if line.startswith('--- Activity'):
                if current_activity:
                    activities.append(current_activity)
                current_activity = {}
            elif line.startswith('Activity:'):
                current_activity['name'] = line.split('Activity:')[1].strip()
            elif line.startswith('Type:'):
                current_activity['type'] = line.split('Type:')[1].strip()
            elif line.startswith('Date:'):
                current_activity['date'] = line.split('Date:')[1].strip()
            elif line.startswith('ID:'):
                current_activity['id'] = int(line.split('ID:')[1].strip())
        
        if current_activity:
            activities.append(current_activity)
        
        return activities


# ============================================================================
# AGENT NODES
# ============================================================================

class TrainingAdvisorNodes:
    """All node functions for the training advisor agent"""
    
    def __init__(self, garmin_client: GarminMCPClient, llm: ChatAnthropic):
        self.garmin = garmin_client
        self.llm = llm
    
    async def fetch_recent_activities(self, state: TrainingAdvisorState) -> dict:
        """Node 1: Fetch last 10 activities from Garmin"""
        print("📊 Fetching recent activities...")
        
        try:
            activities = await self.garmin.list_activities(limit=10)
            
            return {
                "recent_activities": activities,
                "current_step": "filter_running",
                "messages": [AIMessage(content=f"✓ Fetched {len(activities)} recent activities")]
            }
        except Exception as e:
            return {
                "error": f"Failed to fetch activities: {str(e)}",
                "current_step": "error"
            }
    
    async def filter_running_activities(self, state: TrainingAdvisorState) -> dict:
        """Node 2: Filter for running activities"""
        print("🏃 Filtering for running activities...")
        
        recent = state["recent_activities"]
        
        # Filter for running type activities
        running_activities = [
            act for act in recent 
            if act.get("type") in ["running", "trail_running", "treadmill_running"]
        ]
        
        if not running_activities:
            return {
                "error": "No running activities found in recent activities",
                "current_step": "error"
            }
        
        return {
            "running_activities": running_activities,
            "current_step": "fetch_detailed",
            "messages": [AIMessage(
                content=f"✓ Found {len(running_activities)} running activities out of {len(recent)} total"
            )]
        }
    
    async def fetch_detailed_data(self, state: TrainingAdvisorState) -> dict:
        """Node 3: Get detailed data for last 3 runs"""
        print("📈 Fetching detailed data for last 3 runs...")
        
        running_activities = state["running_activities"]
        last_3_ids = [act["id"] for act in running_activities[:3]]
        
        detailed_runs = []
        
        for activity_id in last_3_ids:
            try:
                print(f"  Fetching details for activity {activity_id}...")
                
                # Fetch multiple data points in parallel (in real implementation)
                activity_details = await self.garmin.get_activity_details(activity_id)
                splits = await self.garmin.get_activity_splits(activity_id)
                hr_zones = await self.garmin.get_activity_hr_zones(activity_id)
                
                detailed_runs.append({
                    "activity_id": activity_id,
                    "details": activity_details,
                    "splits": splits,
                    "hr_zones": hr_zones
                })
                
            except Exception as e:
                print(f"  ⚠️  Warning: Could not fetch data for {activity_id}: {e}")
                # Continue with other activities
        
        if not detailed_runs:
            return {
                "error": "Failed to fetch detailed data for any runs",
                "current_step": "error"
            }
        
        return {
            "last_3_runs_detailed": detailed_runs,
            "current_step": "analyze_training",
            "messages": [AIMessage(
                content=f"✓ Retrieved detailed data for {len(detailed_runs)} runs"
            )]
        }
    
    async def analyze_training_patterns(self, state: TrainingAdvisorState) -> dict:
        """Node 4: Analyze training patterns using LLM"""
        print("🧠 Analyzing training patterns...")
        
        runs = state["last_3_runs_detailed"]
        
        # Prepare analysis data
        analysis_input = self._prepare_analysis_data(runs)
        
        # Use LLM to analyze patterns
        analysis_prompt = f"""You are an expert running coach analyzing recent training data.

Recent running activities (last 3 runs):
{json.dumps(analysis_input, indent=2)}

Analyze these runs and classify each by type:
- EASY: Zone 1-2 HR, conversational pace, aerobic base building
- TEMPO: Zone 3-4 HR, comfortably hard, lactate threshold training  
- VO2MAX: Zone 4-5 HR, hard effort, 5K-10K race pace
- LONG: Extended duration, steady easy-moderate pace
- RECOVERY: Very easy, short, active recovery

Consider:
1. Heart rate zones (% of max HR)
2. Duration and distance
3. Pace consistency (splits variation)
4. Training effect scores
5. Time between runs

Return a JSON object with:
{{
  "run_classifications": [
    {{
      "activity_id": 123,
      "date": "2026-01-23",
      "type": "TEMPO",
      "quality": "good",
      "notes": "Solid tempo effort, maintained zone 4 HR"
    }}
  ],
  "training_balance": {{
    "easy_runs": 1,
    "hard_runs": 2,
    "total_volume_km": 15.5,
    "hard_easy_ratio": "2:1"
  }},
  "observations": [
    "High hard-to-easy ratio",
    "Insufficient recovery between hard efforts"
  ]
}}
"""
        
        response = await self.llm.ainvoke([
            SystemMessage(content="You are an expert running coach."),
            HumanMessage(content=analysis_prompt)
        ])
        
        # Parse LLM response
        try:
            # Extract JSON from response (handle markdown code blocks)
            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            analysis = json.loads(content.strip())
        except json.JSONDecodeError:
            # Fallback if LLM doesn't return valid JSON
            analysis = {
                "run_classifications": [],
                "training_balance": {},
                "observations": ["Analysis format error - using fallback"]
            }
        
        return {
            "training_analysis": analysis,
            "current_step": "generate_recommendation",
            "messages": [AIMessage(content="✓ Completed training pattern analysis")]
        }
    
    async def generate_recommendation(self, state: TrainingAdvisorState) -> dict:
        """Node 5: Generate next workout recommendation"""
        print("💡 Generating workout recommendation...")
        
        analysis = state["training_analysis"]