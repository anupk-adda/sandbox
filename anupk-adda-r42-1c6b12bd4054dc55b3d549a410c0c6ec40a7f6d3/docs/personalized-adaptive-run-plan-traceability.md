# Personalized Adaptive Run Plan - User Story Traceability

This maps user stories to UI surfaces, schema entities, and API endpoints.

## US-01 Create a personalized plan
- UI: Chat intake flow, Plan Summary Card
- Schema: UserProfile, Plan, WeekPlan, WorkoutPlan
- API: POST /plans, GET /plans/{plan_id}/summary

## US-02 See today's workout fast
- UI: Chat response "What should I do today?", Summary Card next 3 workouts
- Schema: WorkoutPlan (scheduled_date, targets)
- API: GET /plans/{plan_id}/summary, GET /workouts/{workout_id}

## US-03 Expand to weekly detail on request
- UI: Weekly Detail list
- Schema: WeekPlan, WorkoutPlan
- API: GET /plans/{plan_id}/weeks/{week_start}

## US-04 View structured workout details
- UI: Workout Detail Card
- Schema: WorkoutPlan.structure, WorkoutPlan.targets, coach_cues
- API: GET /workouts/{workout_id}

## US-05 Track execution with minimal friction
- UI: After Run buttons, completion state badges
- Schema: Execution, adherence_score
- API: POST /workouts/{workout_id}/execution

## US-06 Adaptive adjustments with clear "why"
- UI: Coach Update message, Change Log link
- Schema: AdaptationLog
- API: POST /plans/{plan_id}/adapt

## US-07 Reschedule by conversation
- UI: Chat reschedule flow
- Schema: WorkoutPlan.scheduled_date, WeekPlan
- API: POST /plans/{plan_id}/reschedule

## US-08 Subscribed prompt to prioritize tracking
- UI: Top-of-chat prompt "Track my training"
- Schema: UserProfile.subscription
- API: GET /users/{user_id}/prompts
