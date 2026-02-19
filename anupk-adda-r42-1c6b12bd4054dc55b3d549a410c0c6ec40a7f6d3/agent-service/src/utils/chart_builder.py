from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def build_single_run_detail_charts(activity_data: dict, metrics: List[str]) -> List[Dict[str, Any]]:
    """
    Build detailed charts for a single run analysis.
    
    This function generates charts with time/distance on the X-axis and metric values
    on the Y-axis, suitable for analyzing a single run's performance over time.
    
    This is DIFFERENT from build_run_metric_charts() which compares metrics across
    multiple runs (multi-run trend analysis with "Run 1, Run 2" or date labels).
    
    Args:
        activity_data: Normalized activity data dictionary containing:
            - laps: List of lap data with metrics per lap
            - distance_km: Total distance
            - duration_min: Total duration
            - avg_pace_min_per_km, avg_hr, avg_cadence, etc.
        metrics: List of metric names to chart (e.g., ['pace', 'hr', 'cadence', 'power'])
    
    Returns:
        List of chart dictionaries with structure:
        {
            "id": str,
            "type": "line",
            "title": str,
            "xLabels": List[str],  # Distance markers (e.g., "1.0 km", "2.0 km")
            "yLabel": str,
            "series": [{"label": str, "data": List[float], "color": str}]
        }
    
    Note:
        - Returns empty list if activity_data is missing or has no laps
        - X-axis uses cumulative distance in km
        - Handles missing data gracefully (uses 0 for missing values)
    """
    if not activity_data:
        logger.warning("build_single_run_detail_charts: No activity_data provided")
        return []
    
    laps = activity_data.get("laps", [])
    if not laps:
        logger.warning("build_single_run_detail_charts: No laps data available")
        return []
    
    logger.info(f"build_single_run_detail_charts: Processing {len(laps)} laps for metrics: {metrics}")
    
    # Build X-axis labels (cumulative distance)
    x_labels = []
    cumulative_distance = 0.0
    
    # Extract data for each metric
    pace_data = []
    hr_data = []
    cadence_data = []
    power_data = []
    
    for lap in laps:
        # Calculate cumulative distance
        lap_distance = lap.get("distance_km", 0)
        cumulative_distance += lap_distance
        x_labels.append(f"{cumulative_distance:.1f} km")
        
        # Extract metrics from lap
        # Pace: calculate from duration and distance
        duration_min = lap.get("duration_min", 0)
        if lap_distance > 0 and duration_min > 0:
            pace = duration_min / lap_distance  # min/km
        else:
            pace = 0
        pace_data.append(pace)
        
        # Heart rate
        hr_data.append(lap.get("avg_hr", 0))
        
        # Cadence
        cadence_data.append(lap.get("avg_cadence", 0))
        
        # Power (if available)
        power_data.append(lap.get("avg_power", 0))
    
    # Build charts based on requested metrics and data availability
    charts = []
    
    # Pace chart
    if 'pace' in metrics and any(v > 0 for v in pace_data):
        charts.append({
            "id": "pace_over_distance",
            "type": "line",
            "title": "Pace Over Distance",
            "xLabels": x_labels,
            "yLabel": "min/km",
            "series": [
                {"label": "Pace", "data": pace_data, "color": "#4f46e5"}
            ]
        })
    
    # Heart rate chart
    if 'hr' in metrics and any(v > 0 for v in hr_data):
        charts.append({
            "id": "hr_over_distance",
            "type": "line",
            "title": "Heart Rate Over Distance",
            "xLabels": x_labels,
            "yLabel": "bpm",
            "series": [
                {"label": "Heart Rate", "data": hr_data, "color": "#ef4444"}
            ]
        })
    
    # Cadence chart
    if 'cadence' in metrics and any(v > 0 for v in cadence_data):
        charts.append({
            "id": "cadence_over_distance",
            "type": "line",
            "title": "Cadence Over Distance",
            "xLabels": x_labels,
            "yLabel": "spm",
            "series": [
                {"label": "Cadence", "data": cadence_data, "color": "#10b981"}
            ]
        })
    
    # Power chart (if available)
    if 'power' in metrics and any(v > 0 for v in power_data):
        charts.append({
            "id": "power_over_distance",
            "type": "line",
            "title": "Power Over Distance",
            "xLabels": x_labels,
            "yLabel": "watts",
            "series": [
                {"label": "Power", "data": power_data, "color": "#f97316"}
            ]
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
        List of chart configurations with date-based xLabels (e.g., "Jan 15", "Feb 03")
        
    Note:
        - Activities are sorted by date (newest first) to ensure consistent order
        - X-labels use date format "MMM DD" (e.g., "Jan 15") for better visualization
        - Falls back to "Run N" format if date is unavailable
    """
    if not activities:
        logger.warning("build_run_metric_charts: No activities provided")
        return []
    
    # Sort activities by date (newest first) to ensure consistent order
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
    
    # Log activity order for debugging
    for idx, activity in enumerate(sorted_activities[:max_runs], start=1):
        activity_data = activity.get("normalized", {}).get("activity", {})
        date = activity_data.get("date", "Unknown")
        logger.debug(f"  Activity {idx}: date={date}")
    
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

    if any(v > 0 for v in pace_values):
        charts.append({
            "id": "pace_last_runs",
            "type": "line",
            "title": f"Average Pace (last {len(labels)} runs)",
            "xLabels": labels,
            "yLabel": "min/km",
            "series": [
                {"label": "Pace", "data": pace_values, "color": "#4f46e5"}
            ]
        })

    if any(v > 0 for v in hr_values):
        charts.append({
            "id": "hr_last_runs",
            "type": "line",
            "title": f"Average Heart Rate (last {len(labels)} runs)",
            "xLabels": labels,
            "yLabel": "bpm",
            "series": [
                {"label": "Avg HR", "data": hr_values, "color": "#ef4444"}
            ]
        })

    if any(v > 0 for v in cadence_values):
        charts.append({
            "id": "cadence_last_runs",
            "type": "line",
            "title": f"Average Cadence (last {len(labels)} runs)",
            "xLabels": labels,
            "yLabel": "spm",
            "series": [
                {"label": "Cadence", "data": cadence_values, "color": "#10b981"}
            ]
        })

    if any(v > 0 for v in distance_values):
        charts.append({
            "id": "distance_last_runs",
            "type": "line",
            "title": f"Distance (last {len(labels)} runs)",
            "xLabels": labels,
            "yLabel": "km",
            "series": [
                {"label": "Distance", "data": distance_values, "color": "#f97316"}
            ]
        })

    return charts
