"""
Garmin MCP Client
Handles communication with the Garmin MCP server
"""

import subprocess
import json
import logging
from typing import Dict, Any, List, Optional
from ..config import get_garmin_config

logger = logging.getLogger(__name__)


class GarminMCPClient:
    """Client for interacting with Garmin MCP server"""
    
    def __init__(self):
        """Initialize Garmin MCP client with configuration"""
        garmin_config = get_garmin_config()
        
        self.python_path = garmin_config.get('mcpPythonPath')
        self.server_path = garmin_config.get('mcpServerPath')
        
        if not self.python_path or not self.server_path:
            raise ValueError("Garmin MCP server paths not configured")
        
        logger.info(f"Initialized Garmin MCP client: {self.server_path}")
    
    def _call_mcp_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a tool on the Garmin MCP server
        
        Args:
            tool_name: Name of the MCP tool to call
            arguments: Arguments to pass to the tool
            
        Returns:
            Tool response as dict
        """
        try:
            # Prepare the MCP request
            request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                }
            }
            
            # Call the MCP server
            logger.info(f"Calling MCP tool: {tool_name}")
            result = subprocess.run(
                [self.python_path, self.server_path],
                input=json.dumps(request),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                error_msg = f"MCP server error: {result.stderr}"
                logger.error(error_msg)
                raise Exception(error_msg)
            
            # Parse response
            response = json.loads(result.stdout)
            
            if "error" in response:
                raise Exception(f"MCP tool error: {response['error']}")
            
            logger.info(f"MCP tool {tool_name} completed successfully")
            return response.get("result", {})
            
        except subprocess.TimeoutExpired:
            raise Exception("MCP server request timed out")
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse MCP response: {str(e)}")
        except Exception as e:
            logger.error(f"MCP client error: {str(e)}")
            raise
    
    def get_activities(
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
        arguments = {
            "activityType": activity_type,
            "limit": limit
        }
        
        if start_date:
            arguments["startDate"] = start_date
        if end_date:
            arguments["endDate"] = end_date
        
        result = self._call_mcp_tool("get_activities", arguments)
        return result.get("activities", [])
    
    def get_activity_details(self, activity_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific activity
        
        Args:
            activity_id: Garmin activity ID
            
        Returns:
            Activity details dict
        """
        result = self._call_mcp_tool("get_activity_details", {"activityId": activity_id})
        return result.get("activity", {})
    
    def get_fitness_metrics(
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
        arguments = {}
        if start_date:
            arguments["startDate"] = start_date
        if end_date:
            arguments["endDate"] = end_date
        
        result = self._call_mcp_tool("get_fitness_metrics", arguments)
        return result.get("metrics", {})
    
    def get_heart_rate_zones(self) -> Dict[str, Any]:
        """
        Get user's heart rate zones
        
        Returns:
            Heart rate zones dict
        """
        result = self._call_mcp_tool("get_heart_rate_zones", {})
        return result.get("zones", {})
    
    def get_user_profile(self) -> Dict[str, Any]:
        """
        Get user profile information
        
        Returns:
            User profile dict
        """
        result = self._call_mcp_tool("get_user_profile", {})
        return result.get("profile", {})


# Singleton instance
_garmin_client: Optional[GarminMCPClient] = None


def get_garmin_client() -> GarminMCPClient:
    """Get or create Garmin MCP client singleton"""
    global _garmin_client
    if _garmin_client is None:
        _garmin_client = GarminMCPClient()
    return _garmin_client

# Made with Bob
