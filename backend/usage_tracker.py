"""Global token usage tracker. Persists to usage_total.json at project root."""

import json
import threading
from datetime import datetime, timezone
from pathlib import Path

_USAGE_FILE = Path(__file__).resolve().parent.parent / "usage_total.json"
_lock = threading.Lock()


def _load() -> dict:
    if _USAGE_FILE.exists():
        try:
            return json.loads(_USAGE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"total_input_tokens": 0, "total_output_tokens": 0, "total_calls": 0, "history": []}


def _save(data: dict) -> None:
    _USAGE_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def record(job: str, phase: str, input_tokens: int, output_tokens: int) -> None:
    """Record a single API call's usage."""
    if not input_tokens and not output_tokens:
        return
    with _lock:
        data = _load()
        data["total_input_tokens"] += input_tokens
        data["total_output_tokens"] += output_tokens
        data["total_calls"] += 1
        data["history"].append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "job": job,
            "phase": phase,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        })
        _save(data)


def get_summary() -> dict:
    """Return the full usage summary."""
    with _lock:
        return _load()
