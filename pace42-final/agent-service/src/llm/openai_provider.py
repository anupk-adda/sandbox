"""
OpenAI LLM Provider
Implements the LLM provider interface for OpenAI API
"""

from openai import AsyncOpenAI
from typing import Dict, Any, Optional, List
from ..config import get_llm_config
import logging
import os

logger = logging.getLogger(__name__)


class OpenAIProvider:
    """OpenAI LLM provider"""
    
    def __init__(self):
        """Initialize OpenAI provider with configuration"""
        self.config = get_llm_config()
        openai_config = self.config.get('openai', {})
        
        self.api_key = openai_config.get('apiKey') or os.getenv('OPENAI_API_KEY')
        self.model = openai_config.get('model', 'gpt-4o-mini')
        self.temperature = openai_config.get('temperature', 0.3)
        self.max_tokens = openai_config.get('maxTokens', 2500)
        
        if not self.api_key:
            raise ValueError("OpenAI API key not configured")
        
        # Initialize async client
        self.client = AsyncOpenAI(api_key=self.api_key)
        
        logger.info(f"Initialized OpenAI provider with model: {self.model}")
    
    async def generate_async(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate text using OpenAI API (async)
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters
            
        Returns:
            Dict with 'content' and metadata
        """
        try:
            temp = temperature if temperature is not None else self.temperature
            max_tok = max_tokens if max_tokens is not None else self.max_tokens
            
            logger.info(f"Calling OpenAI API with model {self.model}")
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temp,
                max_tokens=max_tok,
                **kwargs
            )
            
            logger.info("OpenAI API response received successfully")
            
            # Extract content
            content = response.choices[0].message.content
            
            return {
                "content": content,
                "model": response.model,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                "finish_reason": response.choices[0].finish_reason
            }
            
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {str(e)}")
            raise
    
    def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate text using OpenAI API (sync wrapper)
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters
            
        Returns:
            Dict with 'content' and metadata
        """
        import asyncio
        return asyncio.run(self.generate_async(messages, temperature, max_tokens, **kwargs))


# Made with Bob