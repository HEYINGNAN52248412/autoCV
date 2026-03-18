import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { Analysis, GenerateOptions, Template, Usage } from "../api";
import { getTemplates } from "../api";
import LoadingSpinner from "./LoadingSpinner";
import ScoreBadge from "./ScoreBadge";

interface Props {
  analysis: Analysis | null;
  isAnalyzing: boolean;
  isGenerating: boolean;
  generatePhase: string;
  analyzeUsage: Usage | null;
  generateUsage: { total: Usage } | null;
  onAnalyze: (jdText: string, company: string) => void;
  onGenerate: (options: GenerateOptions) => void;
  onCancelGenerate: () => void;
}

const recStyles: Record<string, string> = {
  apply: "bg-green-600 text-white",
  consider: "bg-yellow-600 text-white",
  skip: "bg-red-600 text-white",
};

const phaseLabels: Record<string, string> = {
  resume: "Generating resume...",
  cover_letter: "Generating cover letter...",
  qa: "Generating Q&A answers...",
  starting: "Starting generation...",
};

function fmtTokens(n: number): string {
  return n.toLocaleString();
}

export default function InputPanel({
  analysis,
  isAnalyzing,
  isGenerating,
  generatePhase,
  analyzeUsage,
  generateUsage,
  onAnalyze,
  onGenerate,
  onCancelGenerate,
}: Props) {
  const [company, setCompany] = useState("");
  const [jdText, setJdText] = useState("");
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("resume.tex");
  const [genResume, setGenResume] = useState(true);
  const [genCover, setGenCover] = useState(false);
  const [genQa, setGenQa] = useState(false);

  const hasQuestions = questions.trim().length > 0;

  useEffect(() => {
    getTemplates().then(setTemplates).catch(() => {});
  }, []);

  // Auto-uncheck QA when questions are cleared
  useEffect(() => {
    if (!hasQuestions) setGenQa(false);
  }, [hasQuestions]);

  const canAnalyze =
    company.trim() && jdText.trim() && !isAnalyzing && !isGenerating;

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Company name */}
      <div>
        <label className="block text-sm font-medium text-gray-500 mb-1">
          Company Name
        </label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="e.g. Google"
          className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300
                     text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* JD textarea */}
      <div className="flex-1 flex flex-col min-h-0">
        <label className="block text-sm font-medium text-gray-500 mb-1">
          Job Description
        </label>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the job description here..."
          className="flex-1 w-full px-3 py-2 rounded-lg bg-white border border-gray-300
                     text-gray-900 placeholder-gray-400 resize-none focus:outline-none
                     focus:border-blue-500 min-h-[200px]"
        />
      </div>

      {/* Analyze button */}
      <button
        onClick={() => onAnalyze(jdText, company)}
        disabled={!canAnalyze}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                   bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 disabled:text-gray-400
                   text-white font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        <Send size={16} />
        Analyze
      </button>

      {isAnalyzing && <LoadingSpinner label="Analyzing JD..." />}

      {/* Phase 1 usage */}
      {analyzeUsage && !isAnalyzing && (
        <p className="text-xs text-gray-400">
          Phase 1: {fmtTokens(analyzeUsage.input_tokens + analyzeUsage.output_tokens)} tokens
        </p>
      )}

      {/* Analysis summary */}
      {analysis && (
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between">
            <ScoreBadge score={analysis.match_score} />
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold uppercase ${recStyles[analysis.recommendation] || "bg-gray-400"}`}
            >
              {analysis.recommendation}
            </span>
          </div>

          {/* Strengths */}
          <div className="flex flex-wrap gap-1.5">
            {analysis.strengths.map((s, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs rounded bg-green-50 text-green-700"
              >
                {s}
              </span>
            ))}
          </div>

          {/* Gaps */}
          <div className="flex flex-wrap gap-1.5">
            {analysis.gaps.map((g, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs rounded bg-red-50 text-red-700"
              >
                {g}
              </span>
            ))}
          </div>

          {/* Optional questions */}
          <button
            onClick={() => setShowQuestions(!showQuestions)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            {showQuestions ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            Application Questions (optional)
          </button>
          {showQuestions && (
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="Paste application-specific questions here..."
              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300
                         text-gray-900 placeholder-gray-400 resize-none focus:outline-none
                         focus:border-blue-500 h-24"
            />
          )}

          {/* Template selector (only if multiple templates exist) */}
          {templates.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Resume Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300
                           text-gray-900 focus:outline-none focus:border-blue-500"
              >
                {templates.map((t) => (
                  <option key={t.filename} value={t.filename}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Generation checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={genResume}
                onChange={(e) => setGenResume(e.target.checked)}
                className="rounded"
              />
              Resume
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={genCover}
                onChange={(e) => setGenCover(e.target.checked)}
                className="rounded"
              />
              Cover Letter
            </label>
            <label
              className={`flex items-center gap-2 text-sm ${
                hasQuestions
                  ? "text-gray-700 cursor-pointer"
                  : "text-gray-400 cursor-not-allowed"
              }`}
            >
              <input
                type="checkbox"
                checked={genQa}
                onChange={(e) => setGenQa(e.target.checked)}
                disabled={!hasQuestions}
                className="rounded"
              />
              Application Questions
            </label>
          </div>

          {/* Generate / Cancel button */}
          {isGenerating ? (
            <button
              onClick={onCancelGenerate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                         bg-red-600 hover:bg-red-500 text-white font-medium transition-colors
                         cursor-pointer"
            >
              <XCircle size={16} />
              Cancel
            </button>
          ) : (
            <button
              onClick={() =>
                onGenerate({
                  questions,
                  template: selectedTemplate,
                  generate_resume: genResume,
                  generate_cover: genCover,
                  generate_qa: genQa,
                })
              }
              disabled={isGenerating || (!genResume && !genCover && !genQa)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                         bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200
                         disabled:text-gray-400 text-white font-medium transition-colors
                         cursor-pointer disabled:cursor-not-allowed"
            >
              <Sparkles size={16} />
              Generate Selected
            </button>
          )}

          {isGenerating && (
            <LoadingSpinner
              label={phaseLabels[generatePhase] || "Generating..."}
            />
          )}

          {/* Phase 2 usage */}
          {generateUsage && !isGenerating && (
            <p className="text-xs text-gray-400">
              Phase 2: {fmtTokens(generateUsage.total.input_tokens + generateUsage.total.output_tokens)} tokens
            </p>
          )}
        </div>
      )}
    </div>
  );
}
