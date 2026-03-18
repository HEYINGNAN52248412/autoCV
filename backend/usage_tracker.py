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


def get_detailed_summary() -> dict:
    """Return usage grouped by job with per-phase breakdown and cost estimates."""
    with _lock:
        data = _load()

    total_in = data["total_input_tokens"]
    total_out = data["total_output_tokens"]
    # Sonnet pricing: $3/M input, $15/M output
    total_cost = (total_in / 1_000_000) * 3 + (total_out / 1_000_000) * 15

    jobs: dict[str, dict] = {}
    for entry in data.get("history", []):
        job = entry["job"]
        if job not in jobs:
            parts = job.rsplit("_", 1)
            if len(parts) == 2 and parts[1].isdigit():
                company = parts[0].replace("_", " ").title()
                date_str = parts[1]
            else:
                company = job
                date_str = ""
            jobs[job] = {
                "job_dir": job,
                "company": company,
                "date": date_str,
                "phases": {},
                "total_tokens": 0,
                "estimated_cost_usd": 0.0,
            }

        phase = entry["phase"]
        phase_data = {
            "input_tokens": entry["input_tokens"],
            "output_tokens": entry["output_tokens"],
            "timestamp": entry["timestamp"],
        }

        if phase == "interactive_qa":
            if "interactive_qa" not in jobs[job]["phases"]:
                jobs[job]["phases"]["interactive_qa"] = []
            jobs[job]["phases"]["interactive_qa"].append(phase_data)
        else:
            jobs[job]["phases"][phase] = phase_data

        tokens = entry["input_tokens"] + entry["output_tokens"]
        jobs[job]["total_tokens"] += tokens
        cost = (entry["input_tokens"] / 1_000_000) * 3 + (entry["output_tokens"] / 1_000_000) * 15
        jobs[job]["estimated_cost_usd"] += cost

    def _latest_ts(job_entry: dict) -> str:
        timestamps = []
        for value in job_entry["phases"].values():
            if isinstance(value, list):
                timestamps.extend(e["timestamp"] for e in value)
            else:
                timestamps.append(value["timestamp"])
        return max(timestamps) if timestamps else ""

    per_job = sorted(jobs.values(), key=_latest_ts, reverse=True)

    for j in per_job:
        j["estimated_cost_usd"] = round(j["estimated_cost_usd"], 6)

    return {
        "total_input_tokens": total_in,
        "total_output_tokens": total_out,
        "total_calls": data["total_calls"],
        "estimated_cost_usd": round(total_cost, 6),
        "per_job": per_job,
    }
