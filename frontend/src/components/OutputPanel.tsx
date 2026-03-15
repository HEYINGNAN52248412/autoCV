import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Send } from "lucide-react";
import type { Analysis, GenerateResponse, QaAnswer } from "../api";
import { getJobFile, getJobFileUrl, askQuestions } from "../api";
import CopyButton from "./CopyButton";
import ScoreBadge from "./ScoreBadge";

type Tab = "analysis" | "resume" | "cover" | "qa";

interface Props {
  analysis: Analysis | null;
  phase2: GenerateResponse | null;
  jobDir: string | null;
  onUsageUpdate: () => void;
}

const matchColors: Record<string, string> = {
  strong: "text-green-600",
  partial: "text-yellow-600",
  weak: "text-red-500",
  none: "text-red-700",
};

export default function OutputPanel({
  analysis,
  phase2,
  jobDir,
  onUsageUpdate,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("analysis");
  const [resumeTex, setResumeTex] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [qaContent, setQaContent] = useState<string | null>(null);

  // Reset state when analysis changes (new job)
  useEffect(() => {
    setResumeTex(null);
    setCoverLetter(null);
    setQaContent(null);
    setActiveTab("analysis");
  }, [analysis]);

  // Load file contents when phase2 arrives
  useEffect(() => {
    if (!phase2 || !jobDir) return;

    getJobFile(jobDir, "resume_tailored.tex")
      .then(setResumeTex)
      .catch(() => {});
    getJobFile(jobDir, "cover_letter.md")
      .then(setCoverLetter)
      .catch(() => {});
    getJobFile(jobDir, "qa_answers.md")
      .then(setQaContent)
      .catch(() => {});
  }, [phase2, jobDir]);

  const tabs: { key: Tab; label: string; enabled: boolean }[] = [
    { key: "analysis", label: "Analysis", enabled: !!analysis },
    { key: "resume", label: "Resume", enabled: !!resumeTex },
    { key: "cover", label: "Cover Letter", enabled: !!coverLetter },
    { key: "qa", label: "Q&A", enabled: !!qaContent || !!analysis },
  ];

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
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
      <div className="flex border-b border-gray-200 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => t.enabled && setActiveTab(t.key)}
            disabled={!t.enabled}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer
              disabled:cursor-not-allowed disabled:text-gray-300
              ${
                activeTab === t.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
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
          <ResumeView
            tex={resumeTex}
            jobDir={jobDir!}
            hasPdf={!!phase2?.resume_pdf}
          />
        )}
        {activeTab === "cover" && coverLetter && (
          <CoverLetterView content={coverLetter} />
        )}
        {activeTab === "qa" && (
          <QaView
            existingContent={qaContent}
            jobDir={jobDir}
            onUsageUpdate={onUsageUpdate}
          />
        )}
      </div>
    </div>
  );
}

function AnalysisView({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Company Overview
        </h3>
        <p className="text-gray-800">{analysis.company_overview}</p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Role Summary
        </h3>
        <p className="text-gray-800">{analysis.role_summary}</p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Match Score
        </h3>
        <ScoreBadge score={analysis.match_score} />
        <p className="text-gray-600 mt-2 text-sm">{analysis.match_reasoning}</p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Requirements
        </h3>
        <div className="space-y-1">
          {analysis.hard_requirements.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-red-500 mt-0.5 shrink-0">*</span>
              <span className="text-gray-800">{r}</span>
            </div>
          ))}
          {analysis.soft_requirements.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-gray-400 mt-0.5 shrink-0">-</span>
              <span className="text-gray-500">{r}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Skill Match
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="text-left py-2 pr-3">Skill</th>
                <th className="text-left py-2 pr-3">JD Asks</th>
                <th className="text-left py-2 pr-3">You Have</th>
                <th className="text-center py-2">Match</th>
              </tr>
            </thead>
            <tbody>
              {analysis.skill_match.map((s, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 pr-3 text-gray-800 font-medium">
                    {s.skill}
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{s.jd_asks}</td>
                  <td className="py-2 pr-3 text-gray-600">{s.you_have}</td>
                  <td
                    className={`py-2 text-center font-semibold ${matchColors[s.match]}`}
                  >
                    {s.match}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {analysis.resume_focus_hints.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Resume Focus Hints
          </h3>
          <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
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
                       bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <Download size={14} />
            Download PDF
          </a>
        )}
      </div>
      <pre className="bg-gray-100 rounded-lg p-4 text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap font-mono">
        {tex}
      </pre>
    </div>
  );
}

function CoverLetterView({ content }: { content: string }) {
  return (
    <div className="space-y-3">
      <CopyButton text={content} />
      <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function QaView({
  existingContent,
  jobDir,
  onUsageUpdate,
}: {
  existingContent: string | null;
  jobDir: string | null;
  onUsageUpdate: () => void;
}) {
  const [interactiveQa, setInteractiveQa] = useState<QaAnswer[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  // Reset interactive QA when job changes
  useEffect(() => {
    setInteractiveQa([]);
    setInputValue("");
  }, [jobDir]);

  const handleAsk = async () => {
    const q = inputValue.trim();
    if (!q || !jobDir || isAsking) return;

    setIsAsking(true);
    try {
      const res = await askQuestions(jobDir, [q]);
      setInteractiveQa((prev) => [...prev, ...res.answers]);
      setInputValue("");
      onUsageUpdate();
    } catch {
      // Error handled by App-level error state
    } finally {
      setIsAsking(false);
    }
  };

  const allText = [
    existingContent || "",
    ...interactiveQa.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`),
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-4">
      {/* Copy all */}
      {allText && <CopyButton text={allText} label="Copy All" />}

      {/* Existing auto-generated Q&A */}
      {existingContent && (
        <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap">
          {existingContent}
        </div>
      )}

      {/* Interactive Q&A pairs */}
      {interactiveQa.map((qa, i) => (
        <div
          key={i}
          className="border border-gray-200 rounded-lg p-4 space-y-2"
        >
          <p className="font-medium text-gray-800">Q: {qa.question}</p>
          <p className="text-gray-600 text-sm whitespace-pre-wrap">
            {qa.answer}
          </p>
        </div>
      ))}

      {/* Ask input */}
      {jobDir && (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Type a question..."
            disabled={isAsking}
            className="flex-1 px-3 py-2 rounded-lg bg-white border border-gray-300
                       text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500
                       disabled:opacity-50"
          />
          <button
            onClick={handleAsk}
            disabled={isAsking || !inputValue.trim()}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500
                       disabled:bg-gray-200 disabled:text-gray-400
                       text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isAsking ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
