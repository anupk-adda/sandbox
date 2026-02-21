"""
Phase 1 Defensive Tests for Normalizer and Chart Builder

Tests edge cases for missing/partial Garmin data:
1. Activity with missing summaryDTO
2. Activity with empty splits
3. Activity with zero distance/duration
4. Activity with non-numeric lap metrics
5. Activity with all None values
"""

import pytest
from src.data.normalizer import GarminDataNormalizer
from src.utils.chart_builder import build_single_run_detail_charts, build_run_metric_charts


class TestNormalizerDefensive:
    """Test normalizer defensive handling"""
    
    def setup_method(self):
        self.normalizer = GarminDataNormalizer()
    
    def test_missing_summary_dto(self):
        """Test activity with missing summaryDTO"""
        raw_data = {
            "activityId": 12345,
            "activityName": "Test Run",
            "startTimeGMT": "2024-01-01T10:00:00Z",
            "activityTypeDTO": {"typeKey": "running"},
            # summaryDTO is missing
            "lapDTOs": [
                {"distance": 1000, "duration": 300, "averageHR": 150}
            ]
        }
        
        result = self.normalizer.normalize_activity(raw_data)
        
        assert result["activity_id"] == 12345
        assert result["distance_km"] == 1.0  # Should extract from splits
        assert result["duration_min"] == 5.0
        assert result["data_quality"]["has_summary"] is False
        assert result["data_quality"]["has_splits"] is True
        assert result["data_quality"]["metrics_source"] == "splits"
    
    def test_empty_splits(self):
        """Test activity with empty splits"""
        raw_data = {
            "activityId": 12346,
            "activityName": "Test Run",
            "startTimeGMT": "2024-01-01T10:00:00Z",
            "activityTypeDTO": {"typeKey": "running"},
            "summaryDTO": {
                "distance": 5000,
                "duration": 1500,
                "averageHR": 145
            },
            "lapDTOs": []  # Empty splits
        }
        
        result = self.normalizer.normalize_activity(raw_data)
        
        assert result["activity_id"] == 12346
        assert result["distance_km"] == 5.0
        assert result["duration_min"] == 25.0
        assert result["laps"] == []
        assert result["data_quality"]["has_summary"] is True
        assert result["data_quality"]["has_splits"] is False
    
    def test_zero_distance_duration(self):
        """Test activity with zero distance and duration"""
        raw_data = {
            "activityId": 12347,
            "activityName": "Test Run",
            "startTimeGMT": "2024-01-01T10:00:00Z",
            "activityTypeDTO": {"typeKey": "running"},
            "summaryDTO": {
                "distance": 0,
                "duration": 0,
                "averageHR": 0
            },
            "lapDTOs": []
        }
        
        result = self.normalizer.normalize_activity(raw_data)
        
        assert result["activity_id"] == 12347
        assert result["distance_km"] == 0
        assert result["duration_min"] == 0
        assert result["avg_pace_min_per_km"] == 0
        assert result["avg_speed_kmh"] == 0
    
    def test_invalid_lap_metrics(self):
        """Test activity with non-numeric lap metrics"""
        raw_data = {
            "activityId": 12348,
            "activityName": "Test Run",
            "startTimeGMT": "2024-01-01T10:00:00Z",
            "activityTypeDTO": {"typeKey": "running"},
            "summaryDTO": {
                "distance": 5000,
                "duration": 1500
            },
            "lapDTOs": [
                {"distance": "invalid", "duration": 300},  # Invalid distance
                {"distance": 1000, "duration": None},  # None duration
                {"distance": 1000, "duration": 300},  # Valid lap
            ]
        }
        
        result = self.normalizer.normalize_activity(raw_data)
        
        # Should skip invalid laps and only process valid one
        assert len(result["laps"]) == 1
        assert result["laps"][0]["distance_km"] == 1.0
        assert result["laps"][0]["duration_min"] == 5.0
    
    def test_all_none_values(self):
        """Test activity with all None values"""
        raw_data = {
            "activityId": 12349,
            "activityName": None,
            "startTimeGMT": None,
            "activityTypeDTO": None,
            "summaryDTO": None,
            "lapDTOs": None
        }
        
        result = self.normalizer.normalize_activity(raw_data)
        
        assert result["activity_id"] == 12349
        assert result["name"] == "Unnamed Run"
        assert result["type"] == "running"  # Default fallback
        assert result["distance_km"] == 0
        assert result["laps"] == []
    
    def test_string_raw_data(self):
        """Test when raw_data is a JSON string"""
        raw_data_str = '{"activityId": 12350, "activityName": "Test", "summaryDTO": {"distance": 1000}}'
        
        result = self.normalizer.normalize_activity(raw_data_str)
        
        assert result["activity_id"] == 12350
        assert result["name"] == "Test"
    
    def test_raw_text_format(self):
        """Test when MCP returns raw_text format"""
        raw_data = {
            "raw_text": '{"activityId": 12351, "activityName": "Test", "summaryDTO": {"distance": 2000}}'
        }
        
        result = self.normalizer.normalize_activity(raw_data)
        
        assert result["activity_id"] == 12351
        assert result["distance_km"] == 2.0


class TestChartBuilderDefensive:
    """Test chart builder defensive handling"""
    
    def test_zero_avg_pace_no_division_error(self):
        """Test that zero avg_pace doesn't cause division by zero"""
        activity_data = {
            "activity_id": 12345,
            "name": "Test Run",
            "laps": [
                {"km": 1.0, "lap_num": 1, "pace": 0, "hr": 150, "cadence": 180, "power": 0},
                {"km": 2.0, "lap_num": 2, "pace": 0, "hr": 155, "cadence": 182, "power": 0}
            ]
        }
        
        # Should not raise ZeroDivisionError
        charts = build_single_run_detail_charts(activity_data, ["pace"])
        
        # Should return empty or safe charts
        assert isinstance(charts, list)
    
    def test_none_metrics_in_chart_data(self):
        """Test that None metrics are handled safely"""
        activities = [
            {
                "normalized": {
                    "activity": {
                        "date": "2024-01-01T10:00:00Z",
                        "avg_pace_min_per_km": None,
                        "avg_hr": None,
                        "avg_cadence": None,
                        "distance_km": None
                    }
                }
            }
        ]
        
        # Should not raise TypeError
        charts = build_run_metric_charts(activities, max_runs=5)
        
        assert isinstance(charts, list)
    
    def test_empty_activities_list(self):
        """Test empty activities list"""
        charts = build_run_metric_charts([], max_runs=5)
        
        assert charts == []
    
    def test_invalid_activity_structure(self):
        """Test activities with invalid structure"""
        activities = [
            "not a dict",
            {"normalized": "not a dict"},
            {"normalized": {"activity": "not a dict"}},
            None
        ]
        
        # Should handle gracefully
        charts = build_run_metric_charts(activities, max_runs=5)
        
        assert charts == []
    
    def test_mixed_valid_invalid_laps(self):
        """Test activity with mix of valid and invalid laps"""
        activity_data = {
            "activity_id": 12345,
            "name": "Test Run",
            "laps": [
                {"km": 1.0, "lap_num": 1, "pace": 6.0, "hr": 150, "cadence": 180, "power": 200},
                {"km": 2.0, "lap_num": 2, "pace": 0, "hr": 0, "cadence": 0, "power": 0},  # Invalid
                {"km": 3.0, "lap_num": 3, "pace": 6.5, "hr": 155, "cadence": 182, "power": 210}
            ]
        }
        
        charts = build_single_run_detail_charts(activity_data, ["pace", "hr"])
        
        # Should generate charts despite invalid lap
        assert len(charts) > 0


class TestNormalizerHRZones:
    """Test HR zone normalization"""
    
    def setup_method(self):
        self.normalizer = GarminDataNormalizer()
    
    def test_empty_hr_zones(self):
        """Test empty HR zones"""
        result = self.normalizer.normalize_hr_zones([])
        
        assert result["zones"] == []
        assert result["total_time_s"] == 0
        assert result["has_complete_data"] is False
    
    def test_incomplete_hr_zones(self):
        """Test incomplete HR zones (less than 5)"""
        raw_zones = [
            {"zoneNumber": 1, "secsInZone": 300, "zoneLowBoundary": 100}
        ]
        
        result = self.normalizer.normalize_hr_zones(raw_zones)
        
        assert len(result["zones"]) == 1
        assert result["has_complete_data"] is False

    def test_string_hr_zone_entries(self):
        """Test HR zones provided as JSON strings"""
        raw_zones = [
            '{"zoneNumber": 1, "secsInZone": 120, "zoneLowBoundary": 100}',
            '{"zoneNumber": 2, "secsInZone": 180, "zoneLowBoundary": 120}'
        ]

        result = self.normalizer.normalize_hr_zones(raw_zones)

        assert len(result["zones"]) == 2
        assert result["total_time_s"] == 300
    
    def test_complete_hr_zones(self):
        """Test complete HR zones (5 zones)"""
        raw_zones = [
            {"zoneNumber": i, "secsInZone": 300, "zoneLowBoundary": 100 + i * 10}
            for i in range(1, 6)
        ]
        
        result = self.normalizer.normalize_hr_zones(raw_zones)
        
        assert len(result["zones"]) == 5
        assert result["has_complete_data"] is True
        assert result["total_time_s"] == 1500


class TestNormalizerWeather:
    """Test weather normalization"""
    
    def setup_method(self):
        self.normalizer = GarminDataNormalizer()
    
    def test_empty_weather(self):
        """Test empty weather data"""
        result = self.normalizer.normalize_weather({})
        
        assert result["available"] is False
    
    def test_none_weather(self):
        """Test None weather data"""
        result = self.normalizer.normalize_weather(None)
        
        assert result["available"] is False
    
    def test_partial_weather(self):
        """Test partial weather data"""
        raw_weather = {
            "temp": 75,
            "relativeHumidity": 60
            # Missing other fields
        }
        
        result = self.normalizer.normalize_weather(raw_weather)
        
        assert result["available"] is True
        assert result["temp_f"] == 75
        assert result["humidity"] == 60
        assert result["wind_speed_mph"] is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
