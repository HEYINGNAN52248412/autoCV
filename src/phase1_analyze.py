import json
import re
from pathlib import Path

import anthropic

from src.config import ANTHROPIC_API_KEY, MODEL


def _load_prompt() -> str:
    prompt_path = Path(__file__).parent / "prompts" / "phase1.txt"
    return prompt_path.read_text(encoding="utf-8")


def _strip_json_fences(text: str) -> str:
    """Strip markdown code fences if the model adds them despite instructions."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _render_markdown(analysis: dict) -> str:
    """Render the analysis dict as a human-readable markdown report."""
    lines = []
    lines.append(f"# Phase 1 Analysis\n")

    lines.append(f"## Company Overview\n\n{analysis['company_overview']}\n")
    lines.append(f"## Role Summary\n\n{analysis['role_summary']}\n")

    lines.append("## Hard Requirements\n")
    for req in analysis["hard_requirements"]:
        lines.append(f"- {req}")
    lines.append("")

    lines.append("## Nice-to-Have Requirements\n")
    for req in analysis["soft_requirements"]:
        lines.append(f"- {req}")
    lines.append("")

    lines.append("## Skill Match Matrix\n")
    lines.append("| Skill | JD Asks | You Have | Match |")
    lines.append("|-------|---------|----------|-------|")
    for s in analysis["skill_match"]:
        lines.append(f"| {s['skill']} | {s['jd_asks']} | {s['you_have']} | {s['match']} |")
    lines.append("")

    score = analysis["match_score"]
    lines.append(f"## Match Score: {score}/10\n")
    lines.append(f"{analysis['match_reasoning']}\n")

    lines.append("## Strengths\n")
    for item in analysis["strengths"]:
        lines.append(f"- {item}")
    lines.append("")

    lines.append("## Gaps\n")
    for item in analysis["gaps"]:
        lines.append(f"- {item}")
    lines.append("")

    rec = analysis["recommendation"].upper()
    lines.append(f"## Recommendation: **{rec}**\n")

    lines.append("## Resume Focus Hints (for Phase 2)\n")
    for hint in analysis["resume_focus_hints"]:
        lines.append(f"- {hint}")
    lines.append("")

    return "\n".join(lines)


def run_phase1(jd_text: str, knowledge_context: str, job_dir: str) -> dict:
    """Run Phase 1 analysis: call Claude API with the JD and knowledge base."""
    phase1_prompt = _load_prompt()
    system_prompt = knowledge_context + "\n\n" + phase1_prompt

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": jd_text}],
        )
    except anthropic.APIError as e:
        print(f"  ERROR: Anthropic API call failed: {e}")
        return {}

    raw_text = response.content[0].text
    json_text = _strip_json_fences(raw_text)

    try:
        analysis = json.loads(json_text)
    except json.JSONDecodeError as e:
        print(f"  ERROR: Failed to parse API response as JSON: {e}")
        print(f"  Raw response (first 500 chars): {raw_text[:500]}")
        # Save raw response for debugging
        job_path = Path(job_dir)
        job_path.mkdir(parents=True, exist_ok=True)
        (job_path / "phase1_raw_response.txt").write_text(raw_text, encoding="utf-8")
        return {}

    # Save outputs
    job_path = Path(job_dir)
    job_path.mkdir(parents=True, exist_ok=True)

    (job_path / "phase1_analysis.json").write_text(
        json.dumps(analysis, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    markdown_report = _render_markdown(analysis)
    (job_path / "phase1_analysis.md").write_text(markdown_report, encoding="utf-8")

    return analysis
