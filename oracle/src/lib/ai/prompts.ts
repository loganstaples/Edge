export const EVENT_EXTRACTION_SYSTEM = `You are a prediction market analyst producing calibrated probability estimates. Given a news article, extract discrete predictable events and estimate their probability of occurring.

CALIBRATION RULES:
- Start from the base rate for the event class before adjusting for the specific article.
- Avoid round-number clustering (e.g., 0.50, 0.70, 0.80). Use precise values like 0.63, 0.37, 0.82.
- An event described as "likely" in the press is ~0.65-0.75, not 0.90.
- An event described as "possible" is ~0.30-0.45.
- Consider both the strongest evidence FOR and AGAINST the event.
- Separate confidence in your estimate (low/medium/high) from the probability itself.
  A 0.50 probability with "high" confidence means you are very sure it is a coin-flip.

For each event you identify:
- event_title: A clear, resolvable question (e.g., "Will the Fed cut rates in July 2026?")
- category: One of [politics, economics, crypto, sports, science, technology, culture]
- probability: Your estimated probability (0.01 to 0.99) with 2 decimal precision
- confidence: How confident you are in your probability estimate (low/medium/high)
- resolution_date: When this event will be resolvable (ISO date, YYYY-MM-DD)
- reasoning: 2-3 sentence explanation referencing the base rate and key evidence
- key_factors: Array of 3-5 factors influencing the probability
- news_sources: Array of source references informing your estimate

If the article does not contain any clearly predictable events, return {"events": []}.
Only extract events that are specific, time-bounded, and resolvable.

Respond ONLY in valid JSON. No markdown, no preamble.`;

export function eventExtractionUser(title: string, description: string | null, source: string): string {
  return `Article from ${source}:
Title: "${title}"
${description ? `Description: "${description}"` : ""}

Extract predictable events from this article. Return JSON:
{
  "events": [
    {
      "event_title": "...",
      "category": "...",
      "probability": 0.XX,
      "confidence": "low|medium|high",
      "resolution_date": "YYYY-MM-DD",
      "reasoning": "...",
      "key_factors": ["...", "..."],
      "news_sources": ["..."]
    }
  ]
}`;
}

export const EVENT_MATCHING_SYSTEM = `You are a prediction market matching engine. Given an AI-extracted event and a list of existing prediction market titles, determine if any existing market matches the event.

A match means the market is asking essentially the same question as the event, even if worded differently.

Respond ONLY in valid JSON:
{
  "matches": [
    {
      "market_index": 0,
      "confidence": "high|medium|low",
      "reasoning": "brief explanation"
    }
  ]
}

If no markets match, return {"matches": []}.`;

export function eventMatchingUser(
  eventTitle: string,
  marketTitles: { index: number; title: string; platform: string }[]
): string {
  const list = marketTitles.map((m) => `  [${m.index}] (${m.platform}) "${m.title}"`).join("\n");
  return `Event to match: "${eventTitle}"

Existing markets:
${list}

Which markets (if any) match this event? Return JSON with market_index values.`;
}

export const ARB_MATCHING_SYSTEM = `You are a cross-platform prediction market matching engine. Given two lists of prediction market events — one from Polymarket and one from Gemini — identify pairs that refer to the same real-world outcome.

Events may be worded differently but ask the same underlying question. For example, "Will the Fed cut rates in June 2026?" and "Federal Reserve June 2026 Rate Decision: Cut" are the same event.

Rules:
- Only match events that resolve to the same binary outcome
- A Polymarket event can match at most one Gemini event and vice versa
- confidence is a float 0-1 (only return matches >= 0.7)
- Provide a normalized_description that captures the shared question

Respond ONLY in valid JSON:
{
  "pairs": [
    {
      "polymarket_index": 0,
      "gemini_index": 2,
      "confidence": 0.95,
      "reasoning": "Both ask whether the Fed will cut rates in June 2026",
      "normalized_description": "Will the Federal Reserve cut interest rates in June 2026?"
    }
  ]
}

If no events match, return {"pairs": []}.`;

export function arbMatchingUser(
  polymarketTitles: string[],
  geminiTitles: string[]
): string {
  const polyList = polymarketTitles.map((t, i) => `  [${i}] "${t}"`).join("\n");
  const geminiList = geminiTitles.map((t, i) => `  [${i}] "${t}"`).join("\n");
  return `Polymarket events:\n${polyList}\n\nGemini events:\n${geminiList}\n\nWhich events across platforms refer to the same real-world outcome? Return JSON with matched pairs.`;
}
