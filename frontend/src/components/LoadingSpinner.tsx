import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function LoadingSpinner({ label }: { label: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-3 text-gray-500">
      <Loader2 size={20} className="animate-spin" />
      <span>{label}</span>
      <span className="text-sm text-gray-400">{elapsed}s</span>
    </div>
  );
}
