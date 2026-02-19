"""
IBM watsonx.ai LLM Provider
Implements the LLM provider interface for watsonx.ai
"""

import requests
from typing import Dict, Any, Optional, List
from ..config import get_watsonx_config
import logging

logger = logging.getLogger(__name__)


class WatsonxProvider:
    """IBM watsonx.ai LLM provider"""
    
    def __init__(self):
        """Initialize watsonx provider with configuration"""
        self.config = get_watsonx_config()
        self.api_url = self.config.get('apiUrl', 'https://us-south.ml.cloud.ibm.com/ml/v1/text/chat')
        self.api_version = self.config.get('apiVersion', '2023-05-29')
        self.api_key = self.config.get('accessToken')  # This is actually the API key
        self.project_id = self.config.get('projectId')
        self.parameters = self.config.get('parameters', {})
        self.timeout = self.config.get('timeout', 30000) / 1000  # Convert to seconds
        self.iam_token = None
        self.token_expiry = 0
        
        if not self.api_key:
            raise ValueError("watsonx API key not configured")
        if not self.project_id:
            raise ValueError("watsonx project ID not configured")
    
    def _get_iam_token(self) -> str:
        """Get IAM token from IBM Cloud using API key"""
        import time
        
        # Check if we have a valid cached token
        if self.iam_token and time.time() < self.token_expiry:
            return self.iam_token
        
        # Request new token
        token_url = "https://iam.cloud.ibm.com/identity/token"
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        }
        data = {
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": self.api_key
        }
        
        try:
            logger.info("Requesting IAM token from IBM Cloud")
            response = requests.post(token_url, headers=headers, data=data, timeout=10)
            
            if response.status_code != 200:
                error_msg = f"Failed to get IAM token: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise Exception(error_msg)
            
            token_data = response.json()
            self.iam_token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 3600)
            self.token_expiry = time.time() + expires_in - 300  # Refresh 5 min before expiry
            
            logger.info("IAM token obtained successfully")
            return self.iam_token
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to get IAM token: {str(e)}")
    
    def generate(
        self,
        messages: List[Dict[str, str]],
        model_name: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate a response using watsonx.ai
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model_name: Model to use (default from config)
            temperature: Temperature parameter
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters
            
        Returns:
            Dict containing the response
        """
        # Get model name from config if not provided
        if not model_name:
            model_name = self.config.get('models', {}).get('currentRunAnalyzer', {}).get('name', 'openai/gpt-oss-120b')
        
        # Prepare request body
        body = {
            "messages": self._format_messages(messages),
            "project_id": self.project_id,
            "model_id": model_name,
            "temperature": temperature if temperature is not None else self.parameters.get('temperature', 0.7),
            "max_tokens": max_tokens if max_tokens is not None else self.parameters.get('maxTokens', 2000),
            "top_p": self.parameters.get('topP', 1.0),
            "frequency_penalty": self.parameters.get('frequencyPenalty', 0.0),
            "presence_penalty": self.parameters.get('presencePenalty', 0.0)
        }
        
        # Add any additional parameters
        body.update(kwargs)
        
        # Get IAM token
        iam_token = self._get_iam_token()
        
        # Prepare headers
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {iam_token}"
        }
        
        # Make request
        try:
            logger.info(f"Calling watsonx.ai with model {model_name}")
            response = requests.post(
                f"{self.api_url}?version={self.api_version}",
                headers=headers,
                json=body,
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                error_msg = f"watsonx API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise Exception(error_msg)
            
            data = response.json()
            logger.info("watsonx.ai response received successfully")
            
            return self._format_response(data)
            
        except requests.exceptions.Timeout:
            raise Exception("watsonx API request timed out")
        except requests.exceptions.RequestException as e:
            raise Exception(f"watsonx API request failed: {str(e)}")
    
    async def generate_async(
        self,
        messages: List[Dict[str, str]],
        model_name: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Async version of generate method.
        Currently just wraps the sync version since requests library is sync.
        For true async, would need to use aiohttp or httpx.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model_name: Model to use (default from config)
            temperature: Temperature parameter
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters
            
        Returns:
            Dict containing the response
        """
        # For now, just call the sync version
        # TODO: Implement true async with aiohttp/httpx
        return self.generate(messages, model_name, temperature, max_tokens, **kwargs)
    
    def _format_messages(self, messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """
        Format messages for watsonx API
        
        Args:
            messages: List of message dicts
            
        Returns:
            Formatted messages for watsonx
        """
        formatted = []
        for msg in messages:
            formatted.append({
                "role": msg.get("role", "user"),
                "content": [{"type": "text", "text": msg.get("content", "")}]
            })
        return formatted
    
    def _format_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format watsonx response to standard format
        
        Args:
            data: Raw response from watsonx
            
        Returns:
            Formatted response dict
        """
        # Extract the response content
        choices = data.get('choices', [])
        if not choices:
            return {
                "content": "",
                "model": data.get('model', ''),
                "usage": data.get('usage', {})
            }
        
        first_choice = choices[0]
        message = first_choice.get('message', {})
        
        # watsonx.ai returns content in 'reasoning_content' field, not 'content'
        content = message.get('reasoning_content', '') or message.get('content', '')
        
        return {
            "content": content,
            "model": data.get('model', ''),
            "usage": data.get('usage', {}),
            "finish_reason": first_choice.get('finish_reason', ''),
            "raw_response": data
        }
    
    def chat(self, user_message: str, system_prompt: Optional[str] = None) -> str:
        """
        Simple chat interface
        
        Args:
            user_message: User's message
            system_prompt: Optional system prompt
            
        Returns:
            Assistant's response as string
        """
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": user_message})
        
        response = self.generate(messages)
        return response.get("content", "")

# Made with Bob
