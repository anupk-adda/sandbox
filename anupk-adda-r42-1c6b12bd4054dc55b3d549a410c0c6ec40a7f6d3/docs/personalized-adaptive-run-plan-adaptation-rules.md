# Personalized Adaptive Run Plan - Adaptation Rules (v1)

These rules are intentionally simple, safe, and explainable.

## 1) Inputs
- Execution metrics: pace vs target, HR drift, cadence stability
- Completion status: completed / modified / missed
- Subjective feedback: RPE, soreness, fatigue

## 2) Safety Caps
- Max weekly volume change: +/- 10%
- Max intensity change per week: +/- 1 key workout
- No intensity increases if RPE >= 8 or soreness >= 4
- Always preserve at least 1 rest or recovery day per week

## 3) Rule Set (v1)

### 3.1 Missed workout
- If a key workout is missed:
  - Replace with short aerobic session or move if next 48h is clear
  - Do not stack two hard workouts back-to-back

### 3.2 Over-performance
- Condition: completed workout with RPE <= 6 and HR drift <= 5
- Action: small progression in next similar workout
  - +5-10 min easy volume OR
  - +1 interval repetition (cap at +10%)

### 3.3 Under-performance
- Condition: RPE >= 8 OR HR drift >= 8
- Action: reduce load in next intensity session
  - swap to aerobic / recovery
  - reduce volume by 10-15%

### 3.4 Fatigue detected
- Condition: fatigue >= 4 OR soreness >= 4
- Action:
  - swap intensity day to easy
  - add extra rest day if 2 consecutive fatigue signals

### 3.5 Modified workout
- If modified but completed >= 70% volume:
  - keep plan progression steady
- If completed < 70% volume:
  - treat as under-performance

## 4) Coach Update Message Template

"Adjusted {day/workout} to {new intensity} because {reason}."

Examples
- "Adjusted Thursday run to easy because HR drift was high and RPE was 8."
- "Added 8 minutes to Sunday long run because you completed the last two long runs comfortably."

## 5) Change Log Fields
- change_summary
- reason
- impacted_workouts
- volume_change
- intensity_change
