"""LLM providers module"""

from .watsonx_provider import WatsonxProvider
from .openai_provider import OpenAIProvider
from ..config import get_llm_config
import logging

logger = logging.getLogger(__name__)

__all__ = ['WatsonxProvider', 'OpenAIProvider', 'get_llm_provider']


def get_llm_provider():
    """
    Factory function to get the configured LLM provider.
    
    Returns:
        LLM provider instance (WatsonxProvider or OpenAIProvider)
    """
    llm_config = get_llm_config()
    provider_name = llm_config.get('provider', 'watsonx').lower()
    
    logger.info(f"Initializing LLM provider: {provider_name}")
    
    if provider_name == 'openai':
        return OpenAIProvider()
    elif provider_name == 'watsonx':
        return WatsonxProvider()
    else:
        logger.warning(f"Unknown provider '{provider_name}', defaulting to watsonx")
        return WatsonxProvider()


# Made with Bob
