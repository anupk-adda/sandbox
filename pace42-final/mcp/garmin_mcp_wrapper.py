"""
Wrapper for Garmin MCP server.

Ensures token store directories exist before launching the external MCP server.
This avoids FileNotFoundError when garth.dump() writes oauth token files.
"""

from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path


def _ensure_dir(path_value: str) -> None:
    if not path_value:
        return
    path = Path(path_value).expanduser()
    try:
        path.mkdir(parents=True, exist_ok=True)
        # Some clients may write to a nested "tokens" folder inside tokenstore
        (path / "tokens").mkdir(parents=True, exist_ok=True)
    except Exception:
        # Avoid noisy logs here; MCP server will report failures if critical.
        pass


def _main() -> None:
    tokenstore = os.getenv("GARMINTOKENS") or "~/.garminconnect"
    tokenstore_base64 = os.getenv("GARMINTOKENS_BASE64") or "~/.garminconnect_base64"

    _ensure_dir(tokenstore)
    # Ensure parent dir for base64 file exists
    _ensure_dir(str(Path(tokenstore_base64).expanduser().parent))

    target = os.getenv("GARMIN_MCP_TARGET") or "/Users/anupk/devops/mcp/garmin_mcp/garmin_mcp_server.py"
    target_path = Path(target).expanduser().resolve()

    # Ensure local modules are importable (garmin_mcp_server.py uses "from modules import ...")
    target_dir = str(target_path.parent)
    os.chdir(target_dir)
    pythonpath = os.environ.get("PYTHONPATH", "")
    if target_dir not in pythonpath.split(":"):
        os.environ["PYTHONPATH"] = f"{target_dir}:{pythonpath}" if pythonpath else target_dir
    if target_dir not in sys.path:
        sys.path.insert(0, target_dir)

    runpy.run_path(str(target_path), run_name="__main__")


if __name__ == "__main__":
    _main()
