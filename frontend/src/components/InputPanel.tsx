import { useState } from "react";
import { ChevronDown, ChevronRight, Send, Sparkles } from "lucide-react";
import type { Analysis } from "../api";
import LoadingSpinner from "./LoadingSpinner";
import ScoreBadge from "./ScoreBadge";

interface Props {
  analysis: Analysis | null;
  isAnalyzing: boolean;
  isGenerating: boolean;
  onAnalyze: (jdText: string, company: string) => void;
  onGenerate: (questions: string) => void;
}

const recStyles: Record<string, string> = {
  apply: "bg-green-600 text-white",
  consider: "bg-yellow-600 text-white",
  skip: "bg-red-600 text-white",
};

export default function InputPanel({
  analysis,
  isAnalyzing,
  isGenerating,
  onAnalyze,
  onGenerate,
}: Props) {
  const [company, setCompany] = useState("");
  const [jdText, setJdText] = useState("");
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState("");

  const canAnalyze = company.trim() && jdText.trim() && !isAnalyzing && !isGenerating;

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Company name */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Company Name</label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="e.g. Google"
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700
                     text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* JD textarea */}
      <div className="flex-1 flex flex-col min-h-0">
        <label className="block text-sm font-medium text-gray-400 mb-1">Job Description</label>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the job description here..."
          className="flex-1 w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700
                     text-gray-100 placeholder-gray-500 resize-none focus:outline-none
                     focus:border-blue-500 min-h-[200px]"
        />
      </div>

      {/* Analyze button */}
      <button
        onClick={() => onAnalyze(jdText, company)}
        disabled={!canAnalyze}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                   bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500
                   text-white font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        <Send size={16} />
        Analyze
      </button>

      {isAnalyzing && <LoadingSpinner label="Analyzing JD..." />}

      {/* Analysis summary */}
      {analysis && (
        <div className="space-y-4 border-t border-gray-700 pt-4">
          <div className="flex items-center justify-between">
            <ScoreBadge score={analysis.match_score} />
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold uppercase ${recStyles[analysis.recommendation] || "bg-gray-600"}`}
            >
              {analysis.recommendation}
            </span>
          </div>

          {/* Strengths */}
          <div className="flex flex-wrap gap-1.5">
            {analysis.strengths.map((s, i) => (
              <span key={i} className="px-2 py-0.5 text-xs rounded bg-green-900/60 text-green-300">
                {s}
              </span>
            ))}
          </div>

          {/* Gaps */}
          <div className="flex flex-wrap gap-1.5">
            {analysis.gaps.map((g, i) => (
              <span key={i} className="px-2 py-0.5 text-xs rounded bg-red-900/60 text-red-300">
                {g}
              </span>
            ))}
          </div>

          {/* Optional questions */}
          <button
            onClick={() => setShowQuestions(!showQuestions)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-300 cursor-pointer"
          >
            {showQuestions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Application Questions (optional)
          </button>
          {showQuestions && (
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="Paste application-specific questions here..."
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700
                         text-gray-100 placeholder-gray-500 resize-none focus:outline-none
                         focus:border-blue-500 h-24"
            />
          )}

          {/* Generate button */}
          <button
            onClick={() => onGenerate(questions)}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                       bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700
                       disabled:text-gray-500 text-white font-medium transition-colors
                       cursor-pointer disabled:cursor-not-allowed"
          >
            <Sparkles size={16} />
            Generate Materials
          </button>
          {isGenerating && <LoadingSpinner label="Generating resume, cover letter & Q&A..." />}
        </div>
      )}
    </div>
  );
}
