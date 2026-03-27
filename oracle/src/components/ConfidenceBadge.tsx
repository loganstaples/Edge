import type { Confidence } from "@/types";

const styles: Record<Confidence, string> = {
  high: "bg-accent-green/10 text-accent-green border-accent-green/20",
  medium: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
  low: "bg-edge-muted/10 text-edge-muted border-edge-muted/20",
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-medium uppercase tracking-wider ${styles[confidence]}`}
    >
      {confidence}
    </span>
  );
}
