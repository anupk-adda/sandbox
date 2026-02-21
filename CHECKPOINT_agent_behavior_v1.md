# Agent Behavior Change Checkpoint v1

**Date:** 2026-02-21
**Branch:** codex/agent-behavior
**Status:** Planned (3-phase execution)

---

## Objective (Team Reviewed)
Update coaching behavior, graph rendering, and dashboard flow in three phases:
1. Coach agent holistic synthesis behavior (per coaching_agent.md)
2. Run analysis graph rendering improvements (per req_graph_rendering.md)
3. Dashboard + subscription flow completion with plan modification lifecycle
4. Assistant handles running-related questions with richer context and memory

Team review recorded in TEAM_SYNC.md before execution.

---

## Phase 1 — Coach Agent: Holistic Synthesis Mode
**Goal:** Replace metric-by-metric narration with integrated diagnosis and prescriptive action.

### Scope
- Coach behavior for run analysis (current_run_analyzer).
- Ensure output contract: 4 sentences, ≤120 words, no metric headings, no repeated numbers.

### Implementation Plan
1. Update system prompt to enforce holistic synthesis reasoning and strict output contract.
2. Update analysis prompt to remove legacy template and enforce 4-block format.
3. Add lightweight validation: trim output to 4 lines if extra (optional).

### Tests
- Unit: ensure output starts with required labels and uses 4 lines.
- Manual: run 3 sample activities (easy, tempo, hot run) and verify constraints.

### Acceptance
- No per-metric headings.
- Output ≤120 words.
- Exactly 4 lines with required labels.

---

## Phase 2 — Graph Rendering: Insightful Analytics
**Goal:** Show effort-output relationship, drift, and efficiency without misleading axes.

### Scope
- Normalize pace/HR overlay or implement dual-axis correctly.
- Add derived metric (efficiency / drift / decoupling).
- Apply smoothing + remove time-view spike.
- Improve hover data and highlight zones.

### Implementation Plan
1. Normalize pace to speed and percent-of-max, overlay with HR%.
2. Add derived line (HR-to-speed ratio or drift %).
3. Add rolling average (10–20s) and consistent sampling interval.
4. Highlight last-third zone and drift band.
5. Hover tooltip includes time | HR | pace/speed | efficiency | drift%.

### Tests
- Visual test: toggle Time/Distance no spike.
- Derived metric present and stable.
- 5-second interpretation test (quick UX review).

### Acceptance
- Derived metric present.
- No time-toggle compression artifacts.
- Interpretation clarity within 5 seconds.

---

## Phase 3 — Dashboard + Plan Lifecycle Completion
**Goal:** Complete subscription flow and plan lifecycle (create, subscribe, monitor, modify).

### Scope
- When coach presents plan, include Subscribe CTA.
- Dashboard shows progress only when subscribed.
- Allow plan modification at any stage.
- Coach recommends plan changes based on new runs.

### Implementation Plan
1. Add subscribe CTA to plan response (frontend + backend response fields).
2. Dashboard shows progress if subscribed + plan active.
3. Add plan update endpoint + UI action to modify plan (phase, weeks).
4. Coach auto-suggests plan update when new run indicates mismatch.

### Tests
- Subscribe CTA appears and sets subscription.
- Dashboard reflects subscribed plan status.
- Plan update endpoint modifies plan state.
- Coach suggestions trigger on new run analysis.

### Acceptance
- Single plan per user enforced.
- Plan can be modified at any stage.
- Dashboard updates without manual workarounds.

---

## Phase 4 — Contextual Coach Q&A (Memory + Interactive Discussion)
**Goal:** Answer running-related questions with richer context, maintaining conversational memory and follow‑ups without losing context.

### Scope
- Maintain short‑term conversational memory across questions.
- Use prior context to interpret follow‑ups and refine answers.
- Keep agentic routing intact; avoid breaking existing flow.

### Implementation Plan
1. Persist and retrieve last N user/assistant turns for running Q&A.
2. Add context‑aware prompt template for CoachQAAgent (no loss of prior constraints).
3. Add follow‑up detection to shift from generic response to context‑bound response.
4. Ensure memory reset on new user/session or explicit user request.

### Tests
- Multi‑turn Q&A: ask pace question → follow‑up “what about next week?” (context used).
- Contrast test: new session must not leak previous context.
- Interactive clarification: assistant asks one clarifying question when ambiguous.

### Acceptance
- Answers remain running‑focused and context‑aware.
- Follow‑ups correctly reference prior answer without repetition.
- No cross‑user/session leakage.

---

## Additional Enhancements (Optional)
- Add plan change log in UI (why the plan updated).
- Add “Re-evaluate plan” quick action after new run.
- Add small badge for plan status (On Track / Needs Adjustment).
