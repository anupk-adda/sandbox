"""
Response formatter for structuring LLM output into proper markdown format.
"""
import re
from typing import Dict, List, Any


class RunAnalysisFormatter:
    """Format raw LLM analysis into structured markdown."""
    
    def __init__(self):
        self.sections = {
            'summary': '📊 Run Summary',
            'strengths': '✅ Strengths',
            'metrics': '🎯 Key Metrics',
            'coaching': '💡 Coaching Points',
            'recommendations': '🔧 Recommendations',
            'bottom_line': 'Bottom Line'
        }
    
    def format_analysis(self, raw_text: str, activity_data: Dict[str, Any]) -> str:
        """
        Format raw LLM output into structured markdown.
        
        Args:
            raw_text: Raw text from LLM
            activity_data: Normalized activity data for fallback
            
        Returns:
            Formatted markdown string
        """
        # Extract key information from raw text
        parsed = self._parse_raw_text(raw_text)
        
        # Build formatted output
        formatted = self._build_formatted_output(parsed, activity_data)
        
        return formatted
    
    def _parse_raw_text(self, text: str) -> Dict[str, Any]:
        """Parse raw text to extract key points."""
        parsed = {
            'strengths': [],
            'metrics': [],
            'coaching_points': [],
            'recommendations': [],
            'bottom_line': ''
        }
        
        # Clean up text
        text = text.strip()
        
        # Look for key patterns
        # Strengths: pacing, HR, cadence, form
        strength_patterns = [
            r'pacing[^.]*(?:consistent|good|excellent|strong)[^.]*',
            r'(?:HR|heart rate)[^.]*(?:control|good|excellent|strong)[^.]*',
            r'cadence[^.]*(?:good|excellent|strong|maintained)[^.]*',
            r'(?:form|execution)[^.]*(?:good|excellent|strong)[^.]*'
        ]
        
        for pattern in strength_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches[:3]:  # Limit to 3 strengths
                if match and match not in parsed['strengths']:
                    parsed['strengths'].append(match.strip().capitalize())
        
        # Metrics: TE, HR, pacing, form
        metric_patterns = [
            r'(?:training effect|TE)[^.]*\d+\.?\d*[^.]*',
            r'(?:heart rate|HR)[^.]*\d+[^.]*',
            r'(?:pace|split)[^.]*\d+:\d+[^.]*',
            r'cadence[^.]*\d+[^.]*'
        ]
        
        for pattern in metric_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches[:4]:  # Limit to 4 metrics
                if match and match not in parsed['metrics']:
                    parsed['metrics'].append(match.strip().capitalize())
        
        # Coaching points: heat, drift, zones, strategy
        coaching_patterns = [
            r'(?:heat|temperature|humidity|weather)[^.]*',
            r'(?:drift|fatigue)[^.]*',
            r'(?:zone|easy|recovery)[^.]*',
            r'(?:strategy|pacing|execution)[^.]*'
        ]
        
        for pattern in coaching_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches[:3]:  # Limit to 3 coaching points
                if match and len(match) > 20 and match not in parsed['coaching_points']:
                    parsed['coaching_points'].append(match.strip().capitalize())
        
        # Recommendations: hydration, timing, recovery, training
        rec_patterns = [
            r'(?:consider|try|recommend)[^.]*',
            r'(?:hydration|water|drink)[^.]*',
            r'(?:recovery|rest|easy)[^.]*',
            r'(?:incorporate|add|include)[^.]*'
        ]
        
        for pattern in rec_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches[:2]:  # Limit to 2 recommendations
                if match and len(match) > 15 and match not in parsed['recommendations']:
                    parsed['recommendations'].append(match.strip().capitalize())
        
        # Bottom line: look for encouraging phrases
        bottom_line_patterns = [
            r'(?:great|excellent|outstanding|solid|good)[^.]*(?:effort|work|run|job)[^.]*',
            r'keep up[^.]*',
            r'well done[^.]*'
        ]
        
        for pattern in bottom_line_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                parsed['bottom_line'] = match.group(0).strip().capitalize()
                break
        
        if not parsed['bottom_line']:
            parsed['bottom_line'] = "Keep up the great work!"

        # De-duplicate lists with normalization (handles repeated/overlapping phrasing)
        parsed['strengths'] = self._dedupe_list(parsed['strengths'])
        parsed['metrics'] = self._dedupe_list(parsed['metrics'])
        parsed['coaching_points'] = self._dedupe_list(parsed['coaching_points'])
        parsed['recommendations'] = self._dedupe_list(parsed['recommendations'])
        
        return parsed
    
    def _build_formatted_output(self, parsed: Dict[str, Any], activity_data: Dict[str, Any]) -> str:
        """Build formatted markdown output."""
        output = []
        
        # Run Summary
        summary = self._build_summary(activity_data)
        output.append(f"## {self.sections['summary']}")
        output.append(summary)
        output.append("")
        
        # Strengths
        output.append(f"## {self.sections['strengths']}")
        if parsed['strengths']:
            for strength in parsed['strengths'][:3]:
                output.append(f"- {strength}")
        else:
            output.append(f"- Completed {activity_data.get('distance_km', 0):.2f}km run")
            output.append(f"- Maintained average pace of {activity_data.get('avg_pace', 'N/A')}")
            output.append(f"- Good effort with HR avg {activity_data.get('avg_hr', 'N/A')} bpm")
        output.append("")
        
        # Key Metrics
        output.append(f"## {self.sections['metrics']}")
        if parsed['metrics']:
            for metric in parsed['metrics'][:4]:
                # Format as bold label if possible
                if ':' in metric:
                    parts = metric.split(':', 1)
                    output.append(f"- **{parts[0].strip()}**: {parts[1].strip()}")
                else:
                    output.append(f"- {metric}")
        else:
            output.append(f"- **Training Effect**: {activity_data.get('training_effect', 'N/A')}")
            output.append(f"- **Heart Rate**: {activity_data.get('avg_hr', 'N/A')}/{activity_data.get('max_hr', 'N/A')} bpm")
            output.append(f"- **Pacing**: {activity_data.get('avg_pace', 'N/A')}/km average")
            output.append(f"- **Form**: {activity_data.get('avg_cadence', 'N/A')} spm cadence")
        output.append("")
        
        # Coaching Points
        output.append(f"## {self.sections['coaching']}")
        if parsed['coaching_points']:
            for point in parsed['coaching_points'][:3]:
                output.append(f"- {point}")
        else:
            output.append(f"- Solid effort for a {activity_data.get('distance_km', 0):.2f}km run")
            output.append(f"- Weather conditions: {activity_data.get('temp', 'N/A')}°F, {activity_data.get('humidity', 'N/A')}% humidity")
        output.append("")
        
        # Recommendations
        output.append(f"## {self.sections['recommendations']}")
        if parsed['recommendations']:
            for rec in parsed['recommendations'][:2]:
                output.append(f"- {rec}")
        else:
            output.append(f"- Continue building aerobic base with consistent training")
            output.append(f"- Ensure adequate recovery between quality sessions")
        output.append("")
        
        # Bottom Line
        output.append("---")
        output.append(f"**{self.sections['bottom_line']}**: {parsed['bottom_line']} 💪")
        
        return "\n".join(output)
    
    def _build_summary(self, activity_data: Dict[str, Any]) -> str:
        """Build run summary from activity data."""
        distance = activity_data.get('distance_km', 0)
        duration_min = activity_data.get('duration_min', 0)
        avg_pace = activity_data.get('avg_pace', 'N/A')
        minutes = int(duration_min)
        seconds = int(round((duration_min - minutes) * 60))
        return f"{distance:.2f}km in {minutes}:{seconds:02d} ({avg_pace}/km avg) - solid training run"

    def _normalize_line(self, text: str) -> str:
        text = text.lower()
        text = re.sub(r'[^a-z0-9\s%/.:+-]', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _dedupe_list(self, items: List[str]) -> List[str]:
        seen = set()
        unique = []
        for item in items:
            norm = self._normalize_line(item)
            if not norm or norm in seen:
                continue
            seen.add(norm)
            unique.append(item)
        return unique


# Made with Bob
