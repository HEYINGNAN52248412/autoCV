"""FastAPI REST API wrapping the existing autoCV CLI logic."""

import json
from datetime import date
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, PlainTextResponse, JSONResponse
from pydantic import BaseModel

from src.config import KNOWLEDGE_BASE_PATH, JOBS_PATH
from src.knowledge import load_knowledge_base
from src.phase1_analyze import run_phase1
from src.phase2_generate import generate_resume, generate_cover_letter, generate_qa

router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Module-level knowledge base cache
# ---------------------------------------------------------------------------
_knowledge_cache: str | None = None


def _get_knowledge() -> str:
    """Return the cached knowledge base, loading it on first call."""
    global _knowledge_cache
    if _knowledge_cache is None:
        _knowledge_cache = load_knowledge_base(str(KNOWLEDGE_BASE_PATH))
    return _knowledge_cache


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    jd_text: str
    company_name: str


class GenerateRequest(BaseModel):
    job_dir: str
    questions: str = ""


class JdTextBody(BaseModel):
    text: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/health")
def health():
    return {
        "status": "ok",
        "knowledge_base_loaded": _knowledge_cache is not None,
    }


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    jd_text = req.jd_text.strip()
    company = req.company_name.strip()

    if not jd_text:
        raise HTTPException(status_code=400, detail="jd_text must not be empty")
    if not company:
        raise HTTPException(status_code=400, detail="company_name must not be empty")

    # Create job directory (mirrors main.py logic)
    date_str = date.today().strftime("%Y%m%d")
    dir_name = f"{company.lower().replace(' ', '_')}_{date_str}"
    job_dir = JOBS_PATH / dir_name
    job_dir.mkdir(parents=True, exist_ok=True)

    # Save raw JD
    (job_dir / "jd.txt").write_text(jd_text, encoding="utf-8")

    # Load knowledge base (cached)
    knowledge = _get_knowledge()

    # Run Phase 1
    analysis = run_phase1(jd_text, knowledge, str(job_dir))
    if not analysis:
        raise HTTPException(status_code=500, detail="Phase 1 analysis failed. Check server logs.")

    return {"job_dir": dir_name, "analysis": analysis}


@router.post("/generate")
def generate(req: GenerateRequest):
    dir_name = req.job_dir.strip()
    if not dir_name:
        raise HTTPException(status_code=400, detail="job_dir must not be empty")

    job_dir = JOBS_PATH / dir_name
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail=f"Job directory not found: {dir_name}")

    analysis_file = job_dir / "phase1_analysis.json"
    if not analysis_file.exists():
        raise HTTPException(status_code=404, detail="No phase1_analysis.json in job directory. Run /api/analyze first.")

    analysis = json.loads(analysis_file.read_text(encoding="utf-8"))

    jd_file = job_dir / "jd.txt"
    if not jd_file.exists():
        raise HTTPException(status_code=404, detail="No jd.txt found in job directory.")
    jd_text = jd_file.read_text(encoding="utf-8")

    # Extract company name from directory name
    company = dir_name.rsplit("_", 1)[0].replace("_", " ").title()

    knowledge = _get_knowledge()
    questions = req.questions

    # Run all three Phase 2 generators
    pdf_path = generate_resume(jd_text, knowledge, analysis, str(job_dir))
    cl_path = generate_cover_letter(jd_text, knowledge, analysis, company, str(job_dir))
    qa_path = generate_qa(jd_text, knowledge, analysis, questions, str(job_dir))

    return {
        "resume_tex": str(job_dir / "resume_tailored.tex"),
        "resume_pdf": pdf_path,
        "cover_letter": cl_path or None,
        "qa_answers": qa_path or None,
    }


@router.get("/jobs")
def list_jobs():
    if not JOBS_PATH.exists():
        return []

    results = []
    for d in sorted(JOBS_PATH.iterdir()):
        if not d.is_dir():
            continue
        name = d.name
        # Try to split company_YYYYMMDD
        parts = name.rsplit("_", 1)
        if len(parts) == 2 and parts[1].isdigit():
            company = parts[0].replace("_", " ").title()
            date_str = parts[1]
        else:
            company = name
            date_str = ""

        results.append({
            "dir": name,
            "company": company,
            "date": date_str,
            "has_phase1": (d / "phase1_analysis.json").exists(),
            "has_resume": (d / "resume_tailored.tex").exists(),
            "has_resume_pdf": (d / "resume_tailored.pdf").exists(),
            "has_cover_letter": (d / "cover_letter.md").exists(),
            "has_qa": (d / "qa_answers.md").exists(),
        })

    return results


@router.get("/jobs/{job_dir}/files/{filename}")
def get_job_file(job_dir: str, filename: str):
    file_path = JOBS_PATH / job_dir / filename

    # Prevent path traversal
    try:
        file_path.resolve().relative_to(JOBS_PATH.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

    suffix = file_path.suffix.lower()

    if suffix == ".json":
        data = json.loads(file_path.read_text(encoding="utf-8"))
        return JSONResponse(content=data)
    elif suffix in (".md", ".tex", ".txt"):
        text = file_path.read_text(encoding="utf-8")
        return PlainTextResponse(content=text)
    elif suffix == ".pdf":
        return FileResponse(path=str(file_path), media_type="application/pdf", filename=filename)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")


@router.post("/jd/upload")
async def upload_jd(file: UploadFile | None = File(None), text: str | None = Form(None)):
    """Accept a .txt file upload OR raw text in form body."""
    jd_text = None

    if file is not None:
        raw = await file.read()
        # Try multiple encodings (mirrors existing fix)
        for enc in ("utf-8-sig", "utf-16", "utf-8", "gbk"):
            try:
                jd_text = raw.decode(enc)
                break
            except (UnicodeDecodeError, UnicodeError):
                continue
        if jd_text is None:
            raise HTTPException(status_code=400, detail="Could not decode file. Tried utf-8-sig, utf-16, utf-8, gbk.")
    elif text is not None:
        jd_text = text
    else:
        raise HTTPException(status_code=400, detail="Provide either a file upload or 'text' form field.")

    jd_text = jd_text.strip()
    if not jd_text:
        raise HTTPException(status_code=400, detail="JD text is empty.")

    return {"jd_text": jd_text, "length": len(jd_text)}
