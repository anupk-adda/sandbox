"""
Garmin MCP Client V2 - Multi-User with Vault-Backed Credentials
Handles user-scoped communication with the Garmin MCP server
"""

import os
import json
import asyncio
import logging
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from contextlib import asynccontextmanager
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from ..config import get_garmin_config
from ..vault_client import get_garmin_credentials

logger = logging.getLogger(__name__)


class UserScopedGarminClient:
    """User-scoped client for interacting with Garmin MCP server"""
    
    def __init__(self, user_id: str):
        """
        Initialize user-scoped Garmin MCP client
        
        Args:
            user_id: The user ID for token retrieval
        """
        self.user_id = user_id
        garmin_config = get_garmin_config()
        
        self.python_path = garmin_config.get('mcpPythonPath')
        self.mcp_server_path = garmin_config.get('mcpServerPath')
        
        if not self.python_path or not self.mcp_server_path:
            raise ValueError("Garmin MCP server paths not configured")
        
        logger.info(f"Initialized user-scoped Garmin client for user: {user_id}")
    
    def _setup_environment(self) -> Dict[str, str]:
        """
        Set up environment with credentials from Vault for this user.
        
        The MCP server reads GARMIN_EMAIL and GARMIN_PASSWORD to authenticate.
        
        Returns:
            Environment dictionary with credentials injected
        """
        env = os.environ.copy()
        
        # Get credentials from Vault for this user
        creds = get_garmin_credentials(self.user_id)
        
        if creds:
            env['GARMIN_EMAIL'] = creds["username"]
            env['GARMIN_PASSWORD'] = creds["password"]
            logger.info(f"Injected Vault credentials for user {self.user_id}")
        else:
            logger.warning(f"No credentials available for user {self.user_id}")

        # Ensure token store is isolated per user
        token_dir, base64_path = _get_user_token_paths(self.user_id)
        try:
            token_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning(f"Failed to create Garmin token directory {token_dir}: {e}")

        env['GARMINTOKENS'] = str(token_dir)
        env['GARMINTOKENS_BASE64'] = str(base64_path)
        
        return env
    
    @asynccontextmanager
    async def _get_session(self):
        """Get an MCP session with user-specific tokens"""
        
        env = self._setup_environment()
        
        # Create server parameters with user-specific environment
        server_params = StdioServerParameters(
            command=self.python_path,
            args=[self.mcp_server_path],
            env=env
        )
        
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                logger.info(f"MCP session initialized for user {self.user_id}")
                yield session
    
    async def get_activities(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        activity_type: str = "running",
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get activities from Garmin for this user"""
        try:
            logger.info(f"Fetching {activity_type} activities for user {self.user_id}")
            
            async with self._get_session() as session:
                arguments = {"activityType": activity_type, "limit": limit}
                if start_date:
                    arguments["startDate"] = start_date
                if end_date:
                    arguments["endDate"] = end_date
                
                result = await session.call_tool("list_activities", arguments=arguments)
                
                # Parse result
                if result.content and len(result.content) > 0:
                    import re
                    from mcp.types import TextContent
                    
                    first_content = result.content[0]
                    content_text = first_content.text if isinstance(first_content, TextContent) else str(first_content)
                    
                    # Parse text format
                    activity_sections = re.split(r'---\s*Activity\s+\d+\s*---', content_text)
                    activity_ids = []
                    
                    for section in activity_sections:
                        if not section.strip():
                            continue
                        type_match = re.search(r'Type:\s*(\w+)', section)
                        id_match = re.search(r'ID:\s*(\d+)', section)
                        
                        if type_match and id_match:
                            if type_match.group(1) == activity_type:
                                activity_ids.append(id_match.group(1))
                    
                    return [{"activityId": aid} for aid in activity_ids]
                
                return []
                
        except Exception as e:
            logger.error(f"Error fetching activities for user {self.user_id}: {e}")
            raise
    
    async def get_activity_details(self, activity_id: str) -> Dict[str, Any]:
        """Get activity details"""
        try:
            async with self._get_session() as session:
                result = await session.call_tool(
                    "get_activity",
                    arguments={"activity_id": activity_id}
                )
                
                if result.content and len(result.content) > 0:
                    import json
                    from mcp.types import TextContent
                    
                    first_content = result.content[0]
                    content_text = first_content.text if isinstance(first_content, TextContent) else str(first_content)
                    
                    try:
                        data = json.loads(content_text)
                        if "activity" in data:
                            activity = data["activity"]
                            return json.loads(activity) if isinstance(activity, str) else activity
                        return data
                    except json.JSONDecodeError:
                        return {"raw_text": content_text}
                
                return {}
                
        except Exception as e:
            logger.error(f"Error fetching activity details: {e}")
            raise
    
    async def get_fitness_metrics(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get fitness metrics"""
        try:
            async with self._get_session() as session:
                arguments = {}
                if start_date:
                    arguments["start_date"] = start_date
                if end_date:
                    arguments["end_date"] = end_date
                
                result = await session.call_tool("get_stats", arguments=arguments)
                
                if result.content and len(result.content) > 0:
                    import json
                    from mcp.types import TextContent
                    
                    first_content = result.content[0]
                    content_text = first_content.text if isinstance(first_content, TextContent) else str(first_content)
                    
                    try:
                        data = json.loads(content_text)
                        return data.get("metrics", data)
                    except json.JSONDecodeError:
                        return {}
                
                return {}
                
        except Exception as e:
            logger.error(f"Error fetching fitness metrics: {e}")
            return {}
    
    async def get_activity_splits(self, activity_id: str) -> Dict[str, Any]:
        """Get activity splits"""
        try:
            async with self._get_session() as session:
                result = await session.call_tool(
                    "get_activity_splits",
                    arguments={"activity_id": activity_id}
                )
                
                if result.content and len(result.content) > 0:
                    import json
                    from mcp.types import TextContent
                    
                    first_content = result.content[0]
                    content_text = first_content.text if isinstance(first_content, TextContent) else str(first_content)
                    
                    try:
                        return json.loads(content_text)
                    except json.JSONDecodeError:
                        return {}
                
                return {}
                
        except Exception as e:
            logger.error(f"Error fetching splits: {e}")
            return {}
    
    async def get_activity_hr_zones(self, activity_id: str) -> Union[Dict, List]:
        """Get HR zones"""
        try:
            async with self._get_session() as session:
                result = await session.call_tool(
                    "get_activity_hr_in_timezones",
                    arguments={"activity_id": activity_id}
                )
                
                if result.content and len(result.content) > 0:
                    import json
                    from mcp.types import TextContent
                    
                    first_content = result.content[0]
                    content_text = first_content.text if isinstance(first_content, TextContent) else str(first_content)
                    
                    try:
                        data = json.loads(content_text)
                        if isinstance(data, list):
                            return data
                        elif isinstance(data, dict):
                            if "zones" in data:
                                return data.get("zones", [])
                            elif "hrZones" in data:
                                return data.get("hrZones", [])
                        return data
                    except json.JSONDecodeError:
                        return []
                
                return []
                
        except Exception as e:
            logger.error(f"Error fetching HR zones: {e}")
            return []

    async def get_activity_weather(self, activity_id: str) -> Dict[str, Any]:
        """Get weather data for an activity"""
        try:
            async with self._get_session() as session:
                result = await session.call_tool(
                    "get_activity_weather",
                    arguments={"activity_id": activity_id}
                )

                if result.content and len(result.content) > 0:
                    import json
                    from mcp.types import TextContent

                    first_content = result.content[0]
                    content_text = first_content.text if isinstance(first_content, TextContent) else str(first_content)

                    try:
                        data = json.loads(content_text)
                        return data if isinstance(data, dict) else {}
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse weather data for activity {activity_id}")
                        return {}

                return {}

        except Exception as e:
            logger.error(f"Error fetching weather data: {e}")
            return {}


# Client cache per user
_user_clients: Dict[str, UserScopedGarminClient] = {}

def _sanitize_user_id(user_id: str) -> str:
    """Ensure user_id is safe for filesystem paths."""
    if not user_id:
        return "unknown"
    return "".join(ch for ch in user_id if ch.isalnum() or ch in ("-", "_")) or "unknown"


def _get_user_token_paths(user_id: str) -> tuple[Path, Path]:
    """Return (token_dir, base64_path) for a given user."""
    safe_user_id = _sanitize_user_id(user_id)
    base_dir = Path(tempfile.gettempdir()) / "pace42-garmin" / safe_user_id
    token_dir = base_dir / "tokens"
    base64_path = base_dir / ".garminconnect_base64"
    return token_dir, base64_path


def get_client_for_user(user_id: str) -> UserScopedGarminClient:
    """Get or create a user-scoped client"""
    if user_id not in _user_clients:
        _user_clients[user_id] = UserScopedGarminClient(user_id)
    return _user_clients[user_id]


def clear_client_for_user(user_id: str):
    """Clear client for a user"""
    if user_id in _user_clients:
        del _user_clients[user_id]
        logger.info(f"Cleared Garmin client for user {user_id}")


def clear_token_store_for_user(user_id: str):
    """Clear token files for a user (on disconnect or credential change)."""
    token_dir, base64_path = _get_user_token_paths(user_id)
    try:
        if base64_path.exists():
            base64_path.unlink()
            logger.info(f"Cleared Garmin base64 token for user {user_id}")
        if token_dir.exists():
            for file in token_dir.glob("*"):
                try:
                    file.unlink()
                except Exception:
                    pass
            try:
                token_dir.rmdir()
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"Failed to clear Garmin token store for user {user_id}: {e}")
