from pathlib import Path
import pymupdf


def _extract_pdf_text(pdf_path: Path) -> str:
    doc = pymupdf.open(pdf_path)
    pages = [page.get_text() for page in doc]
    doc.close()
    return "\n".join(pages)


def _read_text_file(file_path: Path) -> str:
    return file_path.read_text(encoding="utf-8")


def load_knowledge_base(kb_path: str) -> str:
    kb = Path(kb_path)
    sections = {}
    found = []
    missing = []

    # 1. resume.pdf -> extract plain text
    pdf_path = kb / "resume.pdf"
    if pdf_path.exists():
        sections["resume_text"] = _extract_pdf_text(pdf_path)
        found.append("resume.pdf")
    else:
        print(f"  WARNING: {pdf_path} not found, skipping PDF extraction")
        missing.append("resume.pdf")

    # 2. experience.md -> raw text
    exp_path = kb / "experience.md"
    if exp_path.exists():
        sections["experience"] = _read_text_file(exp_path)
        found.append("experience.md")
    else:
        print(f"  WARNING: {exp_path} not found, skipping experience")
        missing.append("experience.md")

    # 3. resume.tex -> raw text
    tex_path = kb / "resume.tex"
    if tex_path.exists():
        sections["latex_template"] = _read_text_file(tex_path)
        found.append("resume.tex")
    else:
        print(f"  WARNING: {tex_path} not found, skipping LaTeX template")
        missing.append("resume.tex")

    # Build structured output
    parts = ["<knowledge_base>"]
    for tag, content in sections.items():
        parts.append(f"<{tag}>\n{content}\n</{tag}>")
    parts.append("</knowledge_base>")
    result = "\n".join(parts)

    # Summary
    total_chars = len(result)
    approx_tokens = total_chars // 4
    print(f"  Knowledge base loaded: {len(found)}/3 files found")
    print(f"    Found: {', '.join(found) if found else 'none'}")
    if missing:
        print(f"    Missing: {', '.join(missing)}")
    print(f"    Total size: {total_chars:,} chars (~{approx_tokens:,} tokens)")

    return result
