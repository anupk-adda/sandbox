"""
Garmin MCP Client (Async)
Handles communication with the Garmin MCP server using the official MCP SDK
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional, Union
from contextlib import asynccontextmanager
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from ..config import get_garmin_config

logger = logging.getLogger(__name__)


class GarminMCPClientAsync:
    """Async client for interacting with Garmin MCP server using official SDK"""
    
    def __init__(self):
        """Initialize Garmin MCP client with configuration"""
        garmin_config = get_garmin_config()
        
        self.python_path = garmin_config.get('mcpPythonPath')
        self.server_path = garmin_config.get('mcpServerPath')
        
        if not self.python_path or not self.server_path:
            raise ValueError("Garmin MCP server paths not configured")
        
        self.server_params = StdioServerParameters(
            command=self.python_path,
            args=[self.server_path],
            env=None
        )
        
        logger.info(f"Initialized Garmin MCP client: {self.server_path}")
    
    @asynccontextmanager
    async def _get_session(self):
        """Get an MCP session context manager"""
        async with stdio_client(self.server_params) as (read, write):
            async with ClientSession(read, write) as session:
                # Initialize the session
                await session.initialize()
                logger.info("MCP session initialized")
                
                # List available tools for debugging
                tools_list = await session.list_tools()
                logger.info(f"Available MCP tools: {[tool.name for tool in tools_list.tools]}")
                
                yield session
    
    async def list_available_tools(self) -> List[Dict[str, Any]]:
        """
        List all available tools from the MCP server
        
        Returns:
            List of tool definitions with names and descriptions
        """
        try:
            async with self._get_session() as session:
                tools_list = await session.list_tools()
                
                # Convert to dict format
                tools = []
                for tool in tools_list.tools:
                    tools.append({
                        "name": tool.name,
                        "description": tool.description if hasattr(tool, 'description') else "",
                        "inputSchema": tool.inputSchema if hasattr(tool, 'inputSchema') else {}
                    })
                
                return tools
        except Exception as e:
            logger.error(f"Error listing tools: {str(e)}")
            return []
    
    async def get_activities(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        activity_type: str = "running",
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get activities from Garmin
        
        Args:
            start_date: Start date in ISO format (YYYY-MM-DD)
            end_date: End date in ISO format (YYYY-MM-DD)
            activity_type: Type of activity (default: running)
            limit: Maximum number of activities to return
            
        Returns:
            List of activity dicts
        """
        try:
            logger.info(f"Fetching {activity_type} activities (limit: {limit})")
            
            async with self._get_session() as session:
                # Build arguments
                arguments = {
                    "activityType": activity_type,
                    "limit": limit
                }
                
                if start_date:
                    arguments["startDate"] = start_date
                if end_date:
                    arguments["endDate"] = end_date
                
                # Call the MCP tool (list_activities returns text, not JSON)
                logger.info(f"Calling MCP tool: list_activities with args: {arguments}")
                result = await session.call_tool("list_activities", arguments=arguments)
                
                logger.info(f"MCP tool returned, processing result")
                logger.info(f"Result type: {type(result)}, content length: {len(result.content) if result.content else 0}")
                
                # Parse the result - list_activities returns formatted text
                if result.content and len(result.content) > 0:
                    import re
                    from mcp.types import TextContent
                    
                    first_content = result.content[0]
                    logger.info(f"First content type: {type(first_content)}")
                    
                    if isinstance(first_content, TextContent):
                        content_text = first_content.text
                    else:
                        content_text = str(first_content)
                    
                    logger.info(f"Content text (first 200 chars): {content_text[:200]}")
                    
                    # Parse the text format to extract activity IDs for the requested activity type
                    # Format: "Activity: Name\nType: running\nDate: ...\nID: 21639489343"
                    # Split by activity sections (--- Activity N ---)
                    activity_sections = re.split(r'---\s*Activity\s+\d+\s*---', content_text)
                    
                    activity_ids = []
                    for section in activity_sections:
                        if not section.strip():
                            continue
                        
                        # Check if this section has the correct activity type
                        type_match = re.search(r'Type:\s*(\w+)', section)
                        id_match = re.search(r'ID:\s*(\d+)', section)
                        
                        if type_match and id_match:
                            section_type = type_match.group(1)
                            section_id = id_match.group(1)
                            
                            # Only include if it matches the requested activity type
                            if section_type == activity_type:
                                activity_ids.append(section_id)
                                logger.info(f"Found {activity_type} activity: {section_id}")
                            else:
                                logger.info(f"Skipping {section_type} activity: {section_id}")
                    
                    if activity_ids:
                        logger.info(f"Found {len(activity_ids)} {activity_type} activity IDs: {activity_ids}")
                        # Return list of dicts with activity IDs
                        activities = [{"activityId": aid} for aid in activity_ids]
                        return activities
                    else:
                        logger.warning(f"No {activity_type} activity IDs found in response")
                
                logger.warning("No content in MCP result")
                return []
                
        except Exception as e:
            import traceback
            logger.error(f"Error fetching activities: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    async def get_activity_details(self, activity_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific activity
        
        Args:
            activity_id: Garmin activity ID
            
        Returns:
            Activity details dict
        """
        try:
            logger.info(f"Fetching activity details for: {activity_id}")
            
            async with self._get_session() as session:
                result = await session.call_tool(
                    "get_activity",
                    arguments={"activity_id": activity_id}  # Use snake_case, not camelCase
                )
                
                logger.info(f"Retrieved activity details")
                
                if result.content and len(result.content) > 0:
                    import json
                    from mcp.types import TextContent
                    
                    first_content = result.content[0]
                    if isinstance(first_content, TextContent):
                        content_text = first_content.text
                    else:
                        content_text = str(first_content)
                    
                    logger.info(f"Activity details content (first 500 chars): {content_text[:500]}")
                    
                    # Try to parse as JSON first
                    try:
                        data = json.loads(content_text)
                        # CRITICAL: Ensure we return a dict, not a string
                        if "activity" in data:
                            activity_value = data["activity"]
                            # If activity value is a string, parse it
                            if isinstance(activity_value, str):
                                try:
                                    return json.loads(activity_value)
                                except json.JSONDecodeError:
                                    logger.warning("activity value is a string but not valid JSON")
                                    return data  # Return the whole data dict instead
                            elif isinstance(activity_value, dict):
                                return activity_value
                            else:
                                logger.warning(f"activity value is unexpected type: {type(activity_value)}")
                                return data
                        else:
                            # No "activity" key, return data as-is
                            return data
                    except json.JSONDecodeError:
                        # If not JSON, it's formatted text - return as-is for now
                        logger.warning("Activity details returned as text, not JSON. Returning raw text.")
                        return {"raw_text": content_text, "activityId": activity_id}
                
                return {}
                
        except Exception as e:
            import traceback
            logger.error(f"Error fetching activity details: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    async def get_fitness_metrics(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get fitness metrics (VO2 max, training load, etc.)
        
        Args:
            start_date: Start date in ISO format
            end_date: End date in ISO format
            
        Returns:
            Fitness metrics dict
        """
        try:
            logger.info("Fetching fitness metrics")
            
            async with self._get_session() as session:
                arguments = {}
                if start_date:
                    arguments["start_date"] = start_date  # Use snake_case
                if end_date:
                    arguments["end_date"] = end_date  # Use snake_case
                
                logger.info(f"Calling get_stats with args: {arguments}")
                result = await session.call_tool("get_stats", arguments=arguments)
                
                logger.info(f"get_stats returned, processing result")
                
                if result.content and len(result.content) > 0:
                    import json
                    from mcp.types import TextContent
                    
                    first_content = result.content[0]
                    if isinstance(first_content, TextContent):
                        content_text = first_content.text
                    else:
                        content_text = str(first_content)
                    
                    logger.info(f"Fitness metrics content (first 500 chars): {content_text[:500]}")
                    
                    # Try to parse as JSON
                    try:
                        data = json.loads(content_text)
                        return data.get("metrics", data)  # Return data if no "metrics" key
                    except json.JSONDecodeError:
                        # If not JSON, return as text
                        logger.warning("Fitness metrics returned as text, not JSON")
                        return {"raw_text": content_text}
                
                logger.warning("No content in fitness metrics result")
                return {}
                
        except Exception as e:
            import traceback
            logger.error(f"Error fetching fitness metrics: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Return empty dict instead of raising to allow analysis to continue
            return {}


    async def get_activity_splits(self, activity_id: str) -> Dict[str, Any]:
        """
        Get lap/split data for an activity
        
        Args:
            activity_id: Garmin activity ID
            
        Returns:
            Splits data dict
        """
        try:
            logger.info(f"Fetching activity splits for: {activity_id}")
            
            async with self._get_session() as session:
                result = await session.call_tool(
                    "get_activity_splits",
                    arguments={"activity_id": activity_id}
                )
                
                if result.content and len(result.content) > 0:
                    import json
                    from mcp.types import TextContent
                    
                    first_content = result.content[0]
                    if isinstance(first_content, TextContent):
                        content_text = first_content.text
                    else:
                        content_text = str(first_content)
                    
                    logger.info(f"Splits data retrieved (first 300 chars): {content_text[:300]}")
                    
                    try:
                        data = json.loads(content_text)
                        # Return splits data as-is, let normalizer handle structure
                        logger.info(f"Splits data type: {type(data)}")
                        return data
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse splits data as JSON")
                        return {}
                
                return {}
                
        except Exception as e:
            logger.error(f"Error fetching activity splits: {str(e)}")
            return {}
    
    async def get_activity_hr_zones(self, activity_id: str) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Get heart rate zone data for an activity
        
        Args:
            activity_id: Garmin activity ID
            
        Returns:
            HR zones data (dict or list of dicts)
        """
        try:
            logger.info(f"Fetching HR zones for: {activity_id}")
            
            async with self._get_session() as session:
                result = await session.call_tool(
                    "get_activity_hr_in_timezones",
                    arguments={"activity_id": activity_id}
                )
                
                if result.content and len(result.content) > 0:
                    import json
                    from mcp.types import TextContent
                    
                    first_content = result.content[0]
                    if isinstance(first_content, TextContent):
                        content_text = first_content.text
                    else:
                        content_text = str(first_content)
                    
                    logger.info(f"HR zones data retrieved (first 300 chars): {content_text[:300]}")
                    
                    try:
                        data = json.loads(content_text)
                        
                        # Handle different response structures for HR zones
                        if isinstance(data, list):
                            # Already a list of zones
                            logger.info(f"HR zones returned as list with {len(data)} zones")
                            return data
                        elif isinstance(data, dict):
                            # Check if it's a single zone
                            if "zoneNumber" in data:
                                logger.info("HR zones returned as single dict, wrapping in list")
                                return [data]
                            # Check if zones are nested under a key
                            elif "zones" in data:
                                zones = data.get("zones", [])
                                if isinstance(zones, list):
                                    logger.info(f"HR zones found in 'zones' key with {len(zones)} zones")
                                    return zones
                            # Check for hrZones key
                            elif "hrZones" in data:
                                hr_zones = data.get("hrZones", [])
                                if isinstance(hr_zones, list):
                                    logger.info(f"HR zones found in 'hrZones' key with {len(hr_zones)} zones")
                                    return hr_zones
                            # Return dict as-is if no known structure
                            logger.info(f"HR zones dict with keys: {list(data.keys())[:10]}")
                            return data
                        
                        # Return data as-is for other types
                        logger.info(f"HR zones data type: {type(data)}")
                        return data if isinstance(data, (list, dict)) else []
                        
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse HR zones as JSON")
                        return []
                
                return []
                
        except Exception as e:
            logger.error(f"Error fetching HR zones: {str(e)}")
            return {}
    
    async def get_activity_weather(self, activity_id: str) -> Dict[str, Any]:
        """
        Get weather data for an activity
        
        Args:
            activity_id: Garmin activity ID
            
        Returns:
            Weather data dict
        """
        try:
            logger.info(f"Fetching weather for: {activity_id}")
            
            async with self._get_session() as session:
                result = await session.call_tool(
                    "get_activity_weather",
                    arguments={"activity_id": activity_id}
                )
                
                if result.content and len(result.content) > 0:
                    import json
                    from mcp.types import TextContent
                    
                    first_content = result.content[0]
                    if isinstance(first_content, TextContent):
                        content_text = first_content.text
                    else:
                        content_text = str(first_content)
                    
                    logger.info(f"Weather data retrieved (first 300 chars): {content_text[:300]}")
                    
                    try:
                        data = json.loads(content_text)
                        return data
                    except json.JSONDecodeError:
                        return {"raw_text": content_text}
                
                return {}
                
        except Exception as e:
            logger.error(f"Error fetching weather: {str(e)}")
            return {}


# Singleton instance
_garmin_client: Optional[GarminMCPClientAsync] = None


def get_garmin_client_async() -> GarminMCPClientAsync:
    """Get or create Garmin MCP client singleton"""
    global _garmin_client
    if _garmin_client is None:
        _garmin_client = GarminMCPClientAsync()
    return _garmin_client


# Synchronous wrapper functions for use in non-async code
def get_activities_sync(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    activity_type: str = "running",
    limit: int = 10
) -> List[Dict[str, Any]]:
    """Synchronous wrapper for get_activities"""
    client = get_garmin_client_async()
    return asyncio.run(client.get_activities(start_date, end_date, activity_type, limit))


def get_activity_details_sync(activity_id: str) -> Dict[str, Any]:
    """Synchronous wrapper for get_activity_details"""
    client = get_garmin_client_async()
    return asyncio.run(client.get_activity_details(activity_id))


def get_fitness_metrics_sync(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """Synchronous wrapper for get_fitness_metrics"""
    client = get_garmin_client_async()
    return asyncio.run(client.get_fitness_metrics(start_date, end_date))

# Made with Bob
