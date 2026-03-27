export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  const intersection = new Set(Array.from(setA).filter((x) => setB.has(x)));
  const union = new Set(Array.from(setA).concat(Array.from(setB)));
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function isDuplicate(newTitle: string, existingTitles: string[], threshold = 0.6): boolean {
  return existingTitles.some((t) => jaccardSimilarity(newTitle, t) >= threshold);
}
