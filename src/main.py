import argparse
import json
import sys
from datetime import date
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt

from src.knowledge import load_knowledge_base
from src.phase1_analyze import run_phase1
from src.phase2_generate import generate_resume, generate_cover_letter, generate_qa
from src.config import KNOWLEDGE_BASE_PATH, JOBS_PATH

console = Console()


def _read_jd_interactive() -> str:
    """Read JD text from stdin interactively. End with Ctrl+D or a blank line."""
    console.print("Paste the job description below. End with an empty line or Ctrl+D:\n", style="dim")
    lines = []
    try:
        while True:
            line = input()
            if line == "":
                break
            lines.append(line)
    except EOFError:
        pass
    return "\n".join(lines)


def _display_analysis(analysis: dict) -> None:
    """Display Phase 1 analysis in the terminal using rich."""
    score = analysis["match_score"]

    # Color based on score
    if score >= 7:
        score_color = "green"
    elif score >= 4:
        score_color = "yellow"
    else:
        score_color = "red"

    # Company overview panel
    console.print(Panel(analysis["company_overview"], title="Company Overview", border_style="blue"))

    # Role summary
    console.print(Panel(analysis["role_summary"], title="Role Summary", border_style="blue"))

    # Score bar (ASCII-safe for Windows terminals)
    filled = "#" * score
    empty = "-" * (10 - score)
    score_bar = f"[{score_color}][{filled}{empty}] {score}/10[/{score_color}]"
    console.print(Panel(score_bar, title="Match Score", border_style=score_color))
    console.print(f"  {analysis['match_reasoning']}\n")

    # Skill match table
    table = Table(title="Skill Match Matrix", show_lines=True)
    table.add_column("Skill", style="cyan", min_width=12)
    table.add_column("JD Asks", min_width=20)
    table.add_column("You Have", min_width=20)
    table.add_column("Match", justify="center", min_width=8)

    match_styles = {"strong": "green", "partial": "yellow", "weak": "red", "none": "red bold"}
    for s in analysis["skill_match"]:
        style = match_styles.get(s["match"], "white")
        table.add_row(s["skill"], s["jd_asks"], s["you_have"], f"[{style}]{s['match']}[/{style}]")
    console.print(table)
    console.print()

    # Strengths
    console.print("[bold green]Strengths:[/bold green]")
    for item in analysis["strengths"]:
        console.print(f"  + {item}")
    console.print()

    # Gaps
    console.print("[bold red]Gaps:[/bold red]")
    for item in analysis["gaps"]:
        console.print(f"  - {item}")
    console.print()

    # Recommendation
    rec = analysis["recommendation"]
    rec_styles = {"apply": "bold green", "consider": "bold yellow", "skip": "bold red"}
    style = rec_styles.get(rec, "bold white")
    console.print(f"Recommendation: [{style}]{rec.upper()}[/{style}]\n")


def _run_phase2(jd_text: str, knowledge: str, analysis: dict, company: str, job_dir: str, questions: str = "") -> None:
    """Run all Phase 2 generators sequentially."""
    console.print("\n[bold]Phase 2: Generating tailored materials...[/bold]\n")

    # 1. Resume
    with console.status("[bold cyan]Generating tailored resume..."):
        pdf_path, _ = generate_resume(jd_text, knowledge, analysis, job_dir)
    if pdf_path:
        console.print(f"  [green]Resume PDF:[/green] {pdf_path}")
    else:
        console.print(f"  [yellow]Resume PDF compilation failed. .tex file saved for manual compilation.[/yellow]")

    # 2. Cover letter
    with console.status("[bold cyan]Generating cover letter..."):
        cl_path, _ = generate_cover_letter(jd_text, knowledge, analysis, company, job_dir)
    if cl_path:
        console.print(f"  [green]Cover letter:[/green] {cl_path}")

    # 3. Q&A
    with console.status("[bold cyan]Generating Q&A answers..."):
        qa_path, _ = generate_qa(jd_text, knowledge, analysis, questions, job_dir)
    if qa_path:
        console.print(f"  [green]Q&A answers:[/green] {qa_path}")

    # Final summary
    console.print("\n[bold green]Phase 2 complete![/bold green]")
    console.print(f"  All files saved to: [cyan]{job_dir}[/cyan]\n")


def cmd_analyze(args: argparse.Namespace) -> None:
    """Run Phase 1 analysis on a job description."""
    # Get JD text
    if args.jd_file:
        jd_path = Path(args.jd_file)
        if not jd_path.exists():
            console.print(f"[red]Error: JD file not found: {jd_path}[/red]")
            sys.exit(1)
        jd_text = jd_path.read_text(encoding="utf-8")
        console.print(f"  Loaded JD from {jd_path}")
    else:
        jd_text = _read_jd_interactive()

    if not jd_text.strip():
        console.print("[red]Error: JD text is empty.[/red]")
        sys.exit(1)

    # Get company name
    company = args.company
    if not company:
        company = Prompt.ask("Company name")

    # Create job directory
    date_str = date.today().strftime("%Y%m%d")
    dir_name = f"{company.lower().replace(' ', '_')}_{date_str}"
    job_dir = JOBS_PATH / dir_name
    job_dir.mkdir(parents=True, exist_ok=True)

    # Save raw JD
    (job_dir / "jd.txt").write_text(jd_text, encoding="utf-8")
    console.print(f"  Job directory: {job_dir}\n")

    # Load knowledge base
    console.print("[bold]Loading knowledge base...[/bold]")
    knowledge = load_knowledge_base(str(KNOWLEDGE_BASE_PATH))
    console.print()

    # Run Phase 1
    console.print("[bold]Running Phase 1 analysis...[/bold]")
    analysis = run_phase1(jd_text, knowledge, str(job_dir))

    if not analysis:
        console.print("[red]Phase 1 failed. Check errors above.[/red]")
        sys.exit(1)

    console.print("[bold green]Phase 1 complete!\n[/bold green]")
    _display_analysis(analysis)

    # THE GATE
    console.print(f"  Analysis saved to [cyan]{job_dir}/phase1_analysis.md[/cyan]\n")
    proceed = Prompt.ask("Proceed to generate tailored resume and cover letter?", choices=["y", "n"], default="y")

    if proceed == "y":
        _run_phase2(jd_text, knowledge, analysis, company, str(job_dir))
    else:
        console.print(f"\n  Skipped. Analysis saved to [cyan]{job_dir}/phase1_analysis.md[/cyan]")


def cmd_generate(args: argparse.Namespace) -> None:
    """Run Phase 2 generation on an existing job analysis."""
    job_dir = JOBS_PATH / args.job
    if not job_dir.exists():
        console.print(f"[red]Error: Job directory not found: {job_dir}[/red]")
        sys.exit(1)

    # Verify Phase 1 was run
    analysis_file = job_dir / "phase1_analysis.json"
    if not analysis_file.exists():
        console.print(f"[red]Error: No Phase 1 analysis found in {job_dir}.[/red]")
        console.print(f"  Run Phase 1 first: [cyan]python -m src.main analyze --jd-file <jd.txt> --company <name>[/cyan]")
        sys.exit(1)

    analysis = json.loads(analysis_file.read_text(encoding="utf-8"))

    # Read the JD
    jd_file = job_dir / "jd.txt"
    if not jd_file.exists():
        console.print(f"[red]Error: JD file not found in {job_dir}.[/red]")
        sys.exit(1)
    jd_text = jd_file.read_text(encoding="utf-8")

    # Extract company name from directory name (company_YYYYMMDD)
    company = args.job.rsplit("_", 1)[0].replace("_", " ").title()

    # Load knowledge base
    console.print("[bold]Loading knowledge base...[/bold]")
    knowledge = load_knowledge_base(str(KNOWLEDGE_BASE_PATH))
    console.print()

    questions = args.questions if args.questions else ""

    _run_phase2(jd_text, knowledge, analysis, company, str(job_dir), questions)


def main() -> None:
    parser = argparse.ArgumentParser(description="AutoCV -- Job Application Assistant")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # analyze command
    p_analyze = subparsers.add_parser("analyze", help="Run Phase 1 analysis on a JD")
    p_analyze.add_argument("--jd-file", type=str, help="Path to a .txt file containing the JD")
    p_analyze.add_argument("--jd", action="store_true", help="Enter JD interactively")
    p_analyze.add_argument("--company", type=str, help="Company name")

    # generate command
    p_generate = subparsers.add_parser("generate", help="Run Phase 2: generate tailored resume, cover letter, Q&A")
    p_generate.add_argument("--job", type=str, required=True, help="Job directory name under jobs/")
    p_generate.add_argument("--questions", type=str, default="", help="Application questions (separate with newlines)")

    args = parser.parse_args()

    if args.command == "analyze":
        cmd_analyze(args)
    elif args.command == "generate":
        cmd_generate(args)


if __name__ == "__main__":
    main()
