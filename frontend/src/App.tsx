import { useEffect, useState, useCallback, useRef } from "react";
import { History, AlertCircle } from "lucide-react";
import type { Analysis, GenerateOptions, GenerateResponse, Usage } from "./api";
import {
  checkHealth,
  analyzeJD,
  generateMaterials,
  getJobFile,
  cancelGeneration,
  getGenerateStatus,
} from "./api";
import InputPanel from "./components/InputPanel";
import OutputPanel from "./components/OutputPanel";
import HistoryDrawer from "./components/HistoryDrawer";
import UsagePopover from "./components/UsagePopover";

export default function App() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [jobDir, setJobDir] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [phase2, setPhase2] = useState<GenerateResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatePhase, setGeneratePhase] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [usageRefreshKey, setUsageRefreshKey] = useState(0);
  const [analyzeUsage, setAnalyzeUsage] = useState<Usage | null>(null);
  const [generateUsage, setGenerateUsage] = useState<{ total: Usage } | null>(
    null
  );
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

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

  const refreshUsage = useCallback(() => {
    setUsageRefreshKey((k) => k + 1);
  }, []);

  const handleAnalyze = useCallback(
    async (jdText: string, company: string) => {
      setIsAnalyzing(true);
      setError(null);
      setAnalysis(null);
      setPhase2(null);
      setJobDir(null);
      setAnalyzeUsage(null);
      setGenerateUsage(null);
      try {
        const res = await analyzeJD(jdText, company);
        setJobDir(res.job_dir);
        setAnalysis(res.analysis);
        setAnalyzeUsage(res.usage);
        refreshUsage();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [refreshUsage]
  );

  const handleGenerate = useCallback(
    async (options: GenerateOptions) => {
      if (!jobDir) return;
      setIsGenerating(true);
      setGeneratePhase("starting");
      setError(null);
      setGenerateUsage(null);

      // Start polling for progress
      pollRef.current = setInterval(async () => {
        try {
          const status = await getGenerateStatus();
          setGeneratePhase(status.phase);
        } catch {
          /* ignore */
        }
      }, 2000);

      try {
        const res = await generateMaterials(jobDir, options);
        setPhase2(res);
        if (res.usage?.total) {
          setGenerateUsage({ total: res.usage.total });
        }
        if (res.status === "cancelled") {
          setError("Generation cancelled. Partial results available.");
        }
        refreshUsage();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Generation failed");
      } finally {
        if (pollRef.current) clearInterval(pollRef.current);
        setIsGenerating(false);
        setGeneratePhase("idle");
      }
    },
    [jobDir, refreshUsage]
  );

  const handleCancelGenerate = useCallback(async () => {
    try {
      await cancelGeneration();
    } catch {
      /* ignore */
    }
  }, []);

  const handleHistorySelect = useCallback(async (dir: string) => {
    setError(null);
    setPhase2(null);
    setJobDir(dir);
    setAnalyzeUsage(null);
    setGenerateUsage(null);
    try {
      const raw = await getJobFile(dir, "phase1_analysis.json");
      setAnalysis(JSON.parse(raw));

      const resume = await getJobFile(dir, "resume_tailored.tex").catch(
        () => null
      );
      const cover = await getJobFile(dir, "cover_letter.md").catch(() => null);
      const qa = await getJobFile(dir, "qa_answers.md").catch(() => null);
      if (resume || cover || qa) {
        setPhase2({
          status: "complete",
          completed: ["resume", "cover_letter", "qa"],
          resume_tex: resume ? `jobs/${dir}/resume_tailored.tex` : "",
          resume_pdf: null,
          cover_letter: cover ? `jobs/${dir}/cover_letter.md` : null,
          qa_answers: qa ? `jobs/${dir}/qa_answers.md` : null,
          usage: { total: { input_tokens: 0, output_tokens: 0 } },
        });
      }
    } catch {
      setError(`Could not load analysis for ${dir}`);
      setAnalysis(null);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-xl font-bold tracking-tight">autoCV</h1>
        <div className="flex items-center gap-2">
          <UsagePopover refreshKey={usageRefreshKey} />
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg
                       bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
          >
            <History size={16} />
            History
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div
          className="mx-6 mt-3 px-4 py-2 rounded-lg bg-red-50 border border-red-300
                        text-red-700 text-sm flex items-center gap-2"
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Backend down banner */}
      {backendOk === false && (
        <div
          className="mx-6 mt-3 px-4 py-2 rounded-lg bg-red-50 border border-red-300
                        text-red-700 text-sm flex items-center gap-2"
        >
          <AlertCircle size={16} />
          Backend not reachable. Start the server:{" "}
          <code className="ml-1">python -m backend.server</code>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Input panel - 35% */}
        <div className="w-[35%] border-r border-gray-200 p-5 overflow-y-auto bg-white">
          <InputPanel
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            isGenerating={isGenerating}
            generatePhase={generatePhase}
            analyzeUsage={analyzeUsage}
            generateUsage={generateUsage}
            onAnalyze={handleAnalyze}
            onGenerate={handleGenerate}
            onCancelGenerate={handleCancelGenerate}
          />
        </div>

        {/* Output panel - 65% */}
        <div className="w-[65%] p-5 overflow-hidden">
          <OutputPanel
            analysis={analysis}
            phase2={phase2}
            jobDir={jobDir}
            onUsageUpdate={refreshUsage}
          />
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
