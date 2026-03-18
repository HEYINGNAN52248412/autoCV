from pathlib import Path


def _read_text_file(file_path: Path) -> str:
    return file_path.read_text(encoding="utf-8")


def list_templates(kb_path: str) -> list[dict]:
    """Scan knowledge_base/ for all .tex files and return metadata."""
    kb = Path(kb_path)
    templates = []
    for tex_file in sorted(kb.glob("*.tex")):
        label = tex_file.stem.replace("_", " ").title()
        templates.append({"filename": tex_file.name, "label": label})
    return templates


def load_knowledge_base(kb_path: str, template_file: str = "resume.tex") -> str:
    kb = Path(kb_path)
    sections = {}
    found = []
    missing = []

    # 1. LaTeX template (structured resume content)
    tex_path = kb / template_file
    if tex_path.exists():
        sections["resume_latex"] = _read_text_file(tex_path)
        found.append(template_file)
    else:
        print(f"  WARNING: {tex_path} not found, skipping LaTeX resume")
        missing.append(template_file)

    # 2. experience.md -> detailed knowledge base
    exp_path = kb / "experience.md"
    if exp_path.exists():
        sections["experience"] = _read_text_file(exp_path)
        found.append("experience.md")
    else:
        print(f"  WARNING: {exp_path} not found, skipping experience")
        missing.append("experience.md")

    # Build structured output
    parts = ["<knowledge_base>"]
    for tag, content in sections.items():
        parts.append(f"<{tag}>\n{content}\n</{tag}>")
    parts.append("</knowledge_base>")
    result = "\n".join(parts)

    # Summary
    total_chars = len(result)
    approx_tokens = total_chars // 4
    print(f"  Knowledge base loaded: {len(found)}/2 files found")
    print(f"    Found: {', '.join(found) if found else 'none'}")
    if missing:
        print(f"    Missing: {', '.join(missing)}")
    print(f"    Total size: {total_chars:,} chars (~{approx_tokens:,} tokens)")

    return result
