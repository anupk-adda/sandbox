#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${PACE42_BASE_URL:-http://localhost:3000}
TOKEN=${PACE42_TEST_TOKEN:-}

HEALTH_REQUESTS=${PACE42_HEALTH_REQUESTS:-250}
HEALTH_CONCURRENCY=${PACE42_HEALTH_CONCURRENCY:-25}

CHAT_REQUESTS=${PACE42_CHAT_REQUESTS:-50}
CHAT_CONCURRENCY=${PACE42_CHAT_CONCURRENCY:-5}

PLANS_REQUESTS=${PACE42_PLANS_REQUESTS:-100}
PLANS_CONCURRENCY=${PACE42_PLANS_CONCURRENCY:-10}

if [[ -z "$TOKEN" ]]; then
  echo "PACE42_TEST_TOKEN is required for authenticated endpoints (chat, training-plans)." >&2
  exit 1
fi

run_burst() {
  local name=$1
  local requests=$2
  local concurrency=$3
  local method=$4
  local url=$5
  local body=${6:-}

  echo "" >&2
  echo "== $name ==" >&2
  echo "Requests: $requests | Concurrency: $concurrency | URL: $url" >&2

  local i
  if [[ -n "$body" ]]; then
    for i in $(seq 1 "$requests"); do
      curl -s -w '\n%{time_total} %{http_code}\n' -X "$method" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$body" \
        "$url" | tail -n 1
    done
  else
    for i in $(seq 1 "$requests"); do
      curl -s -w '\n%{time_total} %{http_code}\n' -X "$method" \
        -H "Authorization: Bearer $TOKEN" \
        "$url" | tail -n 1
    done
  fi
}

summarize() {
  python3 - <<'PY'
import sys
import statistics

times = []
status = {}
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    parts = line.split()
    if len(parts) != 2:
        continue
    t, code = parts
    try:
        times.append(float(t))
    except ValueError:
        continue
    status[code] = status.get(code, 0) + 1

if not times:
    print("No samples")
    sys.exit(0)

p50 = statistics.median(times)
psorted = sorted(times)
idx95 = int(round(0.95 * (len(psorted) - 1)))
p95 = psorted[idx95]
print(f"Samples: {len(times)}")
print(f"p50: {p50:.3f}s")
print(f"p95: {p95:.3f}s")
print("Status counts:")
for code in sorted(status.keys()):
    print(f"  {code}: {status[code]}")
PY
}

run_burst "Health Check" "$HEALTH_REQUESTS" "$HEALTH_CONCURRENCY" "GET" "$BASE_URL/health" | summarize

chat_body='{"message":"Quick check","sessionId":"perf-smoke"}'
run_burst "Chat Smoke" "$CHAT_REQUESTS" "$CHAT_CONCURRENCY" "POST" "$BASE_URL/api/v1/chat" "$chat_body" | summarize

run_burst "Training Plans Active" "$PLANS_REQUESTS" "$PLANS_CONCURRENCY" "GET" "$BASE_URL/api/v1/training-plans/active" | summarize

echo ""
echo "Perf smoke complete."
