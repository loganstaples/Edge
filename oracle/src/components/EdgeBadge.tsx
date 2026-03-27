import { formatEdge } from "@/lib/utils/format";

export function EdgeBadge({ edge }: { edge: number }) {
  const absEdge = Math.abs(edge);
  let colorClass = "text-edge-muted";
  if (absEdge > 0.1)
    colorClass = edge > 0 ? "text-accent-green" : "text-accent-red";
  else if (absEdge > 0.05)
    colorClass = edge > 0 ? "text-accent-green/70" : "text-accent-red/70";
  const arrow = edge > 0.01 ? " \u25B2" : edge < -0.01 ? " \u25BC" : "";
  return (
    <span className={`font-mono text-sm font-medium ${colorClass}`}>
      {formatEdge(edge)}
      {arrow}
    </span>
  );
}
