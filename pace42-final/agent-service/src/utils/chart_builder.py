from typing import Dict, Any, List, Optional
from datetime import datetime
import logging
import statistics

logger = logging.getLogger(__name__)


def build_single_run_detail_charts(activity_data: dict, metrics: List[str]) -> List[Dict[str, Any]]:
    """
    Build insightful charts for a single run analysis.
    
    Redesigned to show actionable insights:
    1. Pace Consistency: How stable was your pacing (vs average)
    2. Split Analysis: Positive/negative split detection
    3. Heart Rate Response: HR vs pace correlation
    4. Effort Distribution: Visual representation of effort by km
    
    Args:
        activity_data: Normalized activity data dictionary
        metrics: List of metric names to chart
    
    Returns:
        List of chart dictionaries
    """
    if not activity_data:
        logger.warning("build_single_run_detail_charts: No activity_data provided")
        return []
    
    laps = activity_data.get("laps", [])
    if not laps:
        logger.warning("build_single_run_detail_charts: No laps data available")
        return []
    
    logger.info(f"build_single_run_detail_charts: Processing {len(laps)} laps")
    
    # Extract lap data
    lap_data = []
    cumulative_distance = 0.0
    
    for i, lap in enumerate(laps):
        lap_distance = lap.get("distance_km", 0)
        duration_min = lap.get("duration_min", 0)
        
        if lap_distance > 0 and duration_min > 0:
            pace = duration_min / lap_distance
        else:
            pace = 0
            
        cumulative_distance += lap_distance
        
        lap_data.append({
            "km": cumulative_distance,
            "lap_num": i + 1,
            "pace": pace,
            "hr": lap.get("avg_hr", 0),
            "cadence": lap.get("avg_cadence", 0),
            "power": lap.get("avg_power", 0),
        })
    
    charts = []
    
    # Calculate average pace for comparison
    valid_paces = [l["pace"] for l in lap_data if l["pace"] > 0]
    avg_pace = statistics.mean(valid_paces) if valid_paces else 0
    
    # CHART 1: Pace Consistency (vs average with deviation zones)
    if avg_pace > 0:
        pace_deviations = []
        colors = []
        for lap in lap_data:
            if lap["pace"] > 0:
                dev = ((lap["pace"] - avg_pace) / avg_pace) * 100
                pace_deviations.append(round(dev, 1))
                # Color based on deviation
                if abs(dev) <= 5:
                    colors.append("#10b981")  # Green = consistent
                elif abs(dev) <= 10:
                    colors.append("#f59e0b")  # Orange = moderate variance
                else:
                    colors.append("#ef4444")  # Red = high variance
            else:
                pace_deviations.append(0)
                colors.append("#6b7280")
        
        x_labels = [f"{lap['km']:.1f}k" for lap in lap_data]
        
        charts.append({
            "id": "pace_consistency",
            "type": "bar",
            "title": "Pace Consistency (% vs Average)",
            "xLabels": x_labels,
            "yLabel": "% deviation",
            "series": [
                {
                    "label": "Pace Deviation",
                    "data": pace_deviations,
                    "colors": colors,
                    "unit": "%"
                }
            ],
            "note": f"Avg: {avg_pace:.2f} min/km | Green: ±5%, Orange: ±10%, Red: >10%"
        })
    
    # CHART 2: Split Analysis (First half vs Second half)
    if len(lap_data) >= 2:
        mid = len(lap_data) // 2
        first_half_paces = [l["pace"] for l in lap_data[:mid] if l["pace"] > 0]
        second_half_paces = [l["pace"] for l in lap_data[mid:] if l["pace"] > 0]
        
        if first_half_paces and second_half_paces:
            first_avg = statistics.mean(first_half_paces)
            second_avg = statistics.mean(second_half_paces)
            split_diff = ((second_avg - first_avg) / first_avg) * 100 if first_avg > 0 else 0
            
            # Create split comparison chart
            charts.append({
                "id": "split_analysis",
                "type": "bar",
                "title": "Split Analysis (First vs Second Half)",
                "xLabels": ["First Half", "Second Half"],
                "yLabel": "min/km",
                "series": [
                    {
                        "label": "Avg Pace",
                        "data": [round(first_avg, 2), round(second_avg, 2)],
                        "colors": ["#3b82f6", "#8b5cf6"],
                        "unit": "min/km"
                    }
                ],
                "note": f"{'Negative' if split_diff < 0 else 'Positive'} split: {abs(split_diff):.1f}% {'faster' if split_diff < 0 else 'slower'} in 2nd half"
            })
    
    # CHART 3: Heart Rate Response (if available)
    valid_hrs = [l["hr"] for l in lap_data if l["hr"] > 0]
    if valid_hrs:
        hr_trend = []
        for lap in lap_data:
            hr = lap["hr"]
            if hr > 0:
                # Categorize HR into zones
                hr_trend.append(hr)
        
        x_labels = [f"{lap['km']:.1f}k" for lap in lap_data]
        
        charts.append({
            "id": "hr_response",
            "type": "line",
            "title": "Heart Rate Response",
            "xLabels": x_labels,
            "yLabel": "bpm",
            "series": [
                {
                    "label": "Heart Rate",
                    "data": hr_trend,
                    "color": "#ef4444",
                    "unit": "bpm"
                }
            ],
            "note": f"Avg HR: {int(statistics.mean(valid_hrs))} bpm | Max: {int(max(valid_hrs))} bpm"
        })
    
    # CHART 4: Effort Distribution (by km)
    effort_scores = []
    for lap in lap_data:
        score = 0
        if lap["pace"] > 0 and avg_pace > 0:
            pace_ratio = avg_pace / lap["pace"] if lap["pace"] > 0 else 1
            score = min(100, max(0, pace_ratio * 50))
        if lap["hr"] > 0:
            hr_factor = min(100, lap["hr"]) / 100
            score = score * 0.7 + hr_factor * 30
        effort_scores.append(round(score, 1))
    
    x_labels = [f"{lap['km']:.1f}k" for lap in lap_data]
    
    charts.append({
        "id": "effort_distribution",
        "type": "bar",
        "title": "Effort Distribution by KM",
        "xLabels": x_labels,
        "yLabel": "Effort Score",
        "series": [
            {
                "label": "Effort",
                "data": effort_scores,
                "color": "#00D4AA",
                "unit": "score"
            }
        ],
        "note": "Higher score = higher effort relative to your average"
    })
    
    logger.info(f"build_single_run_detail_charts: Generated {len(charts)} charts")
    return charts


def _format_date(date_str: Optional[str]) -> str:
    if not date_str:
        return "Unknown"
    try:
        # Handles ISO format with or without timezone
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.strftime("%b %d")
    except Exception:
        return date_str[:10]


def build_run_metric_charts(activities: List[Dict[str, Any]], max_runs: int) -> List[Dict[str, Any]]:
    """
    Build metric charts for recent runs.
    
    Args:
        activities: List of activity data (expected to be pre-sorted by date, newest first)
        max_runs: Maximum number of runs to include in charts
        
    Returns:
        List of chart configurations with date-based xLabels
    """
    if not activities:
        logger.warning("build_run_metric_charts: No activities provided")
        return []
    
    # Sort activities by date (newest first)
    def _safe_date(activity: Dict[str, Any]) -> str:
        raw_date = (
            activity.get("normalized", {})
            .get("activity", {})
            .get("date")
        )
        if raw_date is None:
            return ""
        if isinstance(raw_date, str):
            return raw_date
        return str(raw_date)

    sorted_activities = sorted(
        activities,
        key=_safe_date,
        reverse=True
    )
    
    logger.info(f"build_run_metric_charts: Processing {len(sorted_activities)} activities, taking top {max_runs}")
    
    recent = sorted_activities[:max_runs]
    labels = []
    pace_values = []
    hr_values = []
    cadence_values = []
    distance_values = []

    for idx, activity in enumerate(recent, start=1):
        normalized = activity.get("normalized", {})
        activity_data = normalized.get("activity", {}) if isinstance(normalized, dict) else {}
        label = _format_date(activity_data.get("date"))
        if label == "Unknown":
            label = f"Run {idx}"
        labels.append(label)
        pace_values.append(activity_data.get("avg_pace_min_per_km") or 0)
        hr_values.append(activity_data.get("avg_hr") or 0)
        cadence_values.append(activity_data.get("avg_cadence") or 0)
        distance_values.append(activity_data.get("distance_km") or 0)

    charts = []
    
    # Reverse for chronological order (oldest first for trend charts)
    labels_rev = list(reversed(labels))
    pace_rev = list(reversed(pace_values))
    hr_rev = list(reversed(hr_values))
    cadence_rev = list(reversed(cadence_values))
    distance_rev = list(reversed(distance_values))

    # Pace trend
    if any(pace_rev):
        charts.append({
            "id": "pace_trend",
            "type": "line",
            "title": "Pace Trend (Recent Runs)",
            "xLabels": labels_rev,
            "yLabel": "min/km",
            "series": [{"label": "Pace", "data": pace_rev, "color": "#4f46e5"}]
        })

    # Heart rate trend
    if any(hr_rev):
        charts.append({
            "id": "hr_trend",
            "type": "line",
            "title": "Heart Rate Trend (Recent Runs)",
            "xLabels": labels_rev,
            "yLabel": "bpm",
            "series": [{"label": "Heart Rate", "data": hr_rev, "color": "#ef4444"}]
        })

    # Distance trend
    if any(distance_rev):
        charts.append({
            "id": "distance_trend",
            "type": "bar",
            "title": "Distance (Recent Runs)",
            "xLabels": labels_rev,
            "yLabel": "km",
            "series": [{"label": "Distance", "data": distance_rev, "color": "#10b981"}]
        })

    logger.info(f"build_run_metric_charts: Generated {len(charts)} charts")
    return charts
