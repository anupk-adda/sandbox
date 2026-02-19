Data Format from garmin:get_activity
The function returns a JSON object with several main sections:
1. Top-Level Structure
json{
  "activityId": 21639489343,
  "activityUUID": {...},
  "activityName": "Singapore Running",
  "userProfileId": 8222440,
  "isMultiSportParent": false,
  "activityTypeDTO": {...},
  "eventTypeDTO": {...},
  "accessControlRuleDTO": {...},
  "timeZoneUnitDTO": {...},
  "metadataDTO": {...},
  "summaryDTO": {...},
  "locationName": "Singapore",
  "splitSummaries": [...]
}
2. Detailed Breakdown
A. Activity Identification
json{
  "activityId": 21639489343,  // Unique ID for this activity
  "activityUUID": {
    "uuid": "06105956-002a-467c-b96b-39d4ed642ece"
  },
  "activityName": "Singapore Running",  // User-defined or auto-generated name
  "userProfileId": 8222440
}
B. Activity Type Information
json{
  "activityTypeDTO": {
    "typeId": 1,
    "typeKey": "running",  // Type: running, cycling, swimming, etc.
    "parentTypeId": 17,
    "isHidden": false,
    "restricted": false,
    "trimmable": true
  },
  "eventTypeDTO": {
    "typeId": 9,
    "typeKey": "uncategorized",  // Can be: race, workout, uncategorized, etc.
    "sortOrder": 10
  }
}
C. Privacy & Access
json{
  "accessControlRuleDTO": {
    "typeId": 2,
    "typeKey": "private"  // private, followers, public
  }
}
D. Timezone Information
json{
  "timeZoneUnitDTO": {
    "unitId": 135,
    "unitKey": "Asia/Hong_Kong",
    "factor": 0.0,
    "timeZone": "Asia/Hong_Kong"
  }
}
E. Metadata (File & Device Info)
json{
  "metadataDTO": {
    "isOriginal": true,
    "deviceApplicationInstallationId": 1004841,
    "agentApplicationInstallationId": null,
    "agentString": null,
    "fileFormat": {
      "formatId": 7,
      "formatKey": "fit"  // FIT, GPX, TCX, etc.
    },
    "associatedCourseId": null,
    "lastUpdateDate": "2026-01-23T14:01:05.0",
    "uploadedDate": "2026-01-23T13:17:42.0",
    "videoUrl": null,
    
    // Data availability flags
    "hasPolyline": true,          // GPS track available
    "hasChartData": true,         // Detailed time-series data
    "hasHrTimeInZones": true,     // Heart rate zone data
    "hasPowerTimeInZones": true,  // Power zone data
    
    "userInfoDto": {
      "userProfilePk": 8222440,
      "displayname": "anupk",
      "fullname": "anupk",
      "profileImageUrlLarge": "https://...",
      "profileImageUrlMedium": "https://...",
      "profileImageUrlSmall": "https://...",
      "userPro": false
    },
    
    "childIds": [],  // For multi-sport activities
    "childActivityTypes": [],
    "sensors": null,
    "activityImages": [],
    
    "manufacturer": "GARMIN",
    "diveNumber": null,
    "lapCount": 6,
    "associatedWorkoutId": null,
    "isAtpActivity": null,
    
    "deviceMetaDataDTO": {
      "deviceId": "3420437522",
      "deviceTypePk": 37016,
      "deviceVersionPk": 1004841
    },
    
    "hasIntensityIntervals": false,
    "hasSplits": true,
    
    // E-bike specific (null for running)
    "eBikeMaxAssistModes": null,
    "eBikeBatteryUsage": null,
    "eBikeBatteryRemaining": null,
    "eBikeAssistModeInfoDTOList": null,
    
    "hasRunPowerWindData": true,
    "calendarEventInfo": null,
    "groupRideUUID": null,
    "hasHeatMap": false,
    "personalRecord": false,
    "gcj02": false,
    "runPowerWindDataEnabled": true,
    "elevationCorrected": false,
    "manualActivity": false,
    "trimmed": false,
    "autoCalcCalories": false,
    "favorite": true
  }
}
F. Summary Data (The Most Important Section!)
json{
  "summaryDTO": {
    // Time & Location
    "startTimeLocal": "2026-01-23T20:39:22.0",
    "startTimeGMT": "2026-01-23T12:39:22.0",
    "startLatitude": 1.3441269379109144,
    "startLongitude": 103.9575408026576,
    "endLatitude": 1.3431012444198132,
    "endLongitude": 103.95514366216958,
    
    // Distance & Duration (in meters and seconds)
    "distance": 5050.85,              // meters
    "duration": 1867.262,             // seconds (total elapsed)
    "movingDuration": 1859.813,       // seconds (active movement)
    "elapsedDuration": 1867.262,      // seconds (total time)
    
    // Elevation
    "elevationGain": 0.0,             // meters
    "elevationLoss": 3.0,             // meters
    "maxElevation": 22.6,             // meters
    "minElevation": 17.8,             // meters
    
    // Speed (in meters/second)
    "averageSpeed": 2.7049999237060542,      // m/s
    "averageMovingSpeed": 2.715783860786994, // m/s
    "maxSpeed": 3.619999885559082,           // m/s
    
    // Calories
    "calories": 384.0,                // total calories
    "bmrCalories": 41.0,              // basal metabolic rate calories
    
    // Heart Rate (bpm)
    "averageHR": 161.0,
    "maxHR": 178.0,
    "minHR": 80.0,
    
    // Running Dynamics
    "averageRunCadence": 163.421875,  // steps per minute
    "maxRunCadence": 178.0,
    "groundContactTime": 277.3999938964844,  // milliseconds
    "strideLength": 100.07999877929689,      // centimeters
    "verticalOscillation": 9.10999984741211, // centimeters
    "verticalRatio": 9.15999984741211,       // percentage
    
    // Power Metrics (watts)
    "averagePower": 280.0,
    "maxPower": 377.0,
    "minPower": 0.0,
    "normalizedPower": 288.0,
    "totalWork": 124.82040658517144,  // kilojoules
    
    // Training Effect
    "trainingEffect": 3.799999952316284,           // Aerobic TE
    "anaerobicTrainingEffect": 1.100000023841858,  // Anaerobic TE
    "aerobicTrainingEffectMessage": "IMPROVING_VO2_MAX_15",
    "anaerobicTrainingEffectMessage": "MINOR_ANAEROBIC_BENEFIT_15",
    "trainingEffectLabel": "VO2MAX",
    "activityTrainingLoad": 144.08631896972656,
    
    // Additional Metrics
    "maxVerticalSpeed": 0.40000152587890625,
    "waterEstimated": 518.0,                    // ml
    "minActivityLapDuration": 19.726,
    "moderateIntensityMinutes": 1,
    "vigorousIntensityMinutes": 29,
    "steps": 5084,
    
    // Stamina & Body Battery
    "beginPotentialStamina": 100.0,
    "endPotentialStamina": 72.0,
    "minAvailableStamina": 71.0,
    "differenceBodyBattery": -7,
    
    // Other
    "avgGradeAdjustedSpeed": 2.756999969482422
  }
}
G. Split Summaries
json{
  "splitSummaries": [
    {
      // Active running split
      "distance": 5050.85,
      "duration": 1867.262,
      "movingDuration": 1860.0,
      "elevationGain": 0.0,
      "elevationLoss": 3.0,
      "averageSpeed": 2.7049999237060542,
      "averageMovingSpeed": 2.715510805191532,
      "maxSpeed": 3.619999885559082,
      "calories": 384.0,
      "bmrCalories": 41.0,
      "averageHR": 161.0,
      "maxHR": 178.0,
      "averageRunCadence": 163.40625,
      "maxRunCadence": 178.0,
      "averagePower": 280.0,
      "maxPower": 377.0,
      "normalizedPower": 288.0,
      "groundContactTime": 277.3999938964844,
      "strideLength": 100.07999877929689,
      "verticalOscillation": 9.10999984741211,
      "verticalRatio": 9.15999984741211,
      "totalExerciseReps": 0,
      "avgVerticalSpeed": 0.0,
      "avgGradeAdjustedSpeed": 2.4590001106262207,
      "splitType": "INTERVAL_ACTIVE",  // Type of split
      "noOfSplits": 1,
      "maxElevationGain": 0.0,
      "averageElevationGain": 0.0,
      "maxDistance": 5050,
      "maxDistanceWithPrecision": 5050.85,
      "avgStepFrequency": 163.40625,
      "avgStepLength": 1000.7999877929688
    },
    {
      // Standing/rest split (if any)
      "distance": 0.0,
      "duration": 7.001,
      "movingDuration": 0.0,
      "splitType": "RWD_STAND",  // Rest/standing
      // ... rest of metrics
    },
    {
      // Overall run split
      "splitType": "RWD_RUN",  // Running
      // ... metrics
    }
  ]
}

Data Type Reference
Here's what each field type actually is:
Numeric Fields

Integers: IDs, counts (activityId, lapCount, steps)
Floats: Most measurements (distance, speed, heart rate)
Timestamps: ISO 8601 format strings ("2026-01-23T20:39:22.0")

Common Units
python{
    "distance": "meters",
    "duration": "seconds", 
    "speed": "meters/second",
    "elevation": "meters",
    "heart_rate": "bpm",
    "cadence": "steps/minute",
    "power": "watts",
    "ground_contact_time": "milliseconds",
    "stride_length": "centimeters",
    "vertical_oscillation": "centimeters",
    "vertical_ratio": "percentage",
    "calories": "kilocalories",
    "water": "milliliters",
    "work": "kilojoules"
}
Enums/Keys
python{
    "activityType": ["running", "cycling", "swimming", "hiking", ...],
    "eventType": ["race", "workout", "uncategorized", ...],
    "accessControl": ["private", "followers", "public"],
    "splitType": ["INTERVAL_ACTIVE", "RWD_STAND", "RWD_RUN", ...]
}

How to Parse This Data
Here's a practical example:
pythonimport json

def parse_garmin_activity(activity_data):
    """Parse Garmin activity data into useful metrics"""
    
    # Basic info
    activity_id = activity_data["activityId"]
    activity_name = activity_data["activityName"]
    activity_type = activity_data["activityTypeDTO"]["typeKey"]
    
    # Summary metrics
    summary = activity_data["summaryDTO"]
    
    # Convert to human-readable units
    distance_km = summary["distance"] / 1000
    duration_min = summary["duration"] / 60
    pace_min_per_km = (summary["duration"] / 60) / distance_km
    
    # Heart rate
    avg_hr = summary["averageHR"]
    max_hr = summary["maxHR"]
    
    # Training effect
    aerobic_te = summary["trainingEffect"]
    anaerobic_te = summary["anaerobicTrainingEffect"]
    
    # Running dynamics (if available)
    cadence = summary.get("averageRunCadence", None)
    stride_length_cm = summary.get("strideLength", None)
    vertical_osc_cm = summary.get("verticalOscillation", None)
    
    return {
        "id": activity_id,
        "name": activity_name,
        "type": activity_type,
        "distance_km": round(distance_km, 2),
        "duration_min": round(duration_min, 2),
        "pace_min_km": f"{int(pace_min_per_km)}:{int((pace_min_per_km % 1) * 60):02d}",
        "avg_hr": avg_hr,
        "max_hr": max_hr,
        "aerobic_te": aerobic_te,
        "anaerobic_te": anaerobic_te,
        "cadence": cadence,
        "stride_length_cm": stride_length_cm,
        "vertical_oscillation_cm": vertical_osc_cm
    }

# Usage
parsed = parse_garmin_activity(activity_data)
print(f"Activity: {parsed['name']}")
print(f"Distance: {parsed['distance_km']} km in {parsed['duration_min']} min")
print(f"Pace: {parsed['pace_min_km']} /km")
print(f"Heart Rate: {parsed['avg_hr']} avg, {parsed['max_hr']} max")

Key Observations

The data is VERY nested - lots of DTOs (Data Transfer Objects)
Metric units are not always intuitive - speeds in m/s, not km/h or min/km
Many nullable fields - check for None before using
Timestamps are strings, not datetime objects - need parsing
Boolean flags indicate data availability - check hasPolyline, hasHrTimeInZones, etc. before requesting more detailed data

The response is essentially the complete activity record from Garmin Connect's database, giving you everything about the activity except the detailed time-series data (which you'd get from other functions like get_activity_splits or GPS track data).
Does this help? Would you like me to show you how to work with other Garmin MCP functions or how to build a data model around this?Claude is AI and can make mistakes. Please double-check responses. Sonnet 4.5