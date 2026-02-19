"""
Intent Router - Routes user queries to appropriate agents
"""
import logging
import re
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class IntentRouter:
    """
    Routes user queries to the appropriate agent based on intent detection.
    """
    
    def __init__(self):
        self.intent_patterns = {
            'analyze_latest_run': [
                r'analy[sz]e.*latest.*run',
                r'analy[sz]e.*recent.*run',
                r'analy[sz]e.*last.*run',
                r'how.*did.*i.*do',
                r'how.*was.*my.*run',
                r'my.*latest.*run',
                r'my.*last.*run',
            ],
            'compare_recent_runs': [
                r'compare.*runs',
                r'recent.*trends',
                r'how.*am.*i.*progressing',
                r'compare.*recent',
                r'consistency',
            ],
            'analyze_fitness_trends': [
                r'fitness.*trends',
                r'long.*term',
                r'vo2.*max',
                r'fitness.*progress',
                r'3.*month',
                r'race.*readiness',
            ],
            'comprehensive_coaching': [
                r'comprehensive.*analysis',
                r'full.*analysis',
                r'complete.*analysis',
                r'overall.*assessment',
            ],
        }
        logger.info("Initialized IntentRouter")
    
    def detect_intent(self, user_message: str) -> Optional[str]:
        """
        Detect the user's intent from their message.
        
        Args:
            user_message: The user's input message
            
        Returns:
            Intent name or None if no clear intent detected
        """
        message_lower = user_message.lower()
        
        # Check each intent pattern
        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower):
                    logger.info(f"Detected intent: {intent} from pattern: {pattern}")
                    return intent
        
        logger.info("No specific intent detected, will use general Q&A")
        return None
    
    def should_fetch_data(self, user_message: str) -> bool:
        """
        Determine if we should automatically fetch Garmin data for this query.
        
        Args:
            user_message: The user's input message
            
        Returns:
            True if we should fetch data automatically
        """
        # Keywords that suggest the user wants analysis of their actual data
        data_keywords = [
            'my run', 'my latest', 'my recent', 'my last',
            'analyze', 'how did i', 'how was my',
            'my performance', 'my pace', 'my training',
            'compare my', 'my fitness', 'my progress'
        ]
        
        message_lower = user_message.lower()
        return any(keyword in message_lower for keyword in data_keywords)
    
    def get_routing_decision(self, user_message: str) -> Dict[str, Any]:
        """
        Get a complete routing decision for the user's message.
        
        Args:
            user_message: The user's input message
            
        Returns:
            Dict with routing information
        """
        intent = self.detect_intent(user_message)
        should_fetch = self.should_fetch_data(user_message)
        
        decision = {
            'intent': intent,
            'should_fetch_data': should_fetch,
            'use_agent': intent is not None,
            'endpoint': None,
            'requires_context': False
        }
        
        # Map intent to endpoint
        if intent:
            decision['endpoint'] = f"/{intent.replace('_', '-')}"
        
        # Determine if we need context from previous analysis
        if any(word in user_message.lower() for word in ['based on', 'from my', 'according to']):
            decision['requires_context'] = True
        
        logger.info(f"Routing decision: {decision}")
        return decision

# Made with Bob
