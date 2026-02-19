# Personalized Adaptive Run Plan (Assistant-First) - User Stories

## Scope
Assistant-first, minimal UI plan experience for 5K / 10K / Half / Marathon training.

## Personas
- Runner: Wants a plan that adapts to real life without heavy UI.
- Coach (AI): Explains the "why" and adjusts load safely.

## User Stories

### US-01 - Create a personalized plan
As a runner, I want a plan tailored to my goal race and availability so I can start training with confidence.

Acceptance criteria
- The coach asks for goal distance, race date, weekly availability, and baseline fitness.
- The plan summary card shows goal race/date, phase, weekly focus, and next 3 workouts.
- The coach explains the rationale for this week's structure in 1-2 concise lines.

### US-02 - See today's workout fast
As a runner, I want to quickly know what I should do today so I can train without hunting in a calendar.

Acceptance criteria
- Asking "What should I do today?" returns the planned workout with a brief summary.
- The response includes time/distance and effort target.
- If today is a rest day, the coach states that clearly.

### US-03 - Expand to weekly detail on request
As a runner, I want to see the full week when I need context, without a heavy calendar.

Acceptance criteria
- "Show full plan" reveals a 7-day list with workout name, target, intensity, and "why".
- The list stays in a lightweight format (no calendar grid UI).

### US-04 - View structured workout details
As a runner, I want a clear prescription for each workout so I can execute it correctly.

Acceptance criteria
- Selecting a workout reveals warmup, main set, cooldown, and targets.
- 2-3 coach cues are included in bullet form.
- Quick post-run feedback options are shown.

### US-05 - Track execution with minimal friction
As a runner, I want to log completion and provide quick feedback so the coach can adapt my plan.

Acceptance criteria
- Each workout records planned prescription, actual metrics, and adherence status.
- Completion state displays as Completed / Modified / Missed with a short reason if not completed.
- The coach provides a brief takeaway after the run.

### US-06 - Adaptive adjustments with clear "why"
As a runner, I want the plan to adapt based on my performance so it stays realistic and effective.

Acceptance criteria
- Missed workouts are absorbed or replaced, not simply deleted.
- Over- or under-performance triggers small, incremental changes.
- A "Coach Update" message explains the change and reason in 1-2 lines.

### US-07 - Reschedule by conversation
As a runner, I want to move workouts via chat so I can keep the plan aligned to my life.

Acceptance criteria
- "Move my long run" triggers a reschedule flow in chat.
- The plan updates without regenerating the entire schedule.
- The coach explains any tradeoffs from the change.

### US-08 - Subscribed prompt to prioritize tracking
As a subscribed runner, I want a top-of-chat prompt to "Track my training" so I can prioritize ongoing logging.

Acceptance criteria
- If the user is subscribed to the plan, a persistent prompt appears at the top of chat.
- The prompt label is "Track my training" and opens the tracking flow.
- The prompt is shown before other plan cards in the assistant panel.

## Non-Goals (v1)
- Full calendar UI or drag-and-drop plan management.
- Multi-sport plans.
- Social or sharing features.
