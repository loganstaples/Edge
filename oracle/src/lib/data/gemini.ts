import type { GeminiEvent, GeminiEventResponse, GeminiTicker } from "@/types";

const BASE = process.env.GEMINI_API_BASE || "https://api.gemini.com";

export async function fetchGeminiEvents(options?: {
  category?: string;
  status?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: GeminiEvent[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.category) params.set("category", options.category);
  if (options?.status) options.status.forEach((s) => params.append("status", s));
  if (options?.search) params.set("search", options.search);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  const url = `${BASE}/v1/prediction-markets/events?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gemini events API error: ${res.status}`);

  const json = (await res.json()) as GeminiEventResponse;
  return { events: json.data, total: json.pagination.total };
}

export async function fetchGeminiCategories(): Promise<string[]> {
  const res = await fetch(`${BASE}/v1/prediction-markets/categories`);
  if (!res.ok) throw new Error(`Gemini categories API error: ${res.status}`);
  const json = await res.json();
  return json.categories;
}

export async function fetchGeminiTicker(instrumentSymbol: string): Promise<GeminiTicker> {
  const res = await fetch(`${BASE}/v2/ticker/${instrumentSymbol}`);
  if (!res.ok) throw new Error(`Gemini ticker API error for ${instrumentSymbol}: ${res.status}`);
  return (await res.json()) as GeminiTicker;
}

export async function fetchAllActiveGeminiEvents(): Promise<GeminiEvent[]> {
  const allEvents: GeminiEvent[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { events, total } = await fetchGeminiEvents({
      status: ["active"],
      limit,
      offset,
    });
    allEvents.push(...events);
    offset += limit;
    if (offset >= total) break;
  }

  return allEvents;
}

export function getImpliedProbability(contract: GeminiEvent["contracts"][0]): number {
  const last = parseFloat(contract.prices.lastTradePrice);
  if (!isNaN(last) && last > 0) return last;

  const bid = parseFloat(contract.prices.bestBid);
  const ask = parseFloat(contract.prices.bestAsk);
  if (!isNaN(bid) && !isNaN(ask) && bid > 0 && ask > 0) {
    return (bid + ask) / 2;
  }

  const buyYes = parseFloat(contract.prices.buy.yes);
  if (!isNaN(buyYes)) return buyYes;

  return 0.5;
}
