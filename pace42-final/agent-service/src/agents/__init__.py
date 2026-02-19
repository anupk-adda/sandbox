"""
Multi-Agent System for Running Coach
"""

from .current_run_analyzer import CurrentRunAnalyzer
from .last_runs_comparator import LastRunsComparator
from .fitness_trend_analyzer import FitnessTrendAnalyzer
from .coach_orchestrator import CoachOrchestrator
from .coach_qa import CoachQAAgent
from .intent_router import IntentRouter

__all__ = [
    'CurrentRunAnalyzer',
    'LastRunsComparator',
    'FitnessTrendAnalyzer',
    'CoachOrchestrator',
    'CoachQAAgent',
    'IntentRouter'
]

# Made with Bob
