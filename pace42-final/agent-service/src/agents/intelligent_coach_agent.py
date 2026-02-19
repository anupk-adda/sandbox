"""
Intelligent Coach Agent - Claude-style tool selection
Uses LLM to semantically understand user requests and dynamically select appropriate MCP tools
"""

import logging
import json
from typing import Dict, Any, List, Optional
from ..llm import WatsonxProvider
from ..mcp.garmin_client_async import get_garmin_client_async

logger = logging.getLogger(__name__)


class IntelligentCoachAgent:
    """
    Agent that uses LLM to intelligently select and call MCP tools
    Mimics Claude Desktop's semantic tool selection behavior
    """
    
    def __init__(self, llm_provider: Optional[WatsonxProvider] = None):
        """Initialize Intelligent Coach Agent"""
        self.llm = llm_provider or WatsonxProvider()
        self.agent_name = "IntelligentCoachAgent"
        self.garmin_client = None
        self.available_tools = []
        logger.info(f"Initialized {self.agent_name}")
    
    async def _initialize_tools(self):
        """Initialize and get available MCP tools"""
        if not self.garmin_client:
            self.garmin_client = get_garmin_client_async()
        
        # Get available tools from MCP server
        self.available_tools = await self.garmin_client.list_available_tools()
        logger.info(f"Loaded {len(self.available_tools)} MCP tools")
    
    def _convert_mcp_tools_to_function_schema(self) -> List[Dict[str, Any]]:
        """
        Convert MCP tool definitions to OpenAI function calling schema
        This allows watsonx.ai to understand what tools are available
        """
        function_schemas = []
        
        # Define key Garmin tools with their schemas
        tool_definitions = {
            "list_activities": {
                "name": "list_activities",
                "description": "List recent activities from Garmin. Use this to find activity IDs for detailed analysis.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "activityType": {
                            "type": "string",
                            "description": "Type of activity (e.g., 'running', 'cycling')",
                            "enum": ["running", "cycling", "swimming", "all"]
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Number of activities to retrieve (default: 10)",
                            "default": 10
                        }
                    },
                    "required": ["activityType"]
                }
            },
            "get_activity": {
                "name": "get_activity",
                "description": "Get detailed information about a specific activity including distance, duration, pace, heart rate, and more.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "activity_id": {
                            "type": "string",
                            "description": "The activity ID to retrieve details for"
                        }
                    },
                    "required": ["activity_id"]
                }
            },
            "get_activity_splits": {
                "name": "get_activity_splits",
                "description": "Get lap-by-lap split data for an activity. Essential for analyzing pacing strategy and performance across the run.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "activity_id": {
                            "type": "string",
                            "description": "The activity ID to get splits for"
                        }
                    },
                    "required": ["activity_id"]
                }
            },
            "get_activity_hr_in_timezones": {
                "name": "get_activity_hr_in_timezones",
                "description": "Get heart rate zone distribution for an activity. Shows time spent in each HR zone.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "activity_id": {
                            "type": "string",
                            "description": "The activity ID to get HR zones for"
                        }
                    },
                    "required": ["activity_id"]
                }
            },
            "get_activity_weather": {
                "name": "get_activity_weather",
                "description": "Get weather conditions during an activity (temperature, humidity, wind).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "activity_id": {
                            "type": "string",
                            "description": "The activity ID to get weather for"
                        }
                    },
                    "required": ["activity_id"]
                }
            }
        }
        
        # Convert to function schema format
        for tool_name, tool_def in tool_definitions.items():
            if tool_name in [t.get('name', '') for t in self.available_tools]:
                function_schemas.append({
                    "type": "function",
                    "function": tool_def
                })
        
        return function_schemas
    
    async def _execute_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Execute a tool call via MCP"""
        logger.info(f"Executing tool: {tool_name} with args: {arguments}")
        
        try:
            if tool_name == "list_activities":
                return await self.garmin_client.get_activities(
                    activity_type=arguments.get("activityType", "running"),
                    limit=arguments.get("limit", 10)
                )
            elif tool_name == "get_activity":
                return await self.garmin_client.get_activity_details(
                    arguments.get("activity_id")
                )
            elif tool_name == "get_activity_splits":
                return await self.garmin_client.get_activity_splits(
                    arguments.get("activity_id")
                )
            elif tool_name == "get_activity_hr_in_timezones":
                return await self.garmin_client.get_activity_hr_zones(
                    arguments.get("activity_id")
                )
            elif tool_name == "get_activity_weather":
                return await self.garmin_client.get_activity_weather(
                    arguments.get("activity_id")
                )
            else:
                logger.warning(f"Unknown tool: {tool_name}")
                return {"error": f"Unknown tool: {tool_name}"}
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {str(e)}")
            return {"error": str(e)}
    
    def _create_tool_selection_prompt(self, user_request: str, available_tools: List[Dict]) -> str:
        """
        Create a prompt that asks the LLM to select appropriate tools
        This mimics Claude's semantic understanding
        """
        tools_description = "\n".join([
            f"- {tool['function']['name']}: {tool['function']['description']}"
            for tool in available_tools
        ])
        
        prompt = f"""You are an intelligent running coach assistant. A user has made the following request:

"{user_request}"

Available Garmin data tools:
{tools_description}

Your task: Determine which tools to call and in what sequence to fulfill the user's request.

Rules:
1. To analyze a run, you typically need: list_activities → get_activity → get_activity_splits → get_activity_hr_in_timezones → get_activity_weather
2. Always get the activity ID first using list_activities
3. Then get detailed data using the activity ID
4. Consider what data is needed for the specific request
5. Don't call unnecessary tools

Respond with a JSON array of tool calls in sequence:
[
  {{"tool": "list_activities", "args": {{"activityType": "running", "limit": 1}}}},
  {{"tool": "get_activity", "args": {{"activity_id": "FROM_PREVIOUS_RESULT"}}}},
  ...
]

If activity_id is "FROM_PREVIOUS_RESULT", it will be extracted from the previous tool's output.

JSON response:"""
        
        return prompt
    
    async def process_request(self, user_request: str) -> Dict[str, Any]:
        """
        Process user request using intelligent tool selection
        
        Args:
            user_request: Natural language request from user
            
        Returns:
            Analysis results with tool execution history
        """
        try:
            # Initialize tools
            await self._initialize_tools()
            
            # Get function schemas
            function_schemas = self._convert_mcp_tools_to_function_schema()
            
            # Ask LLM to select tools
            logger.info("Asking LLM to select appropriate tools")
            tool_selection_prompt = self._create_tool_selection_prompt(
                user_request, 
                function_schemas
            )
            
            # Get tool selection from LLM
            messages = [
                {"role": "system", "content": "You are a tool selection expert for running data analysis."},
                {"role": "user", "content": tool_selection_prompt}
            ]
            
            response = self.llm.generate(
                messages=messages,
                temperature=0.1,  # Low temperature for consistent tool selection
                max_tokens=1000
            )
            
            # Parse tool calls from LLM response
            tool_calls_text = response.get("content", "")
            logger.info(f"LLM tool selection: {tool_calls_text[:200]}...")
            
            # Extract JSON from response
            try:
                # Find JSON array in response
                start_idx = tool_calls_text.find("[")
                end_idx = tool_calls_text.rfind("]") + 1
                if start_idx >= 0 and end_idx > start_idx:
                    json_str = tool_calls_text[start_idx:end_idx]
                    tool_calls = json.loads(json_str)
                else:
                    raise ValueError("No JSON array found in response")
            except Exception as e:
                logger.error(f"Failed to parse tool calls: {e}")
                # Fallback to default sequence
                tool_calls = [
                    {"tool": "list_activities", "args": {"activityType": "running", "limit": 1}},
                    {"tool": "get_activity", "args": {"activity_id": "FROM_PREVIOUS_RESULT"}},
                    {"tool": "get_activity_splits", "args": {"activity_id": "FROM_PREVIOUS_RESULT"}},
                    {"tool": "get_activity_hr_in_timezones", "args": {"activity_id": "FROM_PREVIOUS_RESULT"}},
                    {"tool": "get_activity_weather", "args": {"activity_id": "FROM_PREVIOUS_RESULT"}}
                ]
            
            # Execute tool calls in sequence
            tool_results = []
            activity_id = None
            
            for tool_call in tool_calls:
                tool_name = tool_call.get("tool")
                args = tool_call.get("args", {})
                
                # Replace FROM_PREVIOUS_RESULT with actual activity_id
                if args.get("activity_id") == "FROM_PREVIOUS_RESULT":
                    if not activity_id:
                        logger.error("No activity_id available from previous result")
                        continue
                    args["activity_id"] = activity_id
                
                # Execute tool
                result = await self._execute_tool_call(tool_name, args)
                tool_results.append({
                    "tool": tool_name,
                    "args": args,
                    "result": result
                })
                
                # Extract activity_id if this was list_activities
                if tool_name == "list_activities" and result:
                    if isinstance(result, list) and len(result) > 0:
                        activity_id = result[0]
                        logger.info(f"Extracted activity_id: {activity_id}")
            
            # Now analyze with all collected data
            logger.info("Generating final analysis with collected data")
            
            # Combine all tool results into context
            context = self._build_analysis_context(tool_results)
            
            # Generate final analysis
            analysis_messages = [
                {
                    "role": "system",
                    "content": """You are an expert running coach. Analyze the provided running data and give comprehensive coaching feedback.
                    
Include:
1. Run summary with key metrics
2. Pacing analysis (lap-by-lap)
3. Heart rate analysis and effort assessment
4. Execution quality rating (1-10)
5. Key observations and insights
6. Specific recommendations for improvement"""
                },
                {
                    "role": "user",
                    "content": f"Analyze this running data:\n\n{context}"
                }
            ]
            
            final_response = self.llm.generate(
                messages=analysis_messages,
                temperature=0.3,
                max_tokens=2000
            )
            
            return {
                "analysis": final_response.get("content", ""),
                "tool_calls": tool_calls,
                "tool_results": tool_results,
                "agent": self.agent_name
            }
            
        except Exception as e:
            logger.error(f"Error in intelligent processing: {str(e)}")
            raise
    
    def _build_analysis_context(self, tool_results: List[Dict]) -> str:
        """Build analysis context from tool results"""
        context_parts = []
        
        for result in tool_results:
            tool_name = result["tool"]
            data = result["result"]
            
            if tool_name == "get_activity":
                context_parts.append(f"## Activity Details\n{json.dumps(data, indent=2)}")
            elif tool_name == "get_activity_splits":
                context_parts.append(f"## Lap Splits\n{json.dumps(data, indent=2)}")
            elif tool_name == "get_activity_hr_in_timezones":
                context_parts.append(f"## Heart Rate Zones\n{json.dumps(data, indent=2)}")
            elif tool_name == "get_activity_weather":
                context_parts.append(f"## Weather Conditions\n{json.dumps(data, indent=2)}")
        
        return "\n\n".join(context_parts)

# Made with Bob
