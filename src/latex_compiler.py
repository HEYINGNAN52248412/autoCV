import subprocess
from pathlib import Path

from src.config import LATEX_COMPILER


def compile_latex(tex_path: str, output_dir: str) -> str | None:
    """Compile a .tex file to PDF. Returns the PDF path on success, None on failure."""
    tex = Path(tex_path)
    out_dir = Path(output_dir)

    cmd = [
        LATEX_COMPILER,
        "-interaction=nonstopmode",
        f"-output-directory={out_dir}",
        str(tex),
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except FileNotFoundError:
        print(f"  ERROR: LaTeX compiler '{LATEX_COMPILER}' not found.")
        print(f"  Install TeX Live or set LATEX_COMPILER in .env to the correct path.")
        return None
    except subprocess.TimeoutExpired:
        print(f"  ERROR: LaTeX compilation timed out after 60 seconds.")
        return None

    pdf_path = out_dir / tex.with_suffix(".pdf").name

    if result.returncode == 0 and pdf_path.exists():
        # Clean up auxiliary files
        for ext in [".aux", ".log", ".out"]:
            aux_file = out_dir / tex.with_suffix(ext).name
            if aux_file.exists():
                aux_file.unlink()
        return str(pdf_path)

    # Compilation failed — show the log tail
    log_file = out_dir / tex.with_suffix(".log").name
    if log_file.exists():
        log_lines = log_file.read_text(encoding="utf-8", errors="replace").splitlines()
        tail = log_lines[-30:] if len(log_lines) > 30 else log_lines
        print(f"  ERROR: LaTeX compilation failed. Last {len(tail)} lines of log:")
        for line in tail:
            print(f"    {line}")
    else:
        print(f"  ERROR: LaTeX compilation failed (return code {result.returncode}).")
        if result.stderr:
            print(f"  stderr: {result.stderr[:500]}")

    return None
