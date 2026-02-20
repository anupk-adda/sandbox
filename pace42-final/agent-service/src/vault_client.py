"""Vault client for retrieving secrets"""
import os
import hvac
from pathlib import Path

def get_openai_key():
    """Get OpenAI API key from Vault"""
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
            return os.getenv('OPENAI_API_KEY', '')
        
        client = hvac.Client(url=vault_addr, token=vault_token)
        
        if not client.is_authenticated():
            return os.getenv('OPENAI_API_KEY', '')
        
        secret = client.secrets.kv.v2.read_secret_version(path="api-keys", mount_point="pace42")
        return secret['data']['data'].get('openai_key', '')
    except Exception as e:
        print(f"Warning: Could not fetch key from Vault: {e}")
        return os.getenv('OPENAI_API_KEY', '')
