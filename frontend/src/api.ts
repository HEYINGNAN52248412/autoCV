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

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnalyzeResponse {
  job_dir: string;
  analysis: Analysis;
  usage: Usage;
}

export interface GenerateResponse {
  status: "complete" | "cancelled";
  completed: string[];
  resume_tex: string;
  resume_pdf: string | null;
  cover_letter: string | null;
  qa_answers: string | null;
  usage: {
    resume?: Usage;
    cover_letter?: Usage;
    qa?: Usage;
    total: Usage;
  };
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

export interface QaAnswer {
  question: string;
  answer: string;
}

export interface QaResponse {
  answers: QaAnswer[];
  usage: Usage;
}

export interface GenerateStatus {
  phase: string;
  completed: string[];
}

export interface UsageSummary {
  total_input_tokens: number;
  total_output_tokens: number;
  total_calls: number;
  history: {
    timestamp: string;
    job: string;
    phase: string;
    input_tokens: number;
    output_tokens: number;
  }[];
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

export function cancelGeneration() {
  return request<{ status: string }>("/api/generate/cancel", { method: "POST" });
}

export function getGenerateStatus() {
  return request<GenerateStatus>("/api/generate/status");
}

export function askQuestions(jobDir: string, questions: string[]) {
  return request<QaResponse>("/api/qa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_dir: jobDir, questions }),
  });
}

export function getUsage() {
  return request<UsageSummary>("/api/usage");
}

export function listJobs() {
  return request<JobEntry[]>("/api/jobs");
}

export async function getJobFile(
  jobDir: string,
  filename: string
): Promise<string> {
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
