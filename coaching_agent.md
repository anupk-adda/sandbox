


## Instruction to Lead Developer: Modify Coaching Agent Behavior (Holistic Synthesis Mode)

We need to change the **behavioral architecture** of the Coaching Agent.

This is not a formatting tweak.
This is a reasoning-model change.

---

## 1️⃣ Problem With Current Agent

Current behavior:

* Iterates through metrics sequentially.
* Generates commentary per signal (pace, HR, cadence, weather).
* Produces repetition and verbose summaries.
* Feels like telemetry narration, not coaching intelligence.

This must stop.

---

## 2️⃣ Target Behavior: Holistic Synthesis Engine

The agent must:

* Ingest all run signals simultaneously.
* Derive a single integrated performance diagnosis.
* Identify one primary limiter.
* Recommend one highest-impact lever.
* Provide one execution cue for the next session.

No per-metric commentary.

The mental model should be:

> Multi-signal interpretation → performance classification → prescriptive action

Not:

> metric → comment → metric → comment

---

## 3️⃣ Required Architectural Changes

### A. Reasoning Layer

Before generation, force the agent to:

* Evaluate:

  * Pace trend vs HR trend
  * HR vs environmental load
  * Cadence stability vs late fade
  * Training effect vs intensity profile

* Classify session type:

  * Aerobic base
  * Threshold
  * VO2
  * Recovery
  * Heat-compensated aerobic
  * Fatigue-accumulated

* Identify primary limiter from:

  * Thermal load
  * Aerobic ceiling
  * Glycogen depletion
  * Pacing misallocation
  * Mechanical breakdown

This classification step should exist internally before output generation.

---

### B. Output Contract (Strict)

Return exactly 4 blocks:

1. Session Diagnosis (1 sentence)
2. Primary Limiter
3. Performance Lever
4. Next Execution Cue (1 technical cue + 1 measurable anchor)

Hard constraints:

* Max 120 words.
* No repetition of metrics.
* No listing metrics sequentially.
* No motivational filler.
* No emojis.
* Weather only referenced if it changes interpretation.

---

## 4️⃣ Acceptance Criteria (QA Tests)

The output must:

* Never contain duplicate metric sections.
* Never contain “Pacing:” “Heart rate:” “Cadence:” headings.
* Never repeat the same number twice.
* Feel like a coach making a decision, not a dashboard summarizing data.
* Be readable in <10 seconds.

---

## 5️⃣ Implementation Suggestion

Add a pre-generation internal schema:

```
{
  session_type: "",
  primary_limiter: "",
  key_interaction: "",
  recommended_adjustment: "",
  next_run_cue: ""
}
```

Then generate output only from this structured interpretation.

This ensures reasoning precedes language.

---

This change is critical for positioning the product as **AI coaching intelligence**, not AI commentary.

Implement this as the default behavior for “Coach Focus.”
