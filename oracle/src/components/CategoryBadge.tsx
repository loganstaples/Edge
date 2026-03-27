import type { Category } from "@/types";

const styles: Record<Category, { text: string; bg: string }> = {
  politics: { text: "text-red-400", bg: "bg-red-400/8" },
  economics: { text: "text-amber-400", bg: "bg-amber-400/8" },
  crypto: { text: "text-cyan-400", bg: "bg-cyan-400/8" },
  sports: { text: "text-green-400", bg: "bg-green-400/8" },
  science: { text: "text-violet-400", bg: "bg-violet-400/8" },
  technology: { text: "text-blue-400", bg: "bg-blue-400/8" },
  culture: { text: "text-pink-400", bg: "bg-pink-400/8" },
};

export function CategoryBadge({ category }: { category: Category }) {
  const s = styles[category];
  return (
    <span
      className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md ${s.text} ${s.bg}`}
    >
      {category}
    </span>
  );
}
