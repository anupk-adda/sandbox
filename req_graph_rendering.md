Here’s a **clear, implementation-focused prompt** you can send to your lead dev to fix the graph so it becomes analytically meaningful — not just visually correct.

---

## Prompt to Lead Developer: Make Run Analysis Graph Insightful (Not Just Rendered)

We need to redesign the Run Analysis graph so it communicates performance insight — not just overlays two lines.

Right now:

* The graph looks visually clean but analytically weak.
* HR and Pace scales don’t feel intuitively connected.
* The Time/Distance toggle causes odd compression (vertical spike).
* There is no clear story in the visualization.

This must feel like a performance tool, not a generic chart.

---

## 1️⃣ Core Objective

The graph must clearly show:

* Effort vs Output relationship
* Drift over time
* Late fade or pacing misallocation
* Efficiency changes

If a user looks for 5 seconds, they should understand:
“Did effort rise while pace dropped?”
“Was there cardiac drift?”
“Was the fade mechanical or aerobic?”

---

## 2️⃣ Required Design Changes

### A. Normalize Overlay Logic

Do NOT overlay raw HR and Pace directly.

Instead:

Option A (Preferred):

* Convert Pace to Speed (m/s or km/h)
* Normalize both signals to % of session max
* Plot on same 0–100% scale

Option B:

* Keep dual axis, but:

  * Invert pace axis correctly (faster = visually higher)
  * Ensure scale symmetry so lines visually correlate

---

### B. Add Derived Signal (Critical)

Add one derived overlay toggle:

* HR-to-Pace ratio (Efficiency Index)
* OR HR drift % over time
* OR Smoothed cardiac decoupling

Without this, the graph is cosmetic.

---

### C. Smoothing + Noise Control

* Apply 10–20 second rolling average
* Remove micro GPS spikes
* Eliminate vertical line artifacts on Time toggle
* Ensure consistent sampling interval

The current Time view spike suggests indexing mismatch or sparse data interpolation.

---

### D. Highlight Insight Zones

Add subtle background bands:

* Green: stable efficiency
* Amber: drift zone
* Red: late fade

Or dynamically highlight the final third to show decoupling.

This makes it actionable.

---

### E. Make Interaction Intelligent

On hover, show:

Time | HR | Pace | Efficiency | Drift %

Not just raw HR/Pace.

---

## 3️⃣ UX Improvements

* Remove large empty padding.
* Increase line contrast slightly.
* Use thinner gridlines.
* Add subtle gradient under HR to show load.

Make it feel premium — closer to Strava Labs than generic Chart.js.

---

## 4️⃣ Acceptance Criteria

The graph must:

* Visually show effort-output relationship.
* Not distort when toggling Time/Distance.
* Contain at least one derived metric.
* Avoid dual-axis confusion.
* Pass the “5-second understanding” test.

---

## 5️⃣ Long-Term Direction (Optional Phase 2)

Add a mode toggle:

* Raw View
* Efficiency View
* Drift View

That’s when this becomes differentiated.

---

This graph is not decoration.
It should help the user understand *why* the run unfolded the way it did.

Let me know if you also want a technical implementation outline (React + Recharts / D3 / smoothing logic).
