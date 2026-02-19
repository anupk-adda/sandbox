"""
Weather Agent - Running Conditions
Fetches weather data from Open-Meteo and evaluates running conditions.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional
import json
import urllib.parse
import urllib.request
import asyncio


@dataclass
class HourCondition:
    time: str
    score: int
    label: str


class WeatherAgent:
    def __init__(self) -> None:
        self.base_url = "https://api.open-meteo.com/v1/forecast"

    async def get_running_conditions(self, latitude: float, longitude: float) -> Dict[str, Any]:
        data = await asyncio.to_thread(self._fetch_weather, latitude, longitude)
        if not data:
            return {
                "agent": "WeatherAgent",
                "analysis": "Unable to fetch weather data right now.",
                "weather": {
                    "summary": "Weather data is currently unavailable.",
                    "hours": [],
                    "attribution": "Weather data by Open-Meteo.com"
                }
            }

        hourly = data.get("hourly", {})
        current = data.get("current", {})
        timezone = data.get("timezone")
        current_time = current.get("time")

        times = hourly.get("time", [])
        temps = hourly.get("temperature_2m", [])
        humidity = hourly.get("relative_humidity_2m", [])
        precip_prob = hourly.get("precipitation_probability", [])
        precip = hourly.get("precipitation", [])
        wind = hourly.get("wind_speed_10m", [])
        uv = hourly.get("uv_index", [])
        dew_point = hourly.get("dew_point_2m", [])

        start_index = 0
        if current_time and current_time in times:
            start_index = times.index(current_time)

        hours = []
        start_index = self._resolve_start_index(times, current_time)

        for idx in range(start_index, min(start_index + 12, len(times))):
            temp_val = temps[idx] if idx < len(temps) else None
            humidity_val = humidity[idx] if idx < len(humidity) else None
            precip_prob_val = precip_prob[idx] if idx < len(precip_prob) else None
            precip_val = precip[idx] if idx < len(precip) else None
            wind_val = wind[idx] if idx < len(wind) else None
            uv_val = uv[idx] if idx < len(uv) else None
            dew_val = dew_point[idx] if idx < len(dew_point) else None

            score, label, reason = self._score_hour(
                temp=temp_val,
                humidity=humidity_val,
                precip_prob=precip_prob_val,
                precip=precip_val,
                wind=wind_val,
                uv=uv_val,
                dew_point=dew_val,
            )
            hour_label = self._format_time(times[idx]) if idx < len(times) else ""
            hours.append({
                "time": hour_label,
                "score": score,
                "label": label,
                "details": {
                    "temperature": temp_val,
                    "humidity": humidity_val,
                    "dew_point": dew_val,
                    "wind_speed": wind_val,
                    "precip_prob": precip_prob_val,
                    "precipitation": precip_val
                },
                "reason": reason
            })

        avg_score = int(sum(h["score"] for h in hours) / len(hours)) if hours else 0
        summary, recommendation = self._summary_for_score(avg_score)

        location_label = await asyncio.to_thread(self._reverse_geocode, latitude, longitude)

        dew_now = None
        if current_time and current_time in times:
            idx_now = times.index(current_time)
            if idx_now < len(dew_point):
                dew_now = dew_point[idx_now]

        detail_parts = []
        if dew_now is not None:
            detail_parts.append(f"Dew point {int(dew_now)}°C")
        if current.get("apparent_temperature") is not None:
            detail_parts.append(f"Feels like {int(current.get('apparent_temperature'))}°C")
        detail = " · ".join(detail_parts) if detail_parts else None

        weather_payload = {
            "location_label": location_label or "Singapore (approx.)",
            "timezone": timezone,
            "current_time": self._format_time(current_time) if current_time else None,
            "current": {
                "temperature": current.get("temperature_2m"),
                "apparent_temperature": current.get("apparent_temperature"),
                "humidity": current.get("relative_humidity_2m"),
                "precipitation": current.get("precipitation"),
                "wind_speed": current.get("wind_speed_10m"),
                "weather_code": current.get("weather_code"),
            },
            "detail": detail,
            "rating_now": self._label_score(avg_score),
            "hours": hours,
            "summary": summary,
            "recommendation": recommendation,
            "attribution": "Weather data by Open-Meteo.com",
            "needs_location_confirm": False
        }

        return {
            "agent": "WeatherAgent",
            "analysis": f"{summary} {recommendation}".strip(),
            "weather": weather_payload
        }

    def _fetch_weather(self, latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": ",".join([
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation",
                "weather_code",
                "wind_speed_10m"
            ]),
            "hourly": ",".join([
                "temperature_2m",
                "relative_humidity_2m",
                "dew_point_2m",
                "apparent_temperature",
                "precipitation_probability",
                "precipitation",
                "wind_speed_10m",
                "uv_index"
            ]),
            "forecast_days": 2,
            "timezone": "auto"
        }
        url = f"{self.base_url}?{urllib.parse.urlencode(params)}"
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw)
        except Exception:
            return None

    def _score_hour(
        self,
        temp: Optional[float],
        humidity: Optional[float],
        precip_prob: Optional[float],
        precip: Optional[float],
        wind: Optional[float],
        uv: Optional[float],
        dew_point: Optional[float],
    ) -> tuple[int, str, str]:
        label = "Good"
        score = 85
        reasons = []

        if precip_prob is not None:
            if precip_prob >= 60:
                score -= 40
                label = "Poor"
                reasons.append(f"high rain chance ({int(precip_prob)}%)")
            elif precip_prob >= 30:
                score -= 20
                if label != "Poor":
                    label = "Fair"
                reasons.append(f"rain chance ({int(precip_prob)}%)")

        if precip is not None and precip >= 0.5:
            score -= 20
            label = "Poor"
            reasons.append(f"rain {precip:.1f}mm")

        if wind is not None:
            if wind >= 25:
                score -= 20
                label = "Poor"
                reasons.append(f"wind {int(wind)} km/h")
            elif wind >= 15:
                score -= 10
                if label == "Good":
                    label = "Fair"
                reasons.append(f"breezy {int(wind)} km/h")

        if temp is not None:
            if temp > 30:
                score -= 25
                label = "Poor"
                reasons.append(f"hot {int(temp)}°C")
            elif temp >= 25:
                score -= 15
                if label == "Good":
                    label = "Fair"
                reasons.append(f"warm {int(temp)}°C")
            elif 7 <= temp <= 15:
                score += 5
                reasons.append(f"cool {int(temp)}°C")
            elif temp <= 5:
                score -= 15
                if label == "Good":
                    label = "Fair"
                reasons.append(f"cold {int(temp)}°C")

        if humidity is not None and humidity >= 85:
            score -= 15
            label = "Poor"
            reasons.append(f"humid {int(humidity)}%")
        elif humidity is not None and humidity >= 75:
            score -= 8
            if label == "Good":
                label = "Fair"
            reasons.append(f"humid {int(humidity)}%")

        if uv is not None and uv >= 7:
            score -= 10
            if label == "Good":
                label = "Fair"
            reasons.append(f"UV {uv:.0f}")

        if dew_point is not None:
            if dew_point > 24:
                score -= 25
                label = "Poor"
                reasons.append(f"dew {int(dew_point)}°C")
            elif dew_point > 20:
                score -= 15
                if label == "Good":
                    label = "Fair"
                reasons.append(f"dew {int(dew_point)}°C")
            elif dew_point < 10:
                score += 5
                reasons.append(f"dew {int(dew_point)}°C")

        score = max(0, min(100, int(score)))
        reason = " / ".join(reasons[:3]) if reasons else "comfortable"
        return score, label, reason

    def _label_score(self, score: int) -> str:
        if score >= 70:
            return "Good"
        if score >= 40:
            return "Fair"
        return "Poor"

    def _summary_for_score(self, score: int) -> tuple[str, str]:
        if score >= 70:
            return (
                "Good weather for running is expected for the next few hours.",
                "It’s a great window for an easy or steady run."
            )
        if score >= 40:
            return (
                "Mixed running conditions expected over the next few hours.",
                "Consider a shorter run or adjust pace based on comfort."
            )
        return (
            "Poor weather for running is expected for the next few hours.",
            "Consider indoor training or keep it very short and easy."
        )

    def _format_time(self, iso_time: str) -> str:
        try:
            dt = datetime.fromisoformat(iso_time)
            return dt.strftime("%-I%p").lower()
        except Exception:
            return iso_time[-5:]

    def _resolve_start_index(self, times: List[str], current_time: Optional[str]) -> int:
        if not times:
            return 0
        if current_time and current_time in times:
            return times.index(current_time)
        if current_time:
            try:
                current_dt = datetime.fromisoformat(current_time)
                for idx, t in enumerate(times):
                    try:
                        if datetime.fromisoformat(t) >= current_dt:
                            return idx
                    except Exception:
                        continue
            except Exception:
                pass
        return 0

    def _reverse_geocode(self, latitude: float, longitude: float) -> Optional[str]:
        try:
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "count": 1
            }
            url = f"https://geocoding-api.open-meteo.com/v1/reverse?{urllib.parse.urlencode(params)}"
            with urllib.request.urlopen(url, timeout=8) as response:
                raw = response.read().decode("utf-8")
                data = json.loads(raw)
                results = data.get("results", [])
                if not results:
                    return None
                first = results[0]
                name = first.get("name")
                admin1 = first.get("admin1")
                country_code = first.get("country_code") or first.get("country")
                if name and country_code:
                    return f"{name}, {country_code}"
                if admin1 and country_code:
                    return f"{admin1}, {country_code}"
                return name or admin1 or country_code
        except Exception:
            return None
