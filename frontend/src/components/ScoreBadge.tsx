export default function ScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? "bg-green-500" : score >= 4 ? "bg-yellow-500" : "bg-red-500";
  const trackColor = score >= 7 ? "bg-green-900" : score >= 4 ? "bg-yellow-900" : "bg-red-900";

  return (
    <div className="flex items-center gap-3">
      <div className={`relative h-3 w-32 rounded-full ${trackColor}`}>
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${color} transition-all`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className="text-lg font-semibold text-gray-200">{score}/10</span>
    </div>
  );
}
