import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Coins } from "lucide-react";
import type { UsageSummary, JobUsage, PhaseUsage } from "../api";
import { getUsage } from "../api";

function fmt(n: number): string {
  return n.toLocaleString();
}

const phaseNames: Record<string, string> = {
  phase1: "Phase 1 Analysis",
  phase2_resume: "Resume Generation",
  phase2_cover: "Cover Letter",
  phase2_qa: "Q&A (auto)",
  interactive_qa: "Q&A (interactive)",
};

function JobRow({ job }: { job: JobUsage }) {
  const [expanded, setExpanded] = useState(false);

  const phases = Object.entries(job.phases);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-2 text-left hover:bg-gray-50
                   transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown size={12} className="shrink-0 text-gray-400" />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-gray-400" />
        )}
        <span className="font-medium text-gray-800 flex-1 truncate">
          {job.company}
        </span>
        <span className="text-xs text-gray-500 shrink-0">
          {fmt(job.total_tokens)}
        </span>
        <span className="text-xs text-gray-400 shrink-0 w-14 text-right">
          ${job.estimated_cost_usd.toFixed(4)}
        </span>
      </button>
      {expanded && (
        <div className="pl-6 pb-2 space-y-1">
          {phases.map(([phase, data]) => {
            if (Array.isArray(data)) {
              const totalTokens = data.reduce(
                (sum: number, d: PhaseUsage) =>
                  sum + d.input_tokens + d.output_tokens,
                0,
              );
              return (
                <div key={phase} className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    {phaseNames[phase] || phase},{" "}
                    {data.length} question{data.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-gray-600">{fmt(totalTokens)}</span>
                </div>
              );
            }
            const d = data as PhaseUsage;
            const tokens = d.input_tokens + d.output_tokens;
            return (
              <div key={phase} className="flex justify-between text-xs">
                <span className="text-gray-500">
                  {phaseNames[phase] || phase}
                </span>
                <span className="text-gray-600">{fmt(tokens)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function UsagePopover({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getUsage().then(setData).catch(() => {});
  }, [refreshKey]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const total = data
    ? data.total_input_tokens + data.total_output_tokens
    : 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg
                   bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
      >
        <Coins size={14} />
        {fmt(total)} tokens
      </button>

      {open && data && (
        <div
          className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200
                      rounded-lg shadow-lg z-50 text-sm"
        >
          {/* Header summary */}
          <div className="p-4 border-b border-gray-200 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Input tokens</span>
              <span className="font-medium text-gray-800">
                {fmt(data.total_input_tokens)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Output tokens</span>
              <span className="font-medium text-gray-800">
                {fmt(data.total_output_tokens)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API calls</span>
              <span className="font-medium text-gray-800">
                {data.total_calls}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between">
              <span className="text-gray-500">Est. cost</span>
              <span className="font-semibold text-gray-800">
                ${data.estimated_cost_usd.toFixed(4)}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Based on Sonnet pricing ($3/M in, $15/M out)
            </p>
          </div>

          {/* Per-job breakdown */}
          {data.per_job.length > 0 && (
            <div className="max-h-64 overflow-y-auto px-4">
              {data.per_job.map((job) => (
                <JobRow key={job.job_dir} job={job} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
