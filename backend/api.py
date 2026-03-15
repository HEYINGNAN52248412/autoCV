"""FastAPI REST API wrapping the existing autoCV CLI logic."""

import json
import threading
from datetime import date
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, PlainTextResponse, JSONResponse
from pydantic import BaseModel

from src.config import KNOWLEDGE_BASE_PATH, JOBS_PATH
from src.knowledge import load_knowledge_base
from src.phase1_analyze import run_phase1
from src.phase2_generate import generate_resume, generate_cover_letter, generate_qa, answer_questions
from backend.usage_tracker import record as record_usage, get_summary as get_usage_summary

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
# Generation state (cancel + progress)
# ---------------------------------------------------------------------------
_generate_lock = threading.Lock()
_generate_state = {
    "phase": "idle",
    "completed": [],
    "cancel_requested": False,
}


def _set_phase(phase: str) -> None:
    with _generate_lock:
        _generate_state["phase"] = phase


def _mark_completed(step: str) -> None:
    with _generate_lock:
        _generate_state["completed"].append(step)


def _is_cancelled() -> bool:
    with _generate_lock:
        return _generate_state["cancel_requested"]


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    jd_text: str
    company_name: str


class GenerateRequest(BaseModel):
    job_dir: str
    questions: str = ""


class QaRequest(BaseModel):
    job_dir: str
    questions: list[str]


class JdTextBody(BaseModel):
    text: str


# ---------------------------------------------------------------------------
# Helper: save per-job usage.json
# ---------------------------------------------------------------------------
def _save_job_usage(job_dir: Path, phase: str, usage: dict) -> None:
    """Append a phase's usage to the job's usage.json and update totals."""
    usage_file = job_dir / "usage.json"
    if usage_file.exists():
        try:
            data = json.loads(usage_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            data = {}
    else:
        data = {}

    data[phase] = usage

    # Recalculate total
    total_in = 0
    total_out = 0
    for k, v in data.items():
        if k != "total" and isinstance(v, dict):
            total_in += v.get("input_tokens", 0)
            total_out += v.get("output_tokens", 0)
    data["total"] = {"input_tokens": total_in, "output_tokens": total_out}

    usage_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


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

    knowledge = _get_knowledge()

    analysis = run_phase1(jd_text, knowledge, str(job_dir))

    # Extract usage (added by run_phase1)
    usage = analysis.pop("usage", {})

    if not analysis:
        raise HTTPException(status_code=500, detail="Phase 1 analysis failed. Check server logs.")

    # Track usage
    if usage:
        record_usage(dir_name, "phase1", usage.get("input_tokens", 0), usage.get("output_tokens", 0))
        _save_job_usage(job_dir, "phase1", usage)

    return {"job_dir": dir_name, "analysis": analysis, "usage": usage}


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

    company = dir_name.rsplit("_", 1)[0].replace("_", " ").title()
    knowledge = _get_knowledge()
    questions = req.questions

    # Reset cancel state
    with _generate_lock:
        _generate_state["phase"] = "resume"
        _generate_state["completed"] = []
        _generate_state["cancel_requested"] = False

    all_usage = {}
    result = {
        "status": "complete",
        "completed": [],
        "resume_tex": str(job_dir / "resume_tailored.tex"),
        "resume_pdf": None,
        "cover_letter": None,
        "qa_answers": None,
        "usage": {},
    }

    # Step 1: Resume
    pdf_path, resume_usage = generate_resume(jd_text, knowledge, analysis, str(job_dir))
    result["resume_pdf"] = pdf_path
    all_usage["resume"] = resume_usage
    _mark_completed("resume")
    if resume_usage:
        record_usage(dir_name, "phase2_resume", resume_usage.get("input_tokens", 0), resume_usage.get("output_tokens", 0))
        _save_job_usage(job_dir, "phase2_resume", resume_usage)

    # Check cancel
    if _is_cancelled():
        _set_phase("cancelled")
        result["status"] = "cancelled"
        result["completed"] = list(_generate_state["completed"])
        result["usage"] = _build_usage_summary(all_usage)
        return result

    # Step 2: Cover letter
    _set_phase("cover_letter")
    cl_path, cover_usage = generate_cover_letter(jd_text, knowledge, analysis, company, str(job_dir))
    result["cover_letter"] = cl_path or None
    all_usage["cover_letter"] = cover_usage
    _mark_completed("cover_letter")
    if cover_usage:
        record_usage(dir_name, "phase2_cover", cover_usage.get("input_tokens", 0), cover_usage.get("output_tokens", 0))
        _save_job_usage(job_dir, "phase2_cover", cover_usage)

    # Check cancel
    if _is_cancelled():
        _set_phase("cancelled")
        result["status"] = "cancelled"
        result["completed"] = list(_generate_state["completed"])
        result["usage"] = _build_usage_summary(all_usage)
        return result

    # Step 3: Q&A
    _set_phase("qa")
    qa_path, qa_usage = generate_qa(jd_text, knowledge, analysis, questions, str(job_dir))
    result["qa_answers"] = qa_path or None
    all_usage["qa"] = qa_usage
    _mark_completed("qa")
    if qa_usage:
        record_usage(dir_name, "phase2_qa", qa_usage.get("input_tokens", 0), qa_usage.get("output_tokens", 0))
        _save_job_usage(job_dir, "phase2_qa", qa_usage)

    _set_phase("idle")
    result["completed"] = ["resume", "cover_letter", "qa"]
    result["usage"] = _build_usage_summary(all_usage)
    return result


def _build_usage_summary(all_usage: dict) -> dict:
    total_in = sum(u.get("input_tokens", 0) for u in all_usage.values())
    total_out = sum(u.get("output_tokens", 0) for u in all_usage.values())
    return {
        **all_usage,
        "total": {"input_tokens": total_in, "output_tokens": total_out},
    }


@router.post("/generate/cancel")
def cancel_generate():
    with _generate_lock:
        _generate_state["cancel_requested"] = True
    return {"status": "cancel_requested"}


@router.get("/generate/status")
def generate_status():
    with _generate_lock:
        return {
            "phase": _generate_state["phase"],
            "completed": list(_generate_state["completed"]),
        }


@router.post("/qa")
def interactive_qa(req: QaRequest):
    dir_name = req.job_dir.strip()
    if not dir_name or not req.questions:
        raise HTTPException(status_code=400, detail="job_dir and questions are required")

    job_dir = JOBS_PATH / dir_name
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail=f"Job directory not found: {dir_name}")

    analysis_file = job_dir / "phase1_analysis.json"
    if not analysis_file.exists():
        raise HTTPException(status_code=404, detail="No phase1_analysis.json found.")

    analysis = json.loads(analysis_file.read_text(encoding="utf-8"))
    jd_text = (job_dir / "jd.txt").read_text(encoding="utf-8")
    knowledge = _get_knowledge()

    answers, usage = answer_questions(jd_text, knowledge, analysis, req.questions, str(job_dir))

    if usage:
        record_usage(dir_name, "interactive_qa", usage.get("input_tokens", 0), usage.get("output_tokens", 0))
        _save_job_usage(job_dir, "interactive_qa", usage)

    return {"answers": answers, "usage": usage}


@router.get("/usage")
def usage_summary():
    return get_usage_summary()


@router.get("/jobs")
def list_jobs():
    if not JOBS_PATH.exists():
        return []

    results = []
    for d in sorted(JOBS_PATH.iterdir()):
        if not d.is_dir():
            continue
        name = d.name
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
