import type { Platform } from "@/types";

const config: Record<Platform, { label: string; color: string }> = {
  gemini: { label: "Gemini", color: "bg-blue-500/10 text-blue-400 border-blue-500/15" },
  polymarket: { label: "Poly", color: "bg-purple-500/10 text-purple-400 border-purple-500/15" },
};

export function SourceBadge({ platform }: { platform: Platform }) {
  const { label, color } = config[platform];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-medium uppercase tracking-wider ${color}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
