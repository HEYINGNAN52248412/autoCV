import { useEffect, useState } from "react";
import { X, Check, Minus } from "lucide-react";
import type { JobEntry } from "../api";
import { listJobs } from "../api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (dir: string) => void;
}

export default function HistoryDrawer({ open, onClose, onSelect }: Props) {
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listJobs()
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-gray-700
                     z-50 transform transition-transform duration-200 flex flex-col
                     ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">History</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <p className="text-gray-500">Loading...</p>}
          {!loading && jobs.length === 0 && <p className="text-gray-500">No past analyses found.</p>}
          {jobs.map((job) => (
            <button
              key={job.dir}
              onClick={() => {
                onSelect(job.dir);
                onClose();
              }}
              className="w-full text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-750
                         border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-200">{job.company}</span>
                {job.date && (
                  <span className="text-xs text-gray-500">
                    {job.date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")}
                  </span>
                )}
              </div>
              <div className="flex gap-3 text-xs text-gray-500">
                <Indicator ok={job.has_phase1} label="Analysis" />
                <Indicator ok={job.has_resume} label="Resume" />
                <Indicator ok={job.has_cover_letter} label="Cover" />
                <Indicator ok={job.has_qa} label="Q&A" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function Indicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {ok ? <Check size={12} className="text-green-400" /> : <Minus size={12} className="text-gray-600" />}
      {label}
    </span>
  );
}
