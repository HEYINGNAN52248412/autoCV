import { useEffect, useRef, useState } from "react";
import { Coins } from "lucide-react";
import type { UsageSummary } from "../api";
import { getUsage } from "../api";

function fmt(n: number): string {
  return n.toLocaleString();
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const total = data
    ? data.total_input_tokens + data.total_output_tokens
    : 0;

  // Sonnet pricing: $3/M input, $15/M output
  const cost = data
    ? (data.total_input_tokens / 1_000_000) * 3 +
      (data.total_output_tokens / 1_000_000) * 15
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
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200
                        rounded-lg shadow-lg z-50 p-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Input tokens</span>
              <span className="font-medium text-gray-800">{fmt(data.total_input_tokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Output tokens</span>
              <span className="font-medium text-gray-800">{fmt(data.total_output_tokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API calls</span>
              <span className="font-medium text-gray-800">{data.total_calls}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between">
              <span className="text-gray-500">Est. cost</span>
              <span className="font-semibold text-gray-800">${cost.toFixed(4)}</span>
            </div>
            <p className="text-xs text-gray-400 pt-1">
              Based on Sonnet pricing ($3/M in, $15/M out)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
