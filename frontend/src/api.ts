export interface HealthResponse {
  status: string;
  knowledge_base_loaded: boolean;
}

export interface Analysis {
  company_overview: string;
  role_summary: string;
  hard_requirements: string[];
  soft_requirements: string[];
  skill_match: {
    skill: string;
    jd_asks: string;
    you_have: string;
    match: "strong" | "partial" | "weak" | "none";
  }[];
  match_score: number;
  match_reasoning: string;
  strengths: string[];
  gaps: string[];
  recommendation: "apply" | "consider" | "skip";
  resume_focus_hints: string[];
}

export interface AnalyzeResponse {
  job_dir: string;
  analysis: Analysis;
}

export interface GenerateResponse {
  resume_tex: string;
  resume_pdf: string | null;
  cover_letter: string | null;
  qa_answers: string | null;
}

export interface JobEntry {
  dir: string;
  company: string;
  date: string;
  has_phase1: boolean;
  has_resume: boolean;
  has_resume_pdf: boolean;
  has_cover_letter: boolean;
  has_qa: boolean;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export function checkHealth() {
  return request<HealthResponse>("/api/health");
}

export function analyzeJD(jdText: string, companyName: string) {
  return request<AnalyzeResponse>("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd_text: jdText, company_name: companyName }),
  });
}

export function generateMaterials(jobDir: string, questions = "") {
  return request<GenerateResponse>("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_dir: jobDir, questions }),
  });
}

export function listJobs() {
  return request<JobEntry[]>("/api/jobs");
}

export async function getJobFile(jobDir: string, filename: string): Promise<string> {
  const res = await fetch(`/api/jobs/${jobDir}/files/${filename}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return JSON.stringify(await res.json(), null, 2);
  }
  return res.text();
}

export function getJobFileUrl(jobDir: string, filename: string) {
  return `/api/jobs/${jobDir}/files/${filename}`;
}
