import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import type { Analysis, GenerateResponse } from "../api";
import { getJobFile, getJobFileUrl } from "../api";
import CopyButton from "./CopyButton";
import ScoreBadge from "./ScoreBadge";

type Tab = "analysis" | "resume" | "cover" | "qa";

interface Props {
  analysis: Analysis | null;
  phase2: GenerateResponse | null;
  jobDir: string | null;
}

const matchColors: Record<string, string> = {
  strong: "text-green-400",
  partial: "text-yellow-400",
  weak: "text-red-400",
  none: "text-red-500",
};

export default function OutputPanel({ analysis, phase2, jobDir }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("analysis");
  const [resumeTex, setResumeTex] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [qaAnswers, setQaAnswers] = useState<string | null>(null);

  // Load file contents when phase2 arrives
  useEffect(() => {
    if (!phase2 || !jobDir) return;

    getJobFile(jobDir, "resume_tailored.tex").then(setResumeTex).catch(() => {});
    getJobFile(jobDir, "cover_letter.md").then(setCoverLetter).catch(() => {});
    getJobFile(jobDir, "qa_answers.md").then(setQaAnswers).catch(() => {});
  }, [phase2, jobDir]);

  const tabs: { key: Tab; label: string; enabled: boolean }[] = [
    { key: "analysis", label: "Analysis", enabled: !!analysis },
    { key: "resume", label: "Resume", enabled: !!resumeTex },
    { key: "cover", label: "Cover Letter", enabled: !!coverLetter },
    { key: "qa", label: "Q&A", enabled: !!qaAnswers },
  ];

  // Auto-switch to first available tab
  useEffect(() => {
    if (analysis && activeTab !== "analysis") return;
    if (resumeTex && activeTab === "analysis") return;
  }, [analysis, resumeTex, activeTab]);

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center space-y-2">
          <FileText size={48} className="mx-auto opacity-40" />
          <p>Paste a JD and click Analyze to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-700 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => t.enabled && setActiveTab(t.key)}
            disabled={!t.enabled}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer
              disabled:cursor-not-allowed disabled:text-gray-600
              ${
                activeTab === t.key
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pr-1">
        {activeTab === "analysis" && <AnalysisView analysis={analysis} />}
        {activeTab === "resume" && resumeTex && (
          <ResumeView tex={resumeTex} jobDir={jobDir!} hasPdf={!!phase2?.resume_pdf} />
        )}
        {activeTab === "cover" && coverLetter && <CoverLetterView content={coverLetter} />}
        {activeTab === "qa" && qaAnswers && <QaView content={qaAnswers} />}
      </div>
    </div>
  );
}

function AnalysisView({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-6">
      {/* Company overview */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Company Overview
        </h3>
        <p className="text-gray-200">{analysis.company_overview}</p>
      </section>

      {/* Role summary */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Role Summary
        </h3>
        <p className="text-gray-200">{analysis.role_summary}</p>
      </section>

      {/* Score */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Match Score
        </h3>
        <ScoreBadge score={analysis.match_score} />
        <p className="text-gray-300 mt-2 text-sm">{analysis.match_reasoning}</p>
      </section>

      {/* Requirements */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Requirements
        </h3>
        <div className="space-y-1">
          {analysis.hard_requirements.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-red-400 mt-0.5 shrink-0">*</span>
              <span className="text-gray-200">{r}</span>
            </div>
          ))}
          {analysis.soft_requirements.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-gray-500 mt-0.5 shrink-0">-</span>
              <span className="text-gray-400">{r}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Skill match table */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Skill Match
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2 pr-3">Skill</th>
                <th className="text-left py-2 pr-3">JD Asks</th>
                <th className="text-left py-2 pr-3">You Have</th>
                <th className="text-center py-2">Match</th>
              </tr>
            </thead>
            <tbody>
              {analysis.skill_match.map((s, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="py-2 pr-3 text-gray-200 font-medium">{s.skill}</td>
                  <td className="py-2 pr-3 text-gray-300">{s.jd_asks}</td>
                  <td className="py-2 pr-3 text-gray-300">{s.you_have}</td>
                  <td className={`py-2 text-center font-semibold ${matchColors[s.match]}`}>
                    {s.match}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Focus hints */}
      {analysis.resume_focus_hints.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Resume Focus Hints
          </h3>
          <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
            {analysis.resume_focus_hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ResumeView({
  tex,
  jobDir,
  hasPdf,
}: {
  tex: string;
  jobDir: string;
  hasPdf: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CopyButton text={tex} label="Copy LaTeX" />
        {hasPdf && (
          <a
            href={getJobFileUrl(jobDir, "resume_tailored.pdf")}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded
                       bg-blue-700 hover:bg-blue-600 text-white transition-colors"
          >
            <Download size={14} />
            Download PDF
          </a>
        )}
      </div>
      <pre className="bg-gray-800 rounded-lg p-4 text-sm text-gray-200 overflow-x-auto whitespace-pre-wrap font-mono">
        {tex}
      </pre>
    </div>
  );
}

function CoverLetterView({ content }: { content: string }) {
  return (
    <div className="space-y-3">
      <CopyButton text={content} />
      <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-200 whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function QaView({ content }: { content: string }) {
  return (
    <div className="space-y-3">
      <CopyButton text={content} label="Copy All" />
      <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-200 whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}
