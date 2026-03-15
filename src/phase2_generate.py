import json
import re
from pathlib import Path

import anthropic

from src.config import ANTHROPIC_API_KEY, MODEL
from src.latex_compiler import compile_latex


def _load_prompt(name: str) -> str:
    prompt_path = Path(__file__).parent / "prompts" / name
    return prompt_path.read_text(encoding="utf-8")


def _strip_fences(text: str, lang: str = "") -> str:
    """Strip markdown code fences if the model adds them despite instructions."""
    text = text.strip()
    pattern = rf"^```(?:{lang})?\s*\n?" if lang else r"^```\w*\s*\n?"
    text = re.sub(pattern, "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _call_api(system: str, user_content: str, max_tokens: int = 4096) -> tuple[str | None, dict]:
    """Make an Anthropic API call, returning (text, usage) or (None, usage) on error."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }
        return response.content[0].text, usage
    except anthropic.APIError as e:
        print(f"  ERROR: Anthropic API call failed: {e}")
        return None, {}


def generate_resume(
    jd_text: str,
    knowledge_context: str,
    phase1_result: dict,
    job_dir: str,
) -> tuple[str | None, dict]:
    """Generate a tailored LaTeX resume. Returns (PDF path or None, usage)."""
    prompt = _load_prompt("phase2_resume.txt")
    system = knowledge_context + "\n\n" + prompt

    user_content = (
        "## Job Description\n\n"
        + jd_text
        + "\n\n## Phase 1 Analysis\n\n"
        + json.dumps(phase1_result, indent=2, ensure_ascii=False)
    )

    raw, usage = _call_api(system, user_content, max_tokens=8192)
    if raw is None:
        return None, usage

    latex_code = _strip_fences(raw, lang="latex|tex")

    job_path = Path(job_dir)
    tex_file = job_path / "resume_tailored.tex"
    tex_file.write_text(latex_code, encoding="utf-8")
    print(f"  Saved: {tex_file}")

    pdf_path = compile_latex(str(tex_file), job_dir)
    if pdf_path:
        print(f"  Saved: {pdf_path}")
    else:
        print(f"  LaTeX compilation failed. The .tex file is saved and can be compiled manually:")
        print(f"    {tex_file}")

    return pdf_path, usage


def generate_cover_letter(
    jd_text: str,
    knowledge_context: str,
    phase1_result: dict,
    company_name: str,
    job_dir: str,
) -> tuple[str, dict]:
    """Generate a cover letter. Returns (file path, usage)."""
    prompt = _load_prompt("phase2_cover.txt")
    system = knowledge_context + "\n\n" + prompt

    user_content = (
        "## Job Description\n\n"
        + jd_text
        + "\n\n## Phase 1 Analysis\n\n"
        + json.dumps(phase1_result, indent=2, ensure_ascii=False)
        + "\n\n## Company Name\n\n"
        + company_name
    )

    raw, usage = _call_api(system, user_content)
    if raw is None:
        return "", usage

    job_path = Path(job_dir)
    cl_file = job_path / "cover_letter.md"
    cl_file.write_text(raw, encoding="utf-8")
    print(f"  Saved: {cl_file}")
    return str(cl_file), usage


def generate_qa(
    jd_text: str,
    knowledge_context: str,
    phase1_result: dict,
    questions: str,
    job_dir: str,
) -> tuple[str, dict]:
    """Generate Q&A answers. Returns (file path, usage)."""
    prompt = _load_prompt("phase2_qa.txt")
    system = knowledge_context + "\n\n" + prompt

    questions_block = questions if questions.strip() else "No specific questions provided, generate answers for common application questions."

    user_content = (
        "## Job Description\n\n"
        + jd_text
        + "\n\n## Phase 1 Analysis\n\n"
        + json.dumps(phase1_result, indent=2, ensure_ascii=False)
        + "\n\n## Application Questions\n\n"
        + questions_block
    )

    raw, usage = _call_api(system, user_content)
    if raw is None:
        return "", usage

    # Parse JSON and render as markdown
    json_text = _strip_fences(raw, lang="json")
    try:
        qa_list = json.loads(json_text)
    except json.JSONDecodeError:
        # Save raw response as-is if JSON parsing fails
        print(f"  WARNING: Could not parse Q&A response as JSON, saving raw text.")
        job_path = Path(job_dir)
        qa_file = job_path / "qa_answers.md"
        qa_file.write_text(raw, encoding="utf-8")
        print(f"  Saved: {qa_file}")
        return str(qa_file), usage

    # Render as readable markdown
    lines = ["# Application Q&A\n"]
    for i, item in enumerate(qa_list, 1):
        lines.append(f"## Q{i}: {item['question']}\n")
        lines.append(f"{item['answer']}\n")

    job_path = Path(job_dir)
    qa_file = job_path / "qa_answers.md"
    qa_file.write_text("\n".join(lines), encoding="utf-8")

    # Also save raw JSON
    (job_path / "qa_answers.json").write_text(
        json.dumps(qa_list, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"  Saved: {qa_file}")
    return str(qa_file), usage


def answer_questions(
    jd_text: str,
    knowledge_context: str,
    phase1_result: dict,
    questions: list[str],
    job_dir: str,
) -> tuple[list[dict], dict]:
    """Answer specific questions interactively. Returns (answers_list, usage)."""
    prompt = _load_prompt("phase2_qa.txt")
    system = knowledge_context + "\n\n" + prompt

    questions_text = "\n".join(f"- {q}" for q in questions)

    user_content = (
        "## Job Description\n\n"
        + jd_text
        + "\n\n## Phase 1 Analysis\n\n"
        + json.dumps(phase1_result, indent=2, ensure_ascii=False)
        + "\n\n## Application Questions\n\n"
        + questions_text
    )

    raw, usage = _call_api(system, user_content)
    if raw is None:
        return [], usage

    json_text = _strip_fences(raw, lang="json")
    try:
        qa_list = json.loads(json_text)
    except json.JSONDecodeError:
        # Return raw text as a single answer
        qa_list = [{"question": questions[0] if questions else "Question", "answer": raw}]

    # Append to existing qa_answers.json
    job_path = Path(job_dir)
    existing = []
    qa_json_file = job_path / "qa_answers.json"
    if qa_json_file.exists():
        try:
            existing = json.loads(qa_json_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass

    merged = existing + qa_list
    qa_json_file.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")

    # Also update the markdown file
    lines = ["# Application Q&A\n"]
    for i, item in enumerate(merged, 1):
        lines.append(f"## Q{i}: {item['question']}\n")
        lines.append(f"{item['answer']}\n")
    (job_path / "qa_answers.md").write_text("\n".join(lines), encoding="utf-8")

    return qa_list, usage
