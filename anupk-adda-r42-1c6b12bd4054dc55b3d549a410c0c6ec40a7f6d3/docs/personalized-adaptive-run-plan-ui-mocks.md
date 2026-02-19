# Personalized Adaptive Run Plan (Assistant-First) - Minimal UI Mocks

These are lightweight, assistant-first UI mocks using text wireframes. The goal is to show intent and layout without heavy UI.

## 1) Core Surfaces

### 1.1 Chat + Plan Summary Card (default)

[Top Prompt - subscribed only]
+--------------------------------------------------------------+
| Track my training  >                                         |
+--------------------------------------------------------------+

[Assistant Chat]
Coach: Here's your plan for this week.

[Plan Summary Card]
+--------------------------------------------------------------+
| Goal: Half Marathon - May 18, 2026                           |
| Phase: Build                                                 |
| Weekly Focus: Aerobic efficiency + pacing control            |
| Next 3 Workouts:                                             |
| - Tue: 40 min easy (RPE 3-4)                                 |
| - Thu: Tempo 3 x 8 min (RPE 6-7)                              |
| - Sun: Long run 75 min (RPE 4-5)                              |
| Actions: [Show full plan] [Edit goal] [Reschedule]            |
+--------------------------------------------------------------+

Notes
- The top prompt appears only for subscribed users.
- The summary card is inline in the assistant panel and short.

### 1.2 Weekly Detail (expand on request)

[User]: Show full plan

[Weekly Detail - list format]
+--------------------------------------------------------------+
| This Week (Feb 9 - Feb 15)                                   |
| Mon: Rest / Mobility (why: absorb load)                      |
| Tue: 40 min easy (why: aerobic base)                         |
| Wed: 30 min recovery (why: fatigue reset)                    |
| Thu: Tempo 3 x 8 min (why: lactate control)                  |
| Fri: Rest                                                    |
| Sat: 35 min easy + strides (why: form)                       |
| Sun: Long run 75 min (why: endurance)                        |
+--------------------------------------------------------------+

### 1.3 Workout Detail (tap a workout)

[User]: Open Thursday workout

[Workout Detail Card]
+--------------------------------------------------------------+
| Tempo 3 x 8 min                                              |
| Target: RPE 6-7 or HR Zone 3-4                               |
| Warmup: 10 min easy + 4 x 20s strides                        |
| Main: 3 x 8 min tempo, 2 min easy jog recoveries             |
| Cooldown: 10 min easy                                        |
| Coach Cues:                                                  |
| - Keep effort steady, do not surge                           |
| - Relax shoulders, short quick steps                         |
| - Finish feeling in control                                  |
| After Run: [Completed] [Modified] [Missed]                   |
+--------------------------------------------------------------+

### 1.4 Coach Update (plan adapts)

[Coach Update Message]
Coach Update: Adjusted Thursday to easy running because HR drift
was high and your RPE was 8 on Tuesday.

[Small Change Log link]
+-----------------------------+
| View change log >           |
+-----------------------------+

## 2) Prompt and State Rules

### 2.1 Subscribed prompt
- Condition: active plan subscription
- Placement: top of chat, above plan summary card
- Label: "Track my training"
- Action: opens tracking flow (log run / update status)

### 2.2 Non-subscribed prompt
- No prompt is shown
- The plan summary card remains the top item when plan exists

## 3) Conversation Flow (v1)

1) User asks for a plan
2) Coach collects required inputs
3) Coach posts summary card
4) User taps workout, logs completion
5) Coach adapts and posts a coach update

## 4) Minimal Controls

- Show full plan
- Edit goal
- Reschedule
- Track my training (subscribed only)

## 5) Accessibility Notes

- All controls are text buttons with clear verbs
- Plan card uses short lines with minimal wrapping
- No reliance on color for state
