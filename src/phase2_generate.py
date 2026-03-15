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


def _call_api(system: str, user_content: str, max_tokens: int = 4096) -> str | None:
    """Make an Anthropic API call, returning the text response or None on error."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        return response.content[0].text
    except anthropic.APIError as e:
        print(f"  ERROR: Anthropic API call failed: {e}")
        return None


def generate_resume(
    jd_text: str,
    knowledge_context: str,
    phase1_result: dict,
    job_dir: str,
) -> str | None:
    """Generate a tailored LaTeX resume. Returns PDF path on success, None on failure."""
    prompt = _load_prompt("phase2_resume.txt")
    system = knowledge_context + "\n\n" + prompt

    user_content = (
        "## Job Description\n\n"
        + jd_text
        + "\n\n## Phase 1 Analysis\n\n"
        + json.dumps(phase1_result, indent=2, ensure_ascii=False)
    )

    raw = _call_api(system, user_content, max_tokens=8192)
    if raw is None:
        return None

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

    return pdf_path


def generate_cover_letter(
    jd_text: str,
    knowledge_context: str,
    phase1_result: dict,
    company_name: str,
    job_dir: str,
) -> str:
    """Generate a cover letter. Returns the file path."""
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

    raw = _call_api(system, user_content)
    if raw is None:
        return ""

    job_path = Path(job_dir)
    cl_file = job_path / "cover_letter.md"
    cl_file.write_text(raw, encoding="utf-8")
    print(f"  Saved: {cl_file}")
    return str(cl_file)


def generate_qa(
    jd_text: str,
    knowledge_context: str,
    phase1_result: dict,
    questions: str,
    job_dir: str,
) -> str:
    """Generate Q&A answers. Returns the file path."""
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

    raw = _call_api(system, user_content)
    if raw is None:
        return ""

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
        return str(qa_file)

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
    return str(qa_file)
