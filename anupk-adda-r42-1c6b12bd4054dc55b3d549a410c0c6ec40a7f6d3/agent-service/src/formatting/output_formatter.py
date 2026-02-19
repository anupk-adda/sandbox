"""
Output Formatter

Ensures consistent, well-formatted output from AI analysis.
Enforces markdown structure with bold headers, bullet points, and specific data.
"""

import re
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class OutputFormatter:
    """
    Format LLM output to match required style:
    - **Bold section headers:**
    - Bullet points
    - Specific data points
    - Encouraging summary
    """
    
    def __init__(self):
        self.logger = logger
    
    def format_analysis(self, raw_analysis: str, data: Optional[Dict] = None) -> str:
        """
        Ensure output has proper formatting.
        
        Args:
            raw_analysis: Raw text from LLM
            data: Optional data dictionary for adding specificity
            
        Returns:
            Formatted markdown text
        """
        if not raw_analysis or not raw_analysis.strip():
            return "No analysis available."
        
        # First, try to parse existing structure
        sections = self._parse_sections(raw_analysis)
        
        # If well-structured, enhance it
        if sections:
            return self._format_structured_sections(sections, data)
        
        # Otherwise, apply basic formatting
        return self._apply_basic_formatting(raw_analysis)
    
    def _parse_sections(self, text: str) -> Optional[Dict[str, List[str]]]:
        """
        Parse text into sections (Strengths, Areas to Consider, Summary).
        
        Args:
            text: Raw text to parse
            
        Returns:
            Dictionary of sections or None if not parseable
        """
        sections = {}
        
        # Look for common section patterns
        strengths_pattern = r'\*\*Strengths:?\*\*|Strengths:|STRENGTHS:|## Strengths'
        areas_pattern = r'\*\*Areas to Consider:?\*\*|Areas to Consider:|AREAS TO CONSIDER:|## Areas to Consider'
        
        # Split by sections
        parts = re.split(f'({strengths_pattern}|{areas_pattern})', text, flags=re.IGNORECASE)
        
        current_section = None
        current_content = []
        
        for part in parts:
            part_lower = part.lower().strip()
            
            if 'strength' in part_lower:
                if current_section and current_content:
                    sections[current_section] = current_content
                current_section = 'strengths'
                current_content = []
            elif 'area' in part_lower or 'consider' in part_lower:
                if current_section and current_content:
                    sections[current_section] = current_content
                current_section = 'areas'
                current_content = []
            elif part.strip():
                # Extract bullet points or sentences
                bullets = self._extract_bullets(part)
                if bullets:
                    current_content.extend(bullets)
                elif current_section is None:
                    # This might be a summary at the end
                    sections['summary'] = part.strip()
        
        # Add last section
        if current_section and current_content:
            sections[current_section] = current_content
        
        return sections if sections else None
    
    def _extract_bullets(self, text: str) -> List[str]:
        """
        Extract bullet points from text.
        
        Args:
            text: Text to extract from
            
        Returns:
            List of bullet point strings
        """
        bullets = []
        
        # Look for lines starting with -, *, or •
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith(('-', '*', '•')):
                # Remove bullet marker
                bullet_text = re.sub(r'^[-*•]\s*', '', line).strip()
                if bullet_text:
                    bullets.append(bullet_text)
            elif line and not any(keyword in line.lower() for keyword in ['strengths', 'areas', 'consider']):
                # If it's a sentence without bullet, treat as bullet
                if len(line) > 20 and not line.endswith(':'):
                    bullets.append(line)
        
        return bullets
    
    def _format_structured_sections(self, sections: Dict[str, List[str]], data: Optional[Dict] = None) -> str:
        """
        Format parsed sections into proper markdown.
        
        Args:
            sections: Parsed sections dictionary
            data: Optional data for adding specificity
            
        Returns:
            Formatted markdown string
        """
        formatted = ""
        
        # Strengths section
        if 'strengths' in sections and sections['strengths']:
            formatted += "**Strengths:**\n"
            for point in sections['strengths']:
                # Ensure it starts with bullet
                if not point.startswith('-'):
                    point = f"- {point}"
                formatted += f"{point}\n"
            formatted += "\n"
        
        # Areas to consider section
        if 'areas' in sections and sections['areas']:
            formatted += "**Areas to Consider:**\n"
            for point in sections['areas']:
                # Ensure it starts with bullet
                if not point.startswith('-'):
                    point = f"- {point}"
                formatted += f"{point}\n"
            formatted += "\n"
        
        # Summary
        if 'summary' in sections:
            summary = sections['summary']
            # Ensure summary doesn't have bullet
            summary = re.sub(r'^[-*•]\s*', '', summary).strip()
            formatted += f"{summary}\n"
        
        return formatted.strip()
    
    def _apply_basic_formatting(self, text: str) -> str:
        """
        Apply basic formatting to unstructured text.
        
        Args:
            text: Raw text
            
        Returns:
            Formatted text with basic structure
        """
        # Split into paragraphs
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        
        if not paragraphs:
            return text
        
        formatted = ""
        
        # Try to identify positive and constructive points
        positive_keywords = ['great', 'excellent', 'strong', 'good', 'well', 'consistent', 'solid']
        constructive_keywords = ['consider', 'watch', 'challenging', 'could', 'might', 'suggest']
        
        strengths = []
        areas = []
        summary = []
        
        for para in paragraphs:
            para_lower = para.lower()
            
            # Check if it's a list of points
            if '-' in para or '•' in para or '*' in para:
                bullets = self._extract_bullets(para)
                for bullet in bullets:
                    bullet_lower = bullet.lower()
                    if any(kw in bullet_lower for kw in positive_keywords):
                        strengths.append(bullet)
                    elif any(kw in bullet_lower for kw in constructive_keywords):
                        areas.append(bullet)
                    else:
                        # Default to strengths if unclear
                        strengths.append(bullet)
            else:
                # Single paragraph - likely summary
                if len(para) < 200:  # Short paragraph = summary
                    summary.append(para)
                else:
                    # Long paragraph - try to split into points
                    sentences = re.split(r'[.!]\s+', para)
                    for sent in sentences:
                        if sent.strip():
                            sent_lower = sent.lower()
                            if any(kw in sent_lower for kw in positive_keywords):
                                strengths.append(sent.strip())
                            elif any(kw in sent_lower for kw in constructive_keywords):
                                areas.append(sent.strip())
        
        # Format output
        if strengths:
            formatted += "**Strengths:**\n"
            for point in strengths:
                formatted += f"- {point}\n"
            formatted += "\n"
        
        if areas:
            formatted += "**Areas to Consider:**\n"
            for point in areas:
                formatted += f"- {point}\n"
            formatted += "\n"
        
        if summary:
            formatted += ' '.join(summary) + "\n"
        elif not strengths and not areas:
            # If we couldn't parse anything, return original
            return text
        
        return formatted.strip()
    
    def ensure_data_specificity(self, text: str, data: Dict) -> str:
        """
        Ensure specific data points are included in the text.
        Add specific values where generic references exist.
        
        Args:
            text: Text to enhance
            data: Data dictionary with specific values
            
        Returns:
            Enhanced text with specific data points
        """
        enhanced = text
        
        # Add lap times if mentioned generically
        if 'lap' in text.lower() and 'laps' in data:
            laps = data['laps']
            for i, lap in enumerate(laps, 1):
                # Look for "lap X" without time
                pattern = rf'\blap {i}\b(?!\s*\([0-9:]+\))'
                if re.search(pattern, enhanced, re.IGNORECASE):
                    pace = lap.get('pace_formatted', 'N/A')
                    replacement = f"lap {i} ({pace})"
                    enhanced = re.sub(pattern, replacement, enhanced, flags=re.IGNORECASE)
        
        # Add HR values if mentioned generically
        if 'heart rate' in text.lower() or 'hr' in text.lower():
            if 'avg_hr' in data and data['avg_hr'] > 0:
                # Look for generic HR mentions
                pattern = r'\bheart rate\b(?!\s*\d+)'
                if re.search(pattern, enhanced, re.IGNORECASE):
                    replacement = f"heart rate ({data['avg_hr']} bpm avg)"
                    enhanced = re.sub(pattern, replacement, enhanced, flags=re.IGNORECASE, count=1)
        
        # Add pace if mentioned generically
        if 'pace' in text.lower() and 'avg_pace_min_per_km' in data:
            pace = data['avg_pace_min_per_km']
            if pace > 0:
                pace_formatted = self._format_pace(pace)
                pattern = r'\bpace\b(?!\s*\([0-9:]+\))'
                if re.search(pattern, enhanced, re.IGNORECASE):
                    replacement = f"pace ({pace_formatted})"
                    enhanced = re.sub(pattern, replacement, enhanced, flags=re.IGNORECASE, count=1)
        
        return enhanced
    
    def add_encouraging_tone(self, text: str) -> str:
        """
        Ensure text has an encouraging, supportive tone.
        
        Args:
            text: Text to enhance
            
        Returns:
            Text with encouraging tone
        """
        # If text doesn't end with encouraging statement, add one
        encouraging_endings = [
            'great job', 'well done', 'solid', 'excellent', 'keep it up',
            'nice work', 'strong', 'impressive'
        ]
        
        text_lower = text.lower()
        has_encouraging_end = any(phrase in text_lower[-100:] for phrase in encouraging_endings)
        
        if not has_encouraging_end:
            # Add encouraging summary if missing
            if not text.endswith(('!', '.')):
                text += "."
            text += " Keep up the great work!"
        
        return text
    
    def _format_pace(self, pace_min_per_km: float) -> str:
        """Format pace as MM:SS."""
        if pace_min_per_km <= 0:
            return "N/A"
        minutes = int(pace_min_per_km)
        seconds = int((pace_min_per_km - minutes) * 60)
        return f"{minutes}:{seconds:02d}"
    
    def create_example_format(self) -> str:
        """
        Return example format for prompts.
        
        Returns:
            Example formatted output
        """
        return """**Strengths:**
- Great negative split strategy - you warmed up properly in lap 1 (6:34)
- Excellent consistency in laps 2-5 (all within 6 seconds)
- Strong cadence throughout (180 spm average)
- High training effect (4.2) shows you pushed yourself appropriately

**Areas to Consider:**
- Running in 79% humidity is challenging - consider earlier start times
- You spent significant time in Zone 5 (15 minutes)
- The heart rate progression (131 → 163 → 168 → 174 → 172) shows good pacing

This was a solid tempo-style run with excellent execution!"""

# Made with Bob
