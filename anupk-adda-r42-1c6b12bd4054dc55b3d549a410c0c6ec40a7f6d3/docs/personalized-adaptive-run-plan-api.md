# Personalized Adaptive Run Plan (Assistant-First) - API Interface Proposal

This proposal uses simple JSON endpoints intended for an assistant-first client.

## 1) Plan Lifecycle

### POST /plans
Create a personalized plan.

Request
{
  "goal_distance": "half",
  "goal_date": "2026-05-18",
  "baseline_fitness": {"recent_run": "10k", "time": "55:30"},
  "weekly_availability": ["Mon AM", "Tue PM", "Thu PM", "Sun AM"],
  "experience_level": "intermediate",
  "injury_flags": ["none"]
}

Response
{
  "plan_id": "plan_123",
  "phase": "build",
  "version": 1
}

### GET /plans/{plan_id}/summary
Return the assistant panel summary card content.

Response
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
  ],
  "actions": ["show_full_plan", "edit_goal", "reschedule"]
}

## 2) Weekly Detail

### GET /plans/{plan_id}/weeks/{week_start}
Return a 7-day list view for the week.

Response
{
  "week_start": "2026-02-09",
  "days": [
    {"date": "2026-02-09", "name": "Rest", "intensity": "rest", "why": "absorb load"},
    {"date": "2026-02-10", "name": "40 min easy", "intensity": "easy", "why": "aerobic base"},
    {"date": "2026-02-11", "name": "30 min recovery", "intensity": "easy", "why": "fatigue reset"},
    {"date": "2026-02-12", "name": "Tempo 3 x 8", "intensity": "hard", "why": "lactate control"},
    {"date": "2026-02-13", "name": "Rest", "intensity": "rest", "why": "recover"},
    {"date": "2026-02-14", "name": "35 min easy + strides", "intensity": "easy", "why": "form"},
    {"date": "2026-02-15", "name": "Long run 75 min", "intensity": "moderate", "why": "endurance"}
  ]
}

## 3) Workout Detail

### GET /workouts/{workout_id}
Return structured workout prescription.

Response
{
  "workout_id": "wk_987",
  "name": "Tempo 3 x 8 min",
  "target": {"rpe": "6-7", "hr_zone": "3-4"},
  "warmup": "10 min easy + 4 x 20s strides",
  "main": "3 x 8 min tempo, 2 min easy jog recoveries",
  "cooldown": "10 min easy",
  "coach_cues": [
    "Keep effort steady, do not surge",
    "Relax shoulders, short quick steps",
    "Finish feeling in control"
  ]
}

## 4) Execution Tracking

### POST /workouts/{workout_id}/execution
Log workout completion and feedback.

Request
{
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
  }
}

Response
{
  "execution_id": "exe_456",
  "adherence_score": 72,
  "coach_takeaway": "Solid effort. We will keep Thursday aerobic to recover."
}

## 5) Plan Adaptation

### POST /plans/{plan_id}/adapt
Trigger adaptation based on recent executions.

Request
{
  "window_days": 7,
  "reason": "post_execution"
}

Response
{
  "updated": true,
  "coach_update": "Adjusted Thursday to easy running due to HR drift and high RPE.",
  "change_log_id": "chg_101"
}

## 6) Rescheduling

### POST /plans/{plan_id}/reschedule
Move workouts via conversation.

Request
{
  "workout_id": "wk_987",
  "new_date": "2026-02-13"
}

Response
{
  "updated": true,
  "coach_update": "Moved tempo to Friday. Sunday long run unchanged.",
  "tradeoff_note": "One day less recovery before long run."
}

## 7) Subscription Prompt

### GET /users/{user_id}/prompts
Return any assistant panel prompts.

Response
{
  "prompts": [
    {
      "id": "prompt_track_training",
      "label": "Track my training",
      "action": "open_tracking_flow",
      "visible": true,
      "priority": 1
    }
  ]
}

## 8) Errors (minimal)

- 400 invalid_input
- 404 not_found
- 409 plan_conflict
- 429 rate_limited
- 500 internal_error
