# pace42 Checkpoint v1.2.2

**Date:** 2026-02-20  
**Version:** 1.2.2  
**Status:** ✅ Functional with known issues

---

## Overview

This checkpoint rebuilds the chart system and restores correct assistant-embedded graph rendering for weather and run analysis. It also adds a Vault cold-start initialization script and documentation updates.

---

## Highlights (v1.2.2)

1. **Chart System Rebuild (No Mixing)**
   - Weather Running Conditions widget is isolated from run-analysis charts
   - Run Analysis charts support dual-metric overlay and dark-mode inputs
   - Graphs render inside assistant responses (no context loss)

2. **Weather Condition Buckets (Correct Color Rules)**
   - GOOD: 10–22°C, rain <30%, no lightning, humidity <75%
   - FAIR: 23–30°C, rain 30–60%, light rain, humidity 75–85%
   - POOR: >30°C, rain >60%, thunder/heat index high, lightning detected

3. **Vault Cold Start Support**
   - Added `scripts/init-vault.sh` for initialization/unseal/setup
   - Updated startup documentation with cold-start instructions

---

## Files Updated / Added

**Frontend**
- `frontend/src/features/weather/*` (RunningConditions widget + scoring)
- `frontend/src/features/run-analysis/*` (Run analysis chart + metric picker)
- `frontend/src/components/Chat.tsx` (embed weather + run charts in assistant)
- `frontend/src/services/chatService.ts` (runSamples payload)

**Backend / Agent**
- `backend/src/routes/chat.routes.ts` (runSamples support; weather charts disabled)
- `agent-service/src/agents/current_run_analyzer.py` (runSamples generation)
- `agent-service/src/config.py`, `agent-service/src/llm/openai_provider.py`, `agent-service/src/vault_client.py`

**Ops / Docs**
- `scripts/init-vault.sh` (new)
- `scripts/start.sh` (uses init-vault.sh on cold start)
- `STARTUP.md` (cold-start documentation)

---

## Fixed in v1.2.2

- Graphs now render inside assistant responses (no separate page context loss)
- Weather and run charts are fully separated (no shared code)
- Dark-mode inputs/tooltips for charts
- Weather chart color coding aligned to Good/Fair/Poor thresholds

---

## Known Issues (Pending)

1. **Garmin Account Switch**
   - After disconnecting and adding new Garmin credentials, data is still fetched from old account
   - Likely MCP server/device binding is hardcoded

2. **Plan Subscription Flow**
   - Subscription state is not fully driving dashboard module behavior

---

**Checkpoint created:** 2026-02-20  
**Ready for additional bug fixes:** ✅
