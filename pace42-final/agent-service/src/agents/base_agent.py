"""
Flexible Running Agent Base Class

Provides multi-step MCP calling, self-correction, and flexible data gathering
for all running analysis agents.
"""

from typing import Dict, List, Optional, Any
from abc import ABC, abstractmethod
import logging

from ..mcp.garmin_client_async import get_garmin_client_async
from ..mcp.garmin_client_v2 import get_client_for_user
from ..data.normalizer import GarminDataNormalizer
from ..formatting.output_formatter import OutputFormatter

logger = logging.getLogger(__name__)


class FlexibleRunningAgent(ABC):
    """
    Base class for all running analysis agents.
    Provides multi-step MCP calling and self-correction.
    
    All agents inherit from this and only differ in:
    - Data scope (single run, recent runs, 3-month trend)
    - Analysis focus
    - System prompt
    """
    
    def __init__(self, llm_provider, agent_name: str, data_scope: str, user_id: Optional[str] = None):
        """
        Initialize flexible agent.
        
        Args:
            llm_provider: LLM provider instance (watsonx)
            agent_name: Name of the agent (for logging)
            data_scope: Scope of data ("single", "recent", "trend")
            user_id: Optional user ID for user-scoped data access
        """
        self.llm = llm_provider
        self.agent_name = agent_name
        self.data_scope = data_scope
        self.user_id = user_id
        self.logger = logger  # Set logger first!
        
        # Use user-scoped client if user_id provided, otherwise fallback to singleton
        if user_id:
            self.mcp_client = get_client_for_user(user_id)
            self.logger.info(f"Initialized {agent_name} with scope: {data_scope} for user: {user_id}")
        else:
            self.mcp_client = get_garmin_client_async()
            self.logger.info(f"Initialized {agent_name} with scope: {data_scope}")
        
        self.normalizer = GarminDataNormalizer()
        self.formatter = OutputFormatter()
    
    async def gather_data(self, user_request: str, num_activities: int = 1) -> Dict[str, Any]:
        """
        Multi-step data gathering based on user request.
        Self-correcting: if data incomplete, fetch more.
        
        Args:
            user_request: User's natural language request
            num_activities: Number of activities to fetch (1 for single, 3 for recent, etc.)
            
        Returns:
            Dictionary with all gathered data
        """
        self.logger.info(f"{self.agent_name}: Gathering data for {num_activities} activities")
        
        gathered_data = {
            "activities": [],
            "request": user_request,
            "scope": self.data_scope
        }
        
        try:
            # Step 1: Get list of activities
            # Fetch more activities than needed to ensure we get enough running activities
            # (MCP server may return mixed activity types despite filter)
            fetch_limit = num_activities * 5  # Fetch 5x to account for mixed activities
            activities_list = await self.mcp_client.get_activities(
                activity_type="running",
                limit=fetch_limit
            )
            
            if not activities_list:
                self.logger.warning(f"{self.agent_name}: No activities found")
                return gathered_data
            
            self.logger.info(f"{self.agent_name}: Found {len(activities_list)} running activities from {fetch_limit} fetched")
            
            # Step 2: For each activity (up to num_activities), gather comprehensive data
            activities_processed = 0
            for activity_summary in activities_list:
                if activities_processed >= num_activities:
                    break
                    
                activity_id = activity_summary.get("activityId")
                if not activity_id:
                    continue
                
                activity_data = await self._gather_single_activity_data(activity_id)
                
                # Self-correction: Check if data is complete
                if self._is_data_incomplete(activity_data):
                    self.logger.info(f"{self.agent_name}: Data incomplete for {activity_id}, attempting correction")
                    activity_data = await self._correct_incomplete_data(activity_id, activity_data)
                
                gathered_data["activities"].append(activity_data)
                activities_processed += 1
            
            self.logger.info(f"{self.agent_name}: Successfully gathered data for {len(gathered_data['activities'])} activities")
            
        except Exception as e:
            self.logger.error(f"{self.agent_name}: Error gathering data: {str(e)}")
            gathered_data["error"] = str(e)
        
        return gathered_data
    
    async def _gather_single_activity_data(self, activity_id: str) -> Dict[str, Any]:
        """
        Gather comprehensive data for a single activity.
        Makes 5 sequential MCP calls (Claude Desktop pattern).
        
        Args:
            activity_id: Activity ID to fetch
            
        Returns:
            Dictionary with all activity data
        """
        self.logger.info(f"{self.agent_name}: Gathering data for activity {activity_id}")
        
        activity_data = {
            "activity_id": activity_id,
            "raw_activity": None,
            "raw_splits": None,
            "raw_hr_zones": None,
            "raw_weather": None,
            "normalized": None
        }
        
        try:
            # Call 1: Get activity details
            self.logger.debug(f"{self.agent_name}: Fetching activity details")
            activity_data["raw_activity"] = await self.mcp_client.get_activity_details(activity_id)
            
            # Call 2: Get activity splits (lap-by-lap data)
            self.logger.debug(f"{self.agent_name}: Fetching activity splits")
            activity_data["raw_splits"] = await self.mcp_client.get_activity_splits(activity_id)
            
            # Call 3: Get HR zones
            self.logger.debug(f"{self.agent_name}: Fetching HR zones")
            activity_data["raw_hr_zones"] = await self.mcp_client.get_activity_hr_zones(activity_id)
            
            # Call 4: Get weather
            self.logger.debug(f"{self.agent_name}: Fetching weather data")
            activity_data["raw_weather"] = await self.mcp_client.get_activity_weather(activity_id)
            
            # Normalize all data
            self.logger.debug(f"{self.agent_name}: Normalizing data")
            activity_data["normalized"] = self._normalize_activity_data(activity_data)
            
        except Exception as e:
            self.logger.error(f"{self.agent_name}: Error gathering activity {activity_id}: {str(e)}")
            activity_data["error"] = str(e)
        
        return activity_data
    
    def _normalize_activity_data(self, activity_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Normalize all raw data into clean structure.
        
        Args:
            activity_data: Raw activity data
            
        Returns:
            Normalized data dictionary or None if normalization fails
        """
        try:
            # Get raw data
            raw_activity = activity_data.get("raw_activity", {})
            raw_splits = activity_data.get("raw_splits", {})
            
            # Pass splits data directly to normalizer (it will extract lapDTOs)
            # Don't merge into activity - normalizer handles it separately
            if raw_splits:
                # Add splits data to activity for normalizer to process
                raw_activity["splits_data"] = raw_splits
            
            # Normalize activity (handles data quality issues)
            normalized_activity = self.normalizer.normalize_activity(raw_activity)
            
            # Normalize HR zones
            raw_hr_zones = activity_data.get("raw_hr_zones", [])
            normalized_hr = self.normalizer.normalize_hr_zones(raw_hr_zones)
            
            # Normalize weather
            raw_weather = activity_data.get("raw_weather", {})
            normalized_weather = self.normalizer.normalize_weather(raw_weather)
            
            return {
                "activity": normalized_activity,
                "hr_zones": normalized_hr,
                "weather": normalized_weather
            }
        except Exception as e:
            import traceback
            self.logger.error(f"{self.agent_name}: Error normalizing activity data: {str(e)}")
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def _is_data_incomplete(self, activity_data: Dict[str, Any]) -> bool:
        """
        Check if activity data is incomplete.
        
        Args:
            activity_data: Activity data to check
            
        Returns:
            True if data is incomplete
        """
        if "error" in activity_data:
            return True
        
        normalized = activity_data.get("normalized", {})
        if not normalized:
            return True
        
        activity = normalized.get("activity", {})
        
        # Check if essential data is missing
        if activity.get("distance_km", 0) == 0:
            return True
        
        if activity.get("duration_min", 0) == 0:
            return True
        
        # Check if we have lap data
        if not activity.get("laps"):
            return True
        
        return False
    
    async def _correct_incomplete_data(
        self,
        activity_id: str,
        activity_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Attempt to correct incomplete data.
        
        Args:
            activity_id: Activity ID
            activity_data: Incomplete activity data
            
        Returns:
            Corrected activity data (or original if correction fails)
        """
        self.logger.info(f"{self.agent_name}: Attempting to correct incomplete data for {activity_id}")
        
        # If splits are missing, try fetching again
        if not activity_data.get("raw_splits"):
            try:
                activity_data["raw_splits"] = await self.mcp_client.get_activity_splits(activity_id)
                activity_data["normalized"] = self._normalize_activity_data(activity_data)
                self.logger.info(f"{self.agent_name}: Successfully corrected data with splits")
            except Exception as e:
                self.logger.error(f"{self.agent_name}: Failed to correct data: {str(e)}")
        
        return activity_data
    
    def build_full_context(self, gathered_data: Dict[str, Any]) -> str:
        """
        Build complete context string from gathered data.
        NO TRUNCATION - provide everything to LLM.
        
        Args:
            gathered_data: All gathered data
            
        Returns:
            Complete context string
        """
        context = f"# Analysis Request\n{gathered_data.get('request', 'Analyze running data')}\n\n"
        context += f"# Data Scope\n{gathered_data.get('scope', 'unknown')}\n\n"
        
        activities = gathered_data.get("activities", [])
        
        if not activities:
            return context + "No activity data available.\n"
        
        # Add each activity's full context
        for i, activity_data in enumerate(activities, 1):
            normalized = activity_data.get("normalized", {})
            if not normalized:
                continue
            
            activity = normalized.get("activity", {})
            hr_zones = normalized.get("hr_zones", {})
            weather = normalized.get("weather", {})
            
            if len(activities) > 1:
                context += f"# Activity {i} of {len(activities)}\n\n"
            
            # Use normalizer to provide full context
            context += self.normalizer.provide_full_context(
                activity_data=activity,
                hr_data=hr_zones,
                weather_data=weather
            )
            
            context += "\n---\n\n"
        
        return context
    
    async def analyze(self, gathered_data: Dict[str, Any], user_request: str) -> str:
        """
        Analyze gathered data with proper formatting.
        
        Args:
            gathered_data: All gathered data
            user_request: Original user request
            
        Returns:
            Formatted analysis string
        """
        self.logger.info(f"{self.agent_name}: Starting analysis")
        
        # Build full context
        full_context = self.build_full_context(gathered_data)
        
        # Get system prompt (implemented by subclass)
        system_prompt = self._get_system_prompt()
        
        # Build analysis prompt
        analysis_prompt = self._build_analysis_prompt(full_context, user_request)
        
        try:
            # Call LLM
            self.logger.debug(f"{self.agent_name}: Calling LLM")
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
                return "Unable to generate analysis."
            
            # Format output
            self.logger.debug(f"{self.agent_name}: Formatting output")
            formatted = self.formatter.format_analysis(raw_analysis)
            
            # Ensure data specificity
            activities = gathered_data.get("activities", [])
            if activities and activities[0].get("normalized"):
                activity_data = activities[0]["normalized"]["activity"]
                formatted = self.formatter.ensure_data_specificity(formatted, activity_data)
            
            # Ensure encouraging tone
            formatted = self.formatter.add_encouraging_tone(formatted)
            
            self.logger.info(f"{self.agent_name}: Analysis complete")
            return formatted
            
        except Exception as e:
            self.logger.error(f"{self.agent_name}: Error during analysis: {str(e)}")
            return f"Error generating analysis: {str(e)}"
    
    @abstractmethod
    def _get_system_prompt(self) -> str:
        """
        Get system prompt for this agent.
        Must be implemented by subclass.
        
        Returns:
            System prompt string
        """
        pass
    
    @abstractmethod
    def _build_analysis_prompt(self, context: str, user_request: str) -> str:
        """
        Build analysis prompt for this agent.
        Must be implemented by subclass.
        
        Args:
            context: Full data context
            user_request: User's request
            
        Returns:
            Analysis prompt string
        """
        pass

# Made with Bob
