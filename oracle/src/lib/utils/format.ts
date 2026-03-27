export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export function formatEdge(edge: number): string {
  const sign = edge >= 0 ? "+" : "";
  return `${sign}${(edge * 100).toFixed(1)}%`;
}

export function formatPrice(p: number): string {
  return `$${p.toFixed(2)}`;
}

export function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
