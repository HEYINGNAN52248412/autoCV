import { useEffect, useState, useCallback } from "react";
import { History, AlertCircle } from "lucide-react";
import type { Analysis, GenerateResponse } from "./api";
import { checkHealth, analyzeJD, generateMaterials, getJobFile } from "./api";
import InputPanel from "./components/InputPanel";
import OutputPanel from "./components/OutputPanel";
import HistoryDrawer from "./components/HistoryDrawer";

export default function App() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [jobDir, setJobDir] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [phase2, setPhase2] = useState<GenerateResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Health check on mount
  useEffect(() => {
    checkHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  // Auto-dismiss errors
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [error]);

  const handleAnalyze = useCallback(async (jdText: string, company: string) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setPhase2(null);
    setJobDir(null);
    try {
      const res = await analyzeJD(jdText, company);
      setJobDir(res.job_dir);
      setAnalysis(res.analysis);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleGenerate = useCallback(
    async (questions: string) => {
      if (!jobDir) return;
      setIsGenerating(true);
      setError(null);
      try {
        const res = await generateMaterials(jobDir, questions);
        setPhase2(res);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setIsGenerating(false);
      }
    },
    [jobDir]
  );

  const handleHistorySelect = useCallback(async (dir: string) => {
    setError(null);
    setPhase2(null);
    setJobDir(dir);
    try {
      const raw = await getJobFile(dir, "phase1_analysis.json");
      setAnalysis(JSON.parse(raw));

      // Check if phase2 files exist by trying to fetch them
      const resume = await getJobFile(dir, "resume_tailored.tex").catch(() => null);
      const cover = await getJobFile(dir, "cover_letter.md").catch(() => null);
      const qa = await getJobFile(dir, "qa_answers.md").catch(() => null);
      if (resume || cover || qa) {
        setPhase2({
          resume_tex: resume ? `jobs/${dir}/resume_tailored.tex` : "",
          resume_pdf: null,
          cover_letter: cover ? `jobs/${dir}/cover_letter.md` : null,
          qa_answers: qa ? `jobs/${dir}/qa_answers.md` : null,
        });
      }
    } catch {
      setError(`Could not load analysis for ${dir}`);
      setAnalysis(null);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
        <h1 className="text-xl font-bold tracking-tight">autoCV</h1>
        <button
          onClick={() => setHistoryOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg
                     bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors cursor-pointer"
        >
          <History size={16} />
          History
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-red-900/60 border border-red-700
                        text-red-200 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Backend down banner */}
      {backendOk === false && (
        <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-red-900/60 border border-red-700
                        text-red-200 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          Backend not reachable. Start the server: <code className="ml-1">python -m backend.server</code>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Input panel — 35% */}
        <div className="w-[35%] border-r border-gray-800 p-5 overflow-y-auto">
          <InputPanel
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            isGenerating={isGenerating}
            onAnalyze={handleAnalyze}
            onGenerate={handleGenerate}
          />
        </div>

        {/* Output panel — 65% */}
        <div className="w-[65%] p-5 overflow-hidden">
          <OutputPanel analysis={analysis} phase2={phase2} jobDir={jobDir} />
        </div>
      </div>

      {/* History drawer */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleHistorySelect}
      />
    </div>
  );
}
