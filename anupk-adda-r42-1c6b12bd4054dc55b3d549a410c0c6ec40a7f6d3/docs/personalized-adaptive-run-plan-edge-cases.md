# Personalized Adaptive Run Plan - Edge Cases & Error Flows

## 1) Edge Cases

### 1.1 Missing goal date
- Coach asks for date and suggests a default race window based on distance.
- Plan creation blocked until goal date provided.

### 1.2 No recent runs / baseline unknown
- Coach starts with a conservative base week.
- After first 2 runs, fitness estimate is updated.

### 1.3 Limited availability (<= 2 days)
- Coach offers a maintenance plan or suggests extending timeline.

### 1.4 Consecutive missed workouts
- Coach reduces intensity for the next 7 days.
- Coach checks for injury or time constraints.

### 1.5 Injury flag enabled
- Coach asks for medical clearance and proposes low-impact alternatives.
- Intensity workouts disabled until cleared.

### 1.6 Travel week
- Coach switches to time-based workouts with flexible day ordering.

## 2) Error Flows

### 2.1 Plan conflict
- Scenario: user already has an active plan
- Response: ask to replace or pause existing plan

### 2.2 Reschedule conflicts
- Scenario: moving workout causes back-to-back intensity
- Response: coach proposes an alternative date

### 2.3 Missing execution data
- Scenario: tracking prompt opens but no activity data
- Response: offer manual logging

### 2.4 Subscription inactive
- Scenario: user tries "Track my training"
- Response: show plan summary and upsell subscription

## 3) Copy Guidelines

- Keep explanations under 2 lines
- Always include a short reason for changes
- Avoid medical advice, recommend consulting a professional
