# autoCV

AI-powered job application assistant that analyzes job descriptions against your background and generates tailored resumes, cover letters, and Q&A answers.

## How it works

autoCV runs a two-phase pipeline with a human gate in between:

```
                          YOU DECIDE
                          whether to
JD file ──> Phase 1 ──>  proceed or  ──> Phase 2 ──> Tailored resume (.tex/.pdf)
            Analyze      skip this       Generate     Cover letter (.md)
            & Score      application                  Q&A answers (.md)
```

**Phase 1** reads your knowledge base (resume, experience notes) and the job description, then produces a structured analysis: match score, skill matrix, strengths, gaps, and an apply/consider/skip recommendation.

**Phase 2** generates a tailored LaTeX resume, a cover letter, and answers to application questions — all grounded in your actual experience.

## Tech stack

- Python 3.10+
- Anthropic Claude API (via `anthropic` SDK)
- PyMuPDF — PDF text extraction for knowledge base
- XeLaTeX — PDF compilation for generated resumes
- Rich — terminal UI
- FastAPI + Uvicorn — REST API backend
- React + TypeScript + Tailwind CSS — web GUI

## Setup

```bash
git clone https://github.com/youruser/autoCV.git
cd autoCV

# Create and activate virtual environment
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

pip install -r requirements.txt
pip install fastapi uvicorn python-multipart

# Build the web frontend
cd frontend && npm install && npm run build && cd ..
```

Copy `.env.example` to `.env` and fill in your API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

**Optional:** Install [TeX Live](https://tug.org/texlive/) for automatic PDF compilation. Without it, autoCV will still generate the `.tex` file — you can compile it manually.

### Knowledge base

Place your personal files in `knowledge_base/`:

| File | Purpose |
|------|---------|
| `resume.pdf` | Current resume (text is extracted automatically) |
| `resume.tex` | LaTeX source used as a template for tailored resumes |
| `experience.md` | Detailed experience notes — projects, metrics, technologies |

`experience.md` follows a structured format with sections for each role: company, title, dates, and bullet points covering projects, impact, and technologies used. The more detail you provide, the better the tailored output.

## One-Click Launch

After setup is complete, just double-click a launcher file — no terminal needed:

| Platform | File | Notes |
|----------|------|-------|
| Windows | `launcher.pyw` | Runs silently (no console window) |
| Windows | `start.bat` | Shows a console window (useful for debugging) |
| macOS/Linux | `launcher.sh` | Make executable first: `chmod +x launcher.sh` |

The launcher starts the server, waits for it to be ready, and opens your browser to `http://localhost:8000`.

To create a desktop shortcut:
- **Windows:** Right-click `launcher.pyw` → Send to → Desktop (create shortcut)
- **macOS/Linux:** `ln -s /path/to/autoCV/launcher.sh ~/Desktop/autoCV`

To stop: close the browser tab and terminate the process (Task Manager, or Ctrl+C if using `start.bat`).

## Usage

### Web GUI

```bash
python -m backend.server
# Open http://localhost:8000
```

Or use the one-click launchers described above.

### CLI

#### Analyze a job description (Phase 1 + optional Phase 2)

```bash
python -m src.main analyze --jd-file jds/company.txt --company "Company"
```

This runs the analysis, displays results in the terminal, and prompts you to proceed to Phase 2. You can also enter the JD interactively by omitting `--jd-file`.

#### Generate materials from an existing analysis (Phase 2 only)

```bash
python -m src.main generate --job company_20260315 --questions "Why do you want to work here?"
```

> **Windows note:** Save JD files as UTF-8 to avoid encoding issues.

### Development (frontend hot-reload)

```bash
# Terminal 1 — backend
python -m backend.server

# Terminal 2 — frontend dev server with hot-reload
cd frontend && npm run dev
# Open http://localhost:5173 (proxies API calls to :8000)
```

## Output structure

Each job gets its own directory under `jobs/`:

```
jobs/
  company_20260315/
    jd.txt                  # Raw job description
    phase1_analysis.json    # Structured analysis data
    phase1_analysis.md      # Human-readable analysis report
    resume_tailored.tex     # Tailored LaTeX resume
    resume_tailored.pdf     # Compiled PDF (if xelatex available)
    cover_letter.md         # Tailored cover letter
    qa_answers.md           # Answers to application questions
```

## Roadmap

- n8n workflow integration for automated JD ingestion
- Batch processing for multiple job applications

## License

MIT
