"""
Configuration loader for agent service
Loads configuration from JSON files and environment variables
"""

import json
import os
from pathlib import Path
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables from config/.env
config_dir = Path(__file__).parent.parent.parent / "config"
env_path = config_dir / ".env"
load_dotenv(env_path)

def load_config() -> Dict[str, Any]:
    """
    Load configuration from config files
    
    Returns:
        Dict containing all configuration
    """
    config = {}
    
    # Load LLM configuration
    llm_config_path = config_dir / "llm.config.json"
    if llm_config_path.exists():
        with open(llm_config_path, 'r') as f:
            llm_config = json.load(f)
            # Replace environment variables
            llm_config = _replace_env_vars(llm_config)
            config['llm'] = llm_config
    
    # Load app configuration
    app_config_path = config_dir / "app.config.json"
    if app_config_path.exists():
        with open(app_config_path, 'r') as f:
            app_config = json.load(f)
            # Replace environment variables
            app_config = _replace_env_vars(app_config)
            config['app'] = app_config
    
    return config

def _replace_env_vars(obj: Any) -> Any:
    """
    Recursively replace ${VAR_NAME} with environment variable values
    
    Args:
        obj: Object to process (dict, list, str, etc.)
        
    Returns:
        Object with environment variables replaced
    """
    if isinstance(obj, str):
        # Check if string contains ${VAR_NAME}
        if obj.startswith('${') and obj.endswith('}'):
            var_name = obj[2:-1]
            return os.getenv(var_name, obj)
        return obj
    elif isinstance(obj, dict):
        return {key: _replace_env_vars(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [_replace_env_vars(item) for item in obj]
    else:
        return obj

def get_llm_config() -> Dict[str, Any]:
    """
    Get LLM configuration including provider selection
    
    Returns:
        Dict containing LLM configuration with provider and settings
    """
    config = load_config()
    app_config = config.get('app', {})
    llm_config = app_config.get('llm', {})
    
    # Get provider from environment or config
    provider = os.getenv('LLM_PROVIDER', llm_config.get('provider', 'watsonx'))
    
    return {
        'provider': provider,
        'watsonx': llm_config.get('watsonx', {}),
        'openai': llm_config.get('openai', {})
    }

def get_watsonx_config() -> Dict[str, Any]:
    """Get watsonx.ai specific configuration"""
    llm_config = get_llm_config()
    return llm_config.get('watsonx', {})

def get_openai_config() -> Dict[str, Any]:
    """Get OpenAI specific configuration"""
    llm_config = get_llm_config()
    return llm_config.get('openai', {})

def get_model_config(agent_name: str) -> Dict[str, Any]:
    """
    Get model configuration for a specific agent
    
    Args:
        agent_name: Name of the agent (e.g., 'currentRunAnalyzer')
        
    Returns:
        Model configuration dict
    """
    config = load_config()
    watsonx_config = config.get('llm', {}).get('watsonx', {})
    models = watsonx_config.get('models', {})
    return models.get(agent_name, {})

def get_garmin_config() -> Dict[str, Any]:
    """Get Garmin MCP configuration"""
    config = load_config()
    app_config = config.get('app', {})
    mcp_config = app_config.get('mcp', {})
    garmin_config = mcp_config.get('garmin', {})
    
    # Map the config structure to what the client expects
    result = {
        'mcpPythonPath': garmin_config.get('command'),
        'mcpServerPath': garmin_config.get('args', [])[0] if garmin_config.get('args') else None
    }
    
    return result

# Made with Bob
