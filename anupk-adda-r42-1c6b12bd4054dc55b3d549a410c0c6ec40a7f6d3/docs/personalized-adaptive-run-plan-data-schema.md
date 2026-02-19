# Personalized Adaptive Run Plan (Assistant-First) - Data Schema Draft

This is a conceptual schema for the assistant-first run plan. It is implementation-agnostic and intended for v1.

## 1) Core Entities

### 1.1 UserProfile
- id
- name
- experience_level (beginner | intermediate | advanced)
- injury_flags (array of strings)
- weekly_availability (array of day/time blocks)
- preferences (workout types, etc)
- subscription
  - status (active | inactive)
  - plan_entitled (bool)

### 1.2 Plan
- id
- user_id
- goal_distance (5k | 10k | half | marathon)
- goal_date (date)
- phase (base | build | peak | taper)
- version (int)
- start_date (date)
- created_at, updated_at
- personalization_inputs
  - baseline_fitness (numeric or recent_runs)
  - availability (from UserProfile)
  - experience_level
  - injury_flags

### 1.3 WeekPlan
- id
- plan_id
- week_start_date
- target_volume
- target_intensity_mix
- focus_summary

### 1.4 WorkoutPlan
- id
- plan_id
- week_id
- scheduled_date
- type (easy | tempo | interval | long | recovery | rest)
- structure
  - warmup
  - main
  - cooldown
- targets
  - duration_minutes or distance_km
  - pace_range
  - hr_zone
  - rpe
- rationale (short "why")
- coach_cues (array of strings)

### 1.5 Execution
- id
- workout_id
- performed_at
- completion_status (completed | modified | missed)
- actual_metrics
  - duration_minutes
  - distance_km
  - avg_pace
  - hr_avg
  - hr_drift
  - cadence
- feedback
  - rpe
  - soreness
  - fatigue
  - notes
- adherence_score (0-100)

### 1.6 AdaptationLog
- id
- plan_id
- created_at
- change_summary
- reason
- impacted_workouts (array of workout ids)
- delta
  - volume_change
  - intensity_change

## 2) Relationships

- UserProfile 1..1 -> Plan 0..N
- Plan 1..1 -> WeekPlan 1..N
- WeekPlan 1..1 -> WorkoutPlan 1..N
- WorkoutPlan 1..1 -> Execution 0..1
- Plan 1..1 -> AdaptationLog 0..N

## 3) Example Payloads (JSON)

### 3.1 Plan Summary
{
  "plan_id": "plan_123",
  "goal_distance": "half",
  "goal_date": "2026-05-18",
  "phase": "build",
  "weekly_focus": "Aerobic efficiency + pacing control",
  "next_workouts": [
    {"date": "2026-02-10", "name": "40 min easy", "effort": "RPE 3-4"},
    {"date": "2026-02-12", "name": "Tempo 3 x 8 min", "effort": "RPE 6-7"},
    {"date": "2026-02-15", "name": "Long run 75 min", "effort": "RPE 4-5"}
  ]
}

### 3.2 Execution Record
{
  "workout_id": "wk_987",
  "completion_status": "modified",
  "actual_metrics": {
    "duration_minutes": 35,
    "distance_km": 6.2,
    "avg_pace": "5:40",
    "hr_avg": 158,
    "hr_drift": 8,
    "cadence": 168
  },
  "feedback": {
    "rpe": 8,
    "soreness": 4,
    "fatigue": 3,
    "notes": "Felt heavy in last 10 minutes"
  },
  "adherence_score": 72
}

## 4) Subscription Prompt Logic

- If UserProfile.subscription.status == "active" and plan_entitled == true
  then show top-of-chat prompt "Track my training".
- Otherwise, do not show the prompt.
