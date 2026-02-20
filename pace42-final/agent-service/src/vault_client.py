"""Vault client for retrieving secrets"""
import os
import hvac
from pathlib import Path
from typing import Optional

def get_vault_client():
    """Get configured Vault client"""
    try:
        # Read from .env file
        config_dir = Path(__file__).parent.parent.parent / "config"
        env_path = config_dir / ".env"
        
        env_vars = {}
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    if '=' in line and not line.startswith('#'):
                        key, value = line.strip().split('=', 1)
                        env_vars[key] = value
        
        vault_addr = env_vars.get('VAULT_ADDR', 'http://127.0.0.1:8200')
        vault_token = env_vars.get('VAULT_TOKEN', '')
        
        if not vault_token:
            return None
        
        client = hvac.Client(url=vault_addr, token=vault_token)
        
        if not client.is_authenticated():
            return None
        
        return client
    except Exception as e:
        print(f"Warning: Could not create Vault client: {e}")
        return None


def get_openai_key():
    """Get OpenAI API key from Vault"""
    try:
        client = get_vault_client()
        if not client:
            return os.getenv('OPENAI_API_KEY', '')
        
        secret = client.secrets.kv.v2.read_secret_version(path="api-keys", mount_point="pace42")
        return secret['data']['data'].get('openai_key', '')
    except Exception as e:
        print(f"Warning: Could not fetch key from Vault: {e}")
        return os.getenv('OPENAI_API_KEY', '')


def get_garmin_tokens(user_id: str) -> Optional[str]:
    """
    Get Garmin OAuth tokens for a user from Vault.
    
    Args:
        user_id: The user ID
        
    Returns:
        Base64 encoded tokens string, or None if not found
    """
    try:
        client = get_vault_client()
        if not client:
            print(f"Warning: Vault not available, cannot get Garmin tokens for user {user_id}")
            return None
        
        secret = client.secrets.kv.v2.read_secret_version(
            path=f"garmin-tokens/{user_id}",
            mount_point="pace42"
        )
        
        tokens_b64 = secret['data']['data'].get('tokens_b64')
        if tokens_b64:
            print(f"Retrieved Garmin tokens from Vault for user {user_id}")
            return tokens_b64
        else:
            print(f"No Garmin tokens found in Vault for user {user_id}")
            return None
            
    except Exception as e:
        print(f"Warning: Could not fetch Garmin tokens from Vault for user {user_id}: {e}")
        return None
