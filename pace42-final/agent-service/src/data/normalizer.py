"""
Garmin Data Normalizer

Handles all data quality issues from Garmin MCP in one place.
Provides clean, complete, untruncated data to agents.
"""

from typing import Dict, List, Optional, Any
import logging
import json

logger = logging.getLogger(__name__)


class GarminDataNormalizer:
    """
    Normalize Garmin data from MCP calls.
    Handle incomplete/incorrect data.
    Provide clean, complete context to agents.
    """
    
    def __init__(self):
        self.logger = logger
    
    def normalize_activity(self, raw_data: Dict) -> Dict:
        """
        Normalize single activity data.
        Extract from splits if summary is empty.
        
        Args:
            raw_data: Raw activity data from MCP
            
        Returns:
            Normalized activity dictionary with consistent structure
        """
        if not raw_data:
            return self._empty_activity()
        
        # Handle case where raw_data might be a string (shouldn't happen, but defensive)
        if isinstance(raw_data, str):
            try:
                raw_data = json.loads(raw_data)
            except json.JSONDecodeError:
                self.logger.error("Failed to parse raw_data as JSON")
                return self._empty_activity()
        
        # Handle case where raw_data has a 'raw_text' key (MCP returned text instead of JSON)
        if isinstance(raw_data, dict) and "raw_text" in raw_data:
            self.logger.warning("Activity data returned as raw text, attempting to parse")
            try:
                raw_data = json.loads(raw_data["raw_text"])
            except (json.JSONDecodeError, KeyError):
                self.logger.error("Failed to parse raw_text as JSON")
                return self._empty_activity()
        
        # CRITICAL: Final check - ensure raw_data is a dict before calling .get()
        if not isinstance(raw_data, dict):
            self.logger.error(f"raw_data is not a dict after all parsing attempts, type: {type(raw_data)}, value: {str(raw_data)[:200]}")
            return self._empty_activity()
        
        # Extract activity type from nested DTO
        activity_type_dto = raw_data.get("activityTypeDTO", {})
        if isinstance(activity_type_dto, dict):
            activity_type = activity_type_dto.get("typeKey", "running")
        else:
            activity_type = "running"
        
        normalized = {
            "activity_id": raw_data.get("activityId"),
            "name": raw_data.get("activityName", "Unnamed Run"),
            "date": raw_data.get("startTimeGMT"),
            "type": activity_type,
            "description": raw_data.get("description", "")
        }
        
        # CRITICAL FIX: ALL METRICS are in summaryDTO, not at top level
        summary = raw_data.get("summaryDTO", {})
        if not isinstance(summary, dict):
            self.logger.warning(f"summaryDTO is not a dict, type: {type(summary)}")
            summary = {}
        
        # Log what we're extracting
        if summary:
            self.logger.info(f"Activity {normalized['activity_id']}: Extracting from summaryDTO with keys: {list(summary.keys())[:15]}")
        else:
            self.logger.warning(f"Activity {normalized['activity_id']}: summaryDTO is empty")
        
        # Extract metrics from summaryDTO (CORRECT location)
        distance = summary.get("distance", 0)
        duration = summary.get("duration", 0)
        
        self.logger.info(f"Activity {normalized['activity_id']}: Extracted distance={distance}m, duration={duration}s from summaryDTO")
        
        # Helper function to safely extract splits from lapDTOs
        def get_splits_safely(data):
            """Safely extract splits from lapDTOs structure"""
            # CRITICAL: Check if data itself is a string first!
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except json.JSONDecodeError:
                    self.logger.warning("Failed to parse data as JSON")
                    return []
            
            # Now safe to call .get() on data
            if not isinstance(data, dict):
                self.logger.warning(f"Data is not a dict after parsing, type: {type(data)}")
                return []
            
            # CORRECT: Look for lapDTOs directly (not "splits")
            lap_dtos = data.get("lapDTOs", [])
            
            # Ensure lap_dtos is a list
            if isinstance(lap_dtos, list):
                self.logger.info(f"Found {len(lap_dtos)} laps in lapDTOs")
                return lap_dtos
            elif isinstance(lap_dtos, str):
                try:
                    parsed = json.loads(lap_dtos)
                    if isinstance(parsed, list):
                        self.logger.info(f"Parsed lapDTOs string to list with {len(parsed)} laps")
                        return parsed
                except json.JSONDecodeError:
                    self.logger.warning("Failed to parse lapDTOs as JSON")
            
            self.logger.warning(f"lapDTOs has unexpected type: {type(lap_dtos)}")
            return []
        
        # Always try to extract splits for lap-by-lap analysis
        splits_data = raw_data.get("splits_data", {})
        if splits_data:
            self.logger.info(f"Activity {normalized['activity_id']}: Processing splits_data")
            splits = get_splits_safely(splits_data)
        else:
            # Fallback: try to get from raw_data directly
            splits = get_splits_safely(raw_data)
        
        self.logger.info(f"Activity {normalized['activity_id']}: get_splits_safely returned {len(splits) if splits else 0} splits, type: {type(splits)}")
        
        if distance == 0 or duration == 0:
            # Extract from splits - this is where real data often is
            self.logger.info(f"Activity {normalized['activity_id']}: Summary data empty, extracting from splits")
            
            # Defensive: ensure each split is a dict BEFORE using them
            valid_splits = []
            if splits:
                for i, s in enumerate(splits):
                    self.logger.info(f"Split {i}: type={type(s)}, value preview={str(s)[:100]}")
                    if isinstance(s, dict):
                        valid_splits.append(s)
                    elif isinstance(s, str):
                        try:
                            parsed = json.loads(s)
                            valid_splits.append(parsed)
                            self.logger.info(f"Split {i}: Successfully parsed string to dict")
                        except json.JSONDecodeError:
                            self.logger.warning(f"Split {i} is a string but not valid JSON, skipping")
                    else:
                        self.logger.warning(f"Split {i} is type {type(s)}, skipping")
            
            if valid_splits:
                normalized["distance_km"] = sum(s.get("distance", 0) for s in valid_splits) / 1000
                normalized["duration_min"] = sum(s.get("duration", 0) for s in valid_splits) / 60
                normalized["laps"] = self._normalize_laps(valid_splits)
            else:
                self.logger.warning(f"Activity {normalized['activity_id']}: No splits data available")
                normalized["distance_km"] = 0
                normalized["duration_min"] = 0
                normalized["laps"] = []
        else:
            # Use summary
            normalized["distance_km"] = distance / 1000
            normalized["duration_min"] = duration / 60
            # Laps already extracted above
            normalized["laps"] = self._normalize_laps(splits) if splits else []
        
        # Calculate derived metrics
        if normalized["distance_km"] > 0 and normalized["duration_min"] > 0:
            normalized["avg_pace_min_per_km"] = normalized["duration_min"] / normalized["distance_km"]
            normalized["avg_speed_kmh"] = normalized["distance_km"] / (normalized["duration_min"] / 60)
        else:
            normalized["avg_pace_min_per_km"] = 0
            normalized["avg_speed_kmh"] = 0
        
        # Add other metrics from summaryDTO (CORRECT location and field names)
        normalized["avg_hr"] = summary.get("averageHR", 0)
        normalized["max_hr"] = summary.get("maxHR", 0)
        normalized["min_hr"] = summary.get("minHR", 0)
        normalized["calories"] = summary.get("calories", 0)
        normalized["avg_cadence"] = summary.get("averageRunCadence", 0)  # Correct field name
        normalized["max_cadence"] = summary.get("maxRunCadence", 0)
        normalized["avg_power"] = summary.get("averagePower", 0)
        normalized["max_power"] = summary.get("maxPower", 0)
        normalized["training_effect"] = summary.get("trainingEffect", 0)  # Correct field name
        normalized["anaerobic_training_effect"] = summary.get("anaerobicTrainingEffect", 0)
        normalized["avg_speed_ms"] = summary.get("averageSpeed", 0)  # meters/second
        normalized["max_speed_ms"] = summary.get("maxSpeed", 0)
        
        # Log extracted metrics for verification
        self.logger.info(f"Activity {normalized['activity_id']}: Extracted metrics - "
                        f"HR: {normalized['avg_hr']}/{normalized['max_hr']} bpm, "
                        f"Cadence: {normalized['avg_cadence']} spm, "
                        f"Power: {normalized['avg_power']} W, "
                        f"TE: {normalized['training_effect']}")
        
        return normalized
    
    def _normalize_laps(self, lap_dtos: List[Dict]) -> List[Dict]:
        """
        Normalize lap data into consistent structure.
        
        Args:
            lap_dtos: Raw lap data from Garmin
            
        Returns:
            List of normalized lap dictionaries
        """
        normalized_laps = []
        
        for i, lap in enumerate(lap_dtos, 1):
            # Defensive: ensure lap is a dict
            if isinstance(lap, str):
                try:
                    lap = json.loads(lap)
                except json.JSONDecodeError:
                    self.logger.warning(f"Skipping lap {i}: failed to parse as JSON")
                    continue
            
            if not isinstance(lap, dict):
                self.logger.warning(f"Skipping lap {i}: not a dict (type: {type(lap)})")
                continue
            
            distance_m = lap.get("distance", 0)
            duration_s = lap.get("duration", 0)
            
            normalized_lap = {
                "lap_number": i,
                "distance_km": distance_m / 1000,
                "distance_m": distance_m,
                "duration_min": duration_s / 60,
                "duration_s": duration_s,
                "avg_hr": lap.get("averageHR", 0),
                "max_hr": lap.get("maxHR", 0),
                "avg_cadence": lap.get("averageRunCadence", 0),
                "max_cadence": lap.get("maxRunCadence", 0),
                "elevation_gain": lap.get("elevationGain", 0),
                "elevation_loss": lap.get("elevationLoss", 0)
            }
            
            # Calculate pace
            if distance_m > 0 and duration_s > 0:
                normalized_lap["pace_min_per_km"] = (duration_s / 60) / (distance_m / 1000)
                normalized_lap["pace_formatted"] = self._format_pace(normalized_lap["pace_min_per_km"])
            else:
                normalized_lap["pace_min_per_km"] = 0
                normalized_lap["pace_formatted"] = "N/A"
            
            normalized_laps.append(normalized_lap)
        
        return normalized_laps
    
    def normalize_hr_zones(self, raw_zones: List[Dict]) -> Dict:
        """
        Normalize HR zone data.
        Handle incomplete zone data.
        
        Args:
            raw_zones: Raw HR zone data from MCP
            
        Returns:
            Normalized HR zones dictionary
        """
        if not raw_zones:
            return {"zones": [], "total_time_s": 0, "has_complete_data": False}
        
        zones = []
        total_time = 0
        
        for zone_data in raw_zones:
            zone_num = zone_data.get("zoneNumber", 0)
            time_in_zone = zone_data.get("secsInZone", 0)
            low_boundary = zone_data.get("zoneLowBoundary", 0)
            
            zones.append({
                "zone_number": zone_num,
                "time_seconds": time_in_zone,
                "time_minutes": time_in_zone / 60,
                "low_boundary_bpm": low_boundary,
                "percentage": 0  # Will calculate after we have total
            })
            
            total_time += time_in_zone
        
        # Calculate percentages
        if total_time > 0:
            for zone in zones:
                zone["percentage"] = (zone["time_seconds"] / total_time) * 100
        
        # Check if we have complete data (should have 5 zones)
        has_complete_data = len(zones) >= 5
        
        if not has_complete_data:
            self.logger.warning(f"Incomplete HR zone data: only {len(zones)} zones found")
        
        return {
            "zones": zones,
            "total_time_s": total_time,
            "total_time_min": total_time / 60,
            "has_complete_data": has_complete_data
        }
    
    def normalize_weather(self, raw_weather: Dict) -> Dict:
        """
        Normalize weather data.
        
        Args:
            raw_weather: Raw weather data from MCP
            
        Returns:
            Normalized weather dictionary
        """
        if not raw_weather:
            return {"available": False}
        
        return {
            "available": True,
            "temp_f": raw_weather.get("temp"),
            "temp_c": ((raw_weather.get("temp") or 0) - 32) * 5/9 if raw_weather.get("temp") is not None else None,
            "apparent_temp_f": raw_weather.get("apparentTemp"),
            "apparent_temp_c": ((raw_weather.get("apparentTemp") or 0) - 32) * 5/9 if raw_weather.get("apparentTemp") is not None else None,
            "humidity": raw_weather.get("relativeHumidity"),
            "wind_speed_mph": raw_weather.get("windSpeed"),
            "wind_direction": raw_weather.get("windDirectionCompassPoint", "N/A"),
            "dew_point_f": raw_weather.get("dewPoint"),
            "condition": raw_weather.get("weatherTypeDTO", {}).get("desc", "Unknown") if raw_weather.get("weatherTypeDTO") else None
        }
    
    def provide_full_context(
        self,
        activity_data: Dict,
        splits_data: Optional[Dict] = None,
        hr_data: Optional[Dict] = None,
        weather_data: Optional[Dict] = None
    ) -> str:
        """
        Combine all data into comprehensive context string.
        NO TRUNCATION - provide everything to LLM.
        
        Args:
            activity_data: Normalized activity data
            splits_data: Raw splits data (optional, may already be in activity_data)
            hr_data: Normalized HR zone data
            weather_data: Normalized weather data
            
        Returns:
            Complete context string with all data
        """
        context = f"""# Activity Overview
- **Activity ID**: {activity_data.get('activity_id')}
- **Name**: {activity_data.get('name')}
- **Date**: {activity_data.get('date')}
- **Type**: {activity_data.get('type')}
- **Distance**: {activity_data.get('distance_km', 0):.2f} km
- **Duration**: {activity_data.get('duration_min', 0):.1f} minutes
- **Average Pace**: {activity_data.get('avg_pace_min_per_km', 0):.2f} min/km ({self._format_pace(activity_data.get('avg_pace_min_per_km', 0))})
- **Average HR**: {activity_data.get('avg_hr', 0)} bpm
- **Max HR**: {activity_data.get('max_hr', 0)} bpm
- **Average Cadence**: {activity_data.get('avg_cadence', 0)} spm
- **Training Effect**: {activity_data.get('training_effect', 0):.1f}
- **Calories**: {activity_data.get('calories', 0)}

"""
        
        # Include FULL lap details - don't summarize
        laps = activity_data.get('laps', [])
        if laps:
            context += "# Lap-by-Lap Performance\n\n"
            for lap in laps:
                context += f"""## Lap {lap['lap_number']}
- **Distance**: {lap['distance_km']:.2f} km
- **Duration**: {lap['duration_min']:.2f} minutes ({lap['duration_s']:.0f} seconds)
- **Pace**: {lap['pace_min_per_km']:.2f} min/km ({lap['pace_formatted']})
- **Average HR**: {lap['avg_hr']} bpm
- **Max HR**: {lap['max_hr']} bpm
- **Average Cadence**: {lap['avg_cadence']} spm
- **Max Cadence**: {lap['max_cadence']} spm
- **Elevation Gain**: {lap['elevation_gain']} m
- **Elevation Loss**: {lap['elevation_loss']} m

"""
        
        # Include HR zones if available
        if hr_data and hr_data.get('zones'):
            context += "# Heart Rate Zones\n\n"
            context += f"**Total Time in Zones**: {hr_data['total_time_min']:.1f} minutes\n\n"
            
            for zone in hr_data['zones']:
                context += f"""## Zone {zone['zone_number']}
- **Time**: {zone['time_minutes']:.1f} minutes ({zone['time_seconds']:.0f} seconds)
- **Percentage**: {zone['percentage']:.1f}%
- **HR Threshold**: {zone['low_boundary_bpm']}+ bpm

"""
            
            if not hr_data.get('has_complete_data'):
                context += "*Note: HR zone data may be incomplete*\n\n"
        
        # Include weather if available
        if weather_data and weather_data.get('available'):
            context += "# Weather Conditions\n\n"
            
            # Temperature
            if weather_data.get('temp_f') is not None and weather_data.get('temp_c') is not None:
                context += f"- **Temperature**: {weather_data['temp_f']:.0f}°F ({weather_data['temp_c']:.0f}°C)\n"
            
            # Feels like
            if weather_data.get('apparent_temp_f') is not None and weather_data.get('apparent_temp_c') is not None:
                context += f"- **Feels Like**: {weather_data['apparent_temp_f']:.0f}°F ({weather_data['apparent_temp_c']:.0f}°C)\n"
            
            # Humidity
            if weather_data.get('humidity') is not None:
                context += f"- **Humidity**: {weather_data['humidity']}%\n"
            
            # Wind
            if weather_data.get('wind_speed_mph') is not None and weather_data.get('wind_direction'):
                context += f"- **Wind**: {weather_data['wind_speed_mph']:.0f} mph {weather_data['wind_direction']}\n"
            
            # Dew point
            if weather_data.get('dew_point_f') is not None:
                context += f"- **Dew Point**: {weather_data['dew_point_f']:.0f}°F\n"
            
            # Condition
            if weather_data.get('condition'):
                context += f"- **Condition**: {weather_data['condition']}\n"
            
            context += "\n"
        
        return context
    
    def _format_pace(self, pace_min_per_km: float) -> str:
        """
        Format pace as MM:SS.
        
        Args:
            pace_min_per_km: Pace in minutes per kilometer
            
        Returns:
            Formatted pace string (e.g., "6:34")
        """
        if pace_min_per_km <= 0:
            return "N/A"
        
        minutes = int(pace_min_per_km)
        seconds = int((pace_min_per_km - minutes) * 60)
        return f"{minutes}:{seconds:02d}"
    
    def _empty_activity(self) -> Dict:
        """Return empty activity structure."""
        return {
            "activity_id": None,
            "name": "Unknown",
            "date": None,
            "type": "running",
            "distance_km": 0,
            "duration_min": 0,
            "avg_pace_min_per_km": 0,
            "avg_speed_kmh": 0,
            "avg_hr": 0,
            "max_hr": 0,
            "calories": 0,
            "avg_cadence": 0,
            "training_effect": 0,
            "laps": []
        }

# Made with Bob
