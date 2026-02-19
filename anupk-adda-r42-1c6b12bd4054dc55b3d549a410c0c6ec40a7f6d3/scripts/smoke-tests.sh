#!/bin/bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Running smoke tests against ${BASE_URL}..."

echo "1) Health check"
curl -s "${BASE_URL}/health" | python -c "import sys, json; print('status:', json.load(sys.stdin).get('status'))"

echo "2) Weather widget payload"
curl -s -X POST "${BASE_URL}/api/v1/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Running conditions near me","location":{"latitude":1.3521,"longitude":103.8198}}' \
  | python - <<'PY'
import sys, json
data = json.load(sys.stdin)
weather = data.get("weather") or {}
hours = weather.get("hours") or []
print("weather label:", weather.get("location_label"))
print("hours:", len(hours))
assert len(hours) >= 6, "Expected at least 6 hours of weather data"
PY

echo "3) Last run charts payload"
curl -s -X POST "${BASE_URL}/api/v1/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Analyze my last run"}' \
  | python - <<'PY'
import sys, json
data = json.load(sys.stdin)
charts = data.get("charts") or []
print("charts:", len(charts))
assert len(charts) >= 1, "Expected chart payload"
PY

echo "Smoke tests passed."
