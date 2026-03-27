import type { PolymarketMarket, PolymarketOrderBook } from "@/types";

const BASE = process.env.POLYMARKET_API_BASE || "https://clob.polymarket.com";

export async function fetchPolymarketMarkets(cursor?: string): Promise<{
  markets: PolymarketMarket[];
  nextCursor: string | null;
}> {
  const url = cursor
    ? `${BASE}/sampling-markets?next_cursor=${cursor}`
    : `${BASE}/sampling-markets`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polymarket markets API error: ${res.status}`);
  const json = await res.json();
  return {
    markets: json.data ?? [],
    nextCursor: json.next_cursor !== "LTE=" ? json.next_cursor : null,
  };
}

export async function fetchPolymarketMarket(conditionId: string): Promise<PolymarketMarket> {
  const res = await fetch(`${BASE}/markets/${conditionId}`);
  if (!res.ok) throw new Error(`Polymarket market API error: ${res.status}`);
  return (await res.json()) as PolymarketMarket;
}

export async function fetchPolymarketOrderBook(tokenId: string): Promise<PolymarketOrderBook> {
  const res = await fetch(`${BASE}/book?token_id=${tokenId}`);
  if (!res.ok) throw new Error(`Polymarket orderbook API error: ${res.status}`);
  return (await res.json()) as PolymarketOrderBook;
}

export async function fetchPolymarketMidpoint(tokenId: string): Promise<number> {
  const res = await fetch(`${BASE}/midpoint?token_id=${tokenId}`);
  if (!res.ok) throw new Error(`Polymarket midpoint API error: ${res.status}`);
  const json = await res.json();
  return parseFloat(json.mid);
}

export async function fetchActivePolymarkets(maxPages = 2): Promise<PolymarketMarket[]> {
  const all: PolymarketMarket[] = [];
  let cursor: string | undefined;

  for (let i = 0; i < maxPages; i++) {
    const { markets, nextCursor } = await fetchPolymarketMarkets(cursor);
    all.push(...markets);
    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return all.filter((m) => m.active && !m.closed);
}

export function getPolymarketImpliedProbability(market: PolymarketMarket): number {
  const yesToken = market.tokens?.find((t) => t.outcome === "Yes");
  if (yesToken && yesToken.price > 0) return yesToken.price;
  return 0.5;
}
