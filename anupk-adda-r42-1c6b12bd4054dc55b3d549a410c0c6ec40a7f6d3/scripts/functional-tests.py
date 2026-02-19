#!/usr/bin/env python3

import json
import os
import sys
import time
import urllib.request
from typing import Any, Dict, List, Optional


def load_cases(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_by_path(data: Any, path: str) -> Any:
    parts = path.split(".")
    current = data
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def request(method: str, url: str, body: Optional[dict] = None, timeout: int = 20) -> Dict[str, Any]:
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = raw
        return {"status": resp.status, "json": payload}


def run_asserts(case: Dict[str, Any], result: Dict[str, Any]) -> List[str]:
    errors = []
    for assertion in case.get("asserts", []):
        atype = assertion.get("type")
        if atype == "status":
            expected = assertion.get("equals")
            if result.get("status") != expected:
                errors.append(f"expected status {expected}, got {result.get('status')}")
        elif atype == "json_equals":
            value = get_by_path(result.get("json"), assertion.get("path"))
            if value != assertion.get("equals"):
                errors.append(f"{assertion.get('path')} != {assertion.get('equals')} (got {value})")
        elif atype == "json_exists":
            value = get_by_path(result.get("json"), assertion.get("path"))
            if value is None:
                errors.append(f"{assertion.get('path')} missing")
        elif atype == "json_len_gte":
            value = get_by_path(result.get("json"), assertion.get("path"))
            if not isinstance(value, list) or len(value) < assertion.get("value", 0):
                errors.append(f"{assertion.get('path')} length < {assertion.get('value')}")
        elif atype == "json_contains":
            value = get_by_path(result.get("json"), assertion.get("path"))
            needle = assertion.get("value", "")
            if not isinstance(value, str) or needle not in value:
                errors.append(f"{assertion.get('path')} does not contain '{needle}'")
        else:
            errors.append(f"unknown assertion type: {atype}")
    return errors


def main() -> int:
    cases_path = os.environ.get("TEST_CASES_FILE", "tests/functional/test-cases.json")
    cases = load_cases(cases_path)
    base_url = os.environ.get(cases.get("base_url_env", "BASE_URL"), cases.get("default_base_url"))

    results = []
    for case in cases.get("cases", []):
        req_env = case.get("requires_env")
        if req_env and not os.environ.get(req_env):
            results.append((case["id"], "SKIPPED", f"missing env {req_env}"))
            continue

        try:
            if "steps" in case:
                session_id = None
                last_result = None
                errors = []
                for step in case.get("steps", []):
                    url = base_url.rstrip("/") + step.get("path", case.get("path", ""))
                    body = step.get("body")
                    if body is not None and session_id:
                        body = dict(body)
                        body.setdefault("sessionId", session_id)
                    result = request(step.get("method", case.get("method", "GET")), url, body=body)
                    last_result = result
                    session_id = result.get("json", {}).get("sessionId") or session_id
                    errors.extend(run_asserts(step, result))
                    time.sleep(0.2)
                if not errors and last_result is not None:
                    errors = run_asserts(case, last_result)
            else:
                url = base_url.rstrip("/") + case.get("path", "")
                result = request(case.get("method", "GET"), url, body=case.get("body"))
                errors = run_asserts(case, result)
            if errors:
                results.append((case["id"], "FAILED", "; ".join(errors)))
            else:
                results.append((case["id"], "PASSED", ""))
        except Exception as exc:
            results.append((case["id"], "FAILED", str(exc)))
        time.sleep(0.2)

    print("\nFunctional Test Results")
    print("=======================")
    for test_id, status, detail in results:
        line = f"{test_id:20} {status}"
        if detail:
            line += f" - {detail}"
        print(line)

    failed = [r for r in results if r[1] == "FAILED"]
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
