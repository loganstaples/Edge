// src/lib/engine/backtester.ts
// Real backtesting engine — fetches actual historical prices from
// Polymarket & Gemini, calls Claude for AI nodes (cached per event),
// then replays the strategy tick-by-tick against real market data.

import type { Strategy, StrategyNode, StrategyConnection } from "@/types";
import Anthropic from "@anthropic-ai/sdk";
import { fetchAllActiveGeminiEvents, fetchGeminiTicker } from "@/lib/data/gemini";
import { fetchActivePolymarkets } from "@/lib/data/polymarket";
import { getRecentArticles } from "@/lib/db/queries";
import { fetchHistoricalNews } from "@/lib/data/news";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BacktestConfig {
  /** Number of historical ticks to replay */
  ticks: number;
  /** Starting paper capital in USD */
  startingCapital: number;
  /** Lookback period: "1d" | "1w" | "2w" | "1m" */
  period: "1d" | "1w" | "2w" | "1m";
}

export interface BacktestTrade {
  tick: number;
  timestamp: string;
  marketId: string;
  eventTitle: string;
  platform: string;
  direction: "YES" | "NO";
  entryPrice: number;
  exitPrice: number;
  amount: number;
  pnl: number;
  status: "closed" | "open";
  exitReason?: string;
}

export interface TickNarration {
  headline?: string;
  eventTitle?: string;
  marketPrice?: number;
  platform?: string;
  sentimentScore?: number;
  aiEstimate?: number;
  aiConfidence?: string;
  aiDirection?: string;
  rawEdge?: number;
  adjustedEdge?: number;
  edgePct?: number;
  sourceWeight?: number;
  timeDecay?: number;
  liquidityFactor?: number;
  gateResult?: boolean;
  gateDetails?: string;
  tradeAction?: "BUY" | "SELL" | null;
  tradeDirection?: "YES" | "NO";
  tradeAmount?: number;
  tradePrice?: number;
}

export interface BacktestTick {
  tick: number;
  timestamp: string;
  equity: number;
  drawdown: number;
  tradesThisTick: number;
  marketsScanned: number;
  narrations?: TickNarration[];
  /** IDs of nodes that produced output during this tick */
  activeNodeIds?: string[];
  /** Per-node output maps for driving canvas node displays */
  nodeOutputs?: Record<string, Record<string, any>>;
}

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgTradeReturn: number;
  profitFactor: number;
  finalEquity: number;
}

export interface BacktestResult {
  strategyId: string;
  strategyName: string;
  config: BacktestConfig;
  ticks: BacktestTick[];
  trades: BacktestTrade[];
  marketsUsed: { id: string; title: string; platform: string }[];
  metrics: BacktestMetrics;
}

export type BacktestProgressEvent =
  | { type: "setup"; message: string }
  | { type: "tick"; tick: number; totalTicks: number; data: BacktestResult }
  | { type: "done"; data: BacktestResult }
  | { type: "error"; error: string };

export type BacktestProgressCallback = (event: BacktestProgressEvent) => void | Promise<void>;

function computeMetrics(
  trades: BacktestTrade[],
  equity: number,
  startingCapital: number,
  peak: number,
  maxDD: number,
): BacktestMetrics {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const totalReturn = equity - startingCapital;
  const returns = trades.map((t) => t.pnl / (t.amount || 1));
  let sharpe = 0;
  if (returns.length >= 2) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
    sharpe = variance === 0 ? 0 : mean / Math.sqrt(variance);
  }
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

  return {
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    totalReturnPct: parseFloat(((totalReturn / startingCapital) * 100).toFixed(2)),
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: trades.length > 0 ? parseFloat(((wins.length / trades.length) * 100).toFixed(1)) : 0,
    sharpeRatio: parseFloat(sharpe.toFixed(3)),
    maxDrawdown: parseFloat(maxDD.toFixed(2)),
    maxDrawdownPct: peak > 0 ? parseFloat(((maxDD / peak) * 100).toFixed(2)) : 0,
    avgTradeReturn: trades.length > 0 ? parseFloat((totalReturn / trades.length).toFixed(2)) : 0,
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : parseFloat((grossProfit / grossLoss).toFixed(2)),
    finalEquity: parseFloat(equity.toFixed(2)),
  };
}

// ---------------------------------------------------------------------------
// Historical price data structures
// ---------------------------------------------------------------------------

interface HistoricalMarket {
  eventTitle: string;
  marketId: string;
  platform: "gemini" | "polymarket";
  category: string;
  /** Sorted by timestamp ascending: {t: unix seconds, p: price 0-1} */
  history: { t: number; p: number }[];
}

type River = Record<string, any>;

// ---------------------------------------------------------------------------
// 1. Fetch real historical prices
// ---------------------------------------------------------------------------

const POLY_BASE = process.env.POLYMARKET_API_BASE || "https://clob.polymarket.com";
const GEMINI_BASE = process.env.GEMINI_API_BASE || "https://api.gemini.com";

/** Fetch price history from Polymarket for a given token ID */
async function fetchPolymarketHistory(
  tokenId: string,
  startTs: number,
  endTs: number,
): Promise<{ t: number; p: number }[]> {
  try {
    const url = `${POLY_BASE}/prices-history?market=${tokenId}&startTs=${startTs}&endTs=${endTs}&fidelity=60`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const history: { t: number; p: number }[] = (json.history ?? []).map(
      (pt: { t: number; p: string | number }) => ({
        t: pt.t,
        p: typeof pt.p === "string" ? parseFloat(pt.p) : pt.p,
      }),
    );
    return history.sort((a, b) => a.t - b.t);
  } catch {
    return [];
  }
}

/** Fetch candle history from Gemini (max 7 days for public API) */
async function fetchGeminiHistory(
  instrumentSymbol: string,
): Promise<{ t: number; p: number }[]> {
  try {
    // Gemini candles: /v2/candles/{symbol}/1hr returns up to 7 days
    const url = `${GEMINI_BASE}/v2/candles/${instrumentSymbol}/1hr`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    // Each candle: [timestamp_ms, open, high, low, close, volume]
    const history: { t: number; p: number }[] = (json ?? []).map(
      (c: [number, number, number, number, number, number]) => ({
        t: Math.floor(c[0] / 1000),
        p: c[4], // close price
      }),
    );
    return history.sort((a, b) => a.t - b.t);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2. Discover markets matching strategy's data source configs
// ---------------------------------------------------------------------------

async function discoverMarkets(
  node: StrategyNode,
  startTs: number,
  endTs: number,
): Promise<HistoricalMarket[]> {
  const source = node.config.source ?? "both";
  const keyword = (node.config.keyword ?? "").toLowerCase();
  const category = (node.config.category ?? "").toLowerCase();
  const maxItems = node.config.max_items ?? 5;
  const results: HistoricalMarket[] = [];

  // --- Polymarket ---
  if (source === "polymarket" || source === "both") {
    try {
      const markets = await fetchActivePolymarkets(2);
      const filtered = markets.filter((m) => {
        if (keyword && !m.question.toLowerCase().includes(keyword)) return false;
        if (category && category !== "all") {
          const tags = (m.tags ?? []).map((t: string) => t.toLowerCase());
          if (!tags.some((t: string) => t.includes(category))) return false;
        }
        return true;
      });

      // Fetch history for top markets (limited to avoid rate limits)
      const toFetch = filtered.slice(0, Math.min(maxItems, 6));
      const historyPromises = toFetch.map(async (m) => {
        const yesToken = m.tokens?.find((t) => t.outcome === "Yes");
        const tokenId = yesToken?.token_id || m.condition_id;
        const history = await fetchPolymarketHistory(tokenId, startTs, endTs);
        if (history.length < 3) return null; // Skip markets with insufficient data
        return {
          eventTitle: m.question,
          marketId: tokenId,
          platform: "polymarket" as const,
          category: m.tags?.[0] || "general",
          history,
        };
      });

      const histories = await Promise.all(historyPromises);
      for (const h of histories) { if (h) results.push(h as HistoricalMarket); }
    } catch {
      // Polymarket fetch failed, continue
    }
  }

  // --- Gemini ---
  if (source === "gemini" || source === "both") {
    try {
      const events = await fetchAllActiveGeminiEvents();
      const filtered = events.filter((e) => {
        if (keyword && !e.title.toLowerCase().includes(keyword)) return false;
        if (category && category !== "all" && e.category?.toLowerCase() !== category) return false;
        return true;
      });

      const toFetch = filtered.slice(0, Math.min(maxItems, 6));
      const historyPromises = toFetch.map(async (e) => {
        const contract = e.contracts?.[0];
        if (!contract) return null;
        const symbol = contract.instrumentSymbol;
        const history = await fetchGeminiHistory(symbol);
        // Gemini candles are 0–1 for prediction markets already
        if (history.length < 3) {
          // Fallback: create a single-point history from current ticker
          try {
            const ticker = await fetchGeminiTicker(symbol);
            const price = parseFloat(ticker.bid || ticker.close || "0.5");
            return {
              eventTitle: e.title,
              marketId: symbol,
              platform: "gemini" as const,
              category: e.category || "general",
              history: [{ t: startTs, p: price }, { t: endTs, p: price }],
            };
          } catch {
            return null;
          }
        }
        return {
          eventTitle: e.title,
          marketId: symbol,
          platform: "gemini" as const,
          category: e.category || "general",
          history,
        };
      });

      const histories = await Promise.all(historyPromises);
      for (const h of histories) { if (h) results.push(h as HistoricalMarket); }
    } catch {
      // Gemini fetch failed, continue
    }
  }

  return results.slice(0, maxItems);
}

// ---------------------------------------------------------------------------
// 3. AI cache — calls Claude once per unique event, caches result
// ---------------------------------------------------------------------------

const aiCache = new Map<string, Record<string, any>>();
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic();
  return anthropicClient;
}

async function cachedAIEstimate(eventTitle: string): Promise<Record<string, any>> {
  const cacheKey = `estimate:${eventTitle}`;
  if (aiCache.has(cacheKey)) return aiCache.get(cacheKey)!;

  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 768,
      system: `You are a prediction market analyst with calibrated probability estimates. Given an event description, estimate the probability it will occur.

CALIBRATION GUIDELINES:
- Base rates matter: start from the historical base rate for similar events before adjusting.
- Distinguish between "likely" (~70%) and "almost certain" (~95%). Avoid clustering at round numbers.
- Consider both sides: identify the strongest argument FOR and AGAINST the event.
- Time horizon: closer deadlines generally mean higher confidence in the estimate's direction.
- Uncertainty is valid: if the event is genuinely uncertain, probabilities near 0.5 are appropriate.

Return ONLY valid JSON:
{
  "probability": <0.01-0.99>,
  "confidence": "low"|"medium"|"high",
  "reasoning": "2-3 sentence explanation referencing base rates and key evidence",
  "key_factors": ["factor1", "factor2", ...],
  "search_terms": "2-4 keywords to find related prediction markets (e.g., 'trump election 2028', 'bitcoin price')",
  "base_rate_reference": "brief note on what base rate was used",
  "strongest_counter": "the strongest argument against this probability"
}`,
      messages: [{ role: "user", content: `Estimate the probability of: "${eventTitle}"` }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const keyFactors = parsed.key_factors ?? [];
    const result = {
      ai_probability: Math.max(0.01, Math.min(0.99, parsed.probability ?? 0.5)),
      ai_confidence: parsed.confidence ?? "medium",
      ai_reasoning: parsed.reasoning ?? "",
      key_factors: keyFactors,
      key_factor_count: keyFactors.length,
      search_terms: parsed.search_terms ?? "",
      base_rate_reference: parsed.base_rate_reference ?? "",
      strongest_counter: parsed.strongest_counter ?? "",
    };
    aiCache.set(cacheKey, result);
    return result;
  } catch {
    const fallback = { ai_probability: 0.5, ai_confidence: "low", ai_reasoning: "AI call failed", key_factors: [], key_factor_count: 0, search_terms: "" };
    aiCache.set(cacheKey, fallback);
    return fallback;
  }
}

async function cachedSentiment(text: string): Promise<Record<string, any>> {
  const cacheKey = `sentiment:${text.slice(0, 100)}`;
  if (aiCache.has(cacheKey)) return aiCache.get(cacheKey)!;

  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 128,
      system: `Analyze sentiment. Return ONLY JSON: { "sentiment_score": <-1 to 1>, "sentiment_label": "bearish"|"neutral"|"bullish" }`,
      messages: [{ role: "user", content: text }],
    });
    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const result = {
      sentiment_score: parsed.sentiment_score ?? 0,
      sentiment_label: parsed.sentiment_label ?? "neutral",
    };
    aiCache.set(cacheKey, result);
    return result;
  } catch {
    const fallback = { sentiment_score: 0, sentiment_label: "neutral" };
    aiCache.set(cacheKey, fallback);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// 4. Deterministic node runners (logic, actions)
// ---------------------------------------------------------------------------

function runLogicNode(node: StrategyNode, river: River): Record<string, any> {
  // Import and delegate to the real logic runner for new node types
  // For backtest, cooldown/timer nodes are bypassed
  if (node.type === "cooldown_gate") return { _gate_result: true, cg_status: "passing", _gate_details: "Cooldown bypassed in backtest" };

  // Edge calculator, arb_detector, router, price_alert_decide, multi_condition_gate
  // all use _gate_result — delegate to real runner
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runLogicNode: realRunner } = require("./node-runners/logic-nodes");
    return realRunner(node, river);
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// History tracker for backtests — uses tick timestamp instead of Date.now()
// so the time_window config actually represents historical time, not wall time.
// ---------------------------------------------------------------------------

const btHistoryBuffers: Record<string, { value: number; timestamp: number }[]> = {};

function runBacktestHistoryTracker(
  node: StrategyNode,
  river: River,
  tickTs: number,
): Record<string, any> {
  const trackField = node.config.track_field ?? "analyst_probability";
  const maxDepth = node.config.depth ?? 25;
  const timeWindow = node.config.time_window ?? "1h";

  const currentValue = river[trackField];
  if (currentValue == null || typeof currentValue !== "number") {
    return {
      history_current: null, history_values: [], history_trend: "flat",
      history_avg: null, history_min: null, history_max: null,
      history_streak: 0, history_rate_of_change: 0,
    };
  }

  // Key by node + market so different markets don't mix in the same buffer
  const marketKey = river.market_id ?? river.event_title ?? "default";
  const bufferKey = `${node.id}:${marketKey}`;

  if (!btHistoryBuffers[bufferKey]) btHistoryBuffers[bufferKey] = [];
  btHistoryBuffers[bufferKey].push({ value: currentValue, timestamp: tickTs });

  const windowSec: Record<string, number> = {
    "5m": 300, "15m": 900, "1h": 3600,
    "4h": 14400, "24h": 86400, "7d": 604800,
  };
  const cutoff = tickTs - (windowSec[timeWindow] ?? 3600);
  btHistoryBuffers[bufferKey] = btHistoryBuffers[bufferKey].filter((e) => e.timestamp >= cutoff);

  if (btHistoryBuffers[bufferKey].length > maxDepth) {
    btHistoryBuffers[bufferKey] = btHistoryBuffers[bufferKey].slice(-maxDepth);
  }

  const entries = btHistoryBuffers[bufferKey];
  const values = entries.map((e) => e.value);

  if (values.length <= 1) {
    return {
      history_current: currentValue, history_values: values, history_trend: "flat",
      history_avg: currentValue, history_min: currentValue, history_max: currentValue,
      history_streak: 1, history_rate_of_change: 0,
    };
  }

  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += values[i]; sumXY += i * values[i]; sumXX += i * i;
  }
  const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) : 0;
  const trend = slope > 0.001 ? "rising" : slope < -0.001 ? "falling" : "flat";

  let streak = 1;
  if (values.length >= 2) {
    const lastDir = values[values.length - 1] >= values[values.length - 2] ? "up" : "down";
    for (let i = values.length - 2; i > 0; i--) {
      const dir = values[i] >= values[i - 1] ? "up" : "down";
      if (dir === lastDir) streak++; else break;
    }
  }

  const rateOfChange = (values[values.length - 1] - values[0]) / (values.length - 1);

  return {
    history_current: currentValue,
    history_values: values,
    history_trend: trend,
    history_avg: Math.round(avg * 10000) / 10000,
    history_min: min,
    history_max: max,
    history_streak: streak,
    history_rate_of_change: Math.round(rateOfChange * 10000) / 10000,
  };
}

interface TradeAction {
  action: "buy" | "sell";
  platform: string;
  marketId: string;
  direction: "YES" | "NO";
  amount: number;
  eventTitle: string;
  exitStrategy: "hold_ticks" | "tp_sl" | "both";
  exitTicks: number;
  takeProfit: number;
  stopLoss: number;
}

function runActionNode(
  node: StrategyNode,
  river: River,
): { trade?: TradeAction } {
  if (node.type === "trade_advanced" || node.type === "trade") {
    let platform = node.config.platform ?? "auto";
    if (platform === "auto") platform = river.platform || "polymarket";

    // Read direction from config — supports "buy_yes", "buy_no", "sell", "auto"
    let direction = node.config.direction ?? node.config.side ?? "auto";
    if (direction === "auto") {
      const dir = river.ec_direction ?? river.direction ?? "bullish";
      direction = dir === "bearish" ? "buy_no" : "buy_yes";
    }

    // Determine action (buy or sell) and side (YES or NO)
    const isSell = direction === "sell" ||
      (node.config.auto_close && (river.ec_edge_pct ?? river.ec_edge ?? 0) < 0);
    const side: "YES" | "NO" = direction === "buy_no" ? "NO" : "YES";

    const configuredSize = node.config.size_usd ?? node.config.max_position ?? 25;
    const kellySize = river.ec_suggested_size ?? river.suggested_size;
    const useKelly = (node.config.sizing_mode === "kelly" || node.config.size_mode === "kelly")
      && kellySize != null && kellySize > 0;
    const amount = useKelly ? Math.min(kellySize, configuredSize * 4) : configuredSize;

    return {
      trade: {
        action: isSell ? "sell" : "buy",
        platform,
        marketId: river.market_id || "unknown",
        direction: side,
        amount: Math.round(amount * 100) / 100,
        eventTitle: river.event_title || "Unknown",
        exitStrategy: node.config.exit_strategy ?? "hold_ticks",
        exitTicks: node.config.exit_ticks ?? 5,
        takeProfit: node.config.take_profit ?? 0.15,
        stopLoss: node.config.stop_loss ?? 0.10,
      },
    };
  }
  return {};
}

// ---------------------------------------------------------------------------
// 5. Topological sort
// ---------------------------------------------------------------------------

function topoSort(nodes: StrategyNode[], connections: StrategyConnection[]): StrategyNode[] {
  const inDeg: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  const map: Record<string, StrategyNode> = {};
  for (const n of nodes) { inDeg[n.id] = 0; adj[n.id] = []; map[n.id] = n; }
  for (const c of connections) {
    if (adj[c.source_id]) adj[c.source_id].push(c.target_id);
    inDeg[c.target_id] = (inDeg[c.target_id] || 0) + 1;
  }
  const q = nodes.filter((n) => inDeg[n.id] === 0).map((n) => n.id);
  const sorted: StrategyNode[] = [];
  while (q.length) {
    const id = q.shift()!;
    sorted.push(map[id]);
    for (const nb of adj[id]) { inDeg[nb]--; if (inDeg[nb] === 0) q.push(nb); }
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// 6. Interpolate price at a given timestamp from history
// ---------------------------------------------------------------------------

function priceAt(history: { t: number; p: number }[], ts: number): number | null {
  if (history.length === 0) return null;
  if (ts <= history[0].t) return history[0].p;
  if (ts >= history[history.length - 1].t) return history[history.length - 1].p;

  // Binary search for the two surrounding points
  let lo = 0;
  let hi = history.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (history[mid].t <= ts) lo = mid;
    else hi = mid;
  }

  // Linear interpolation
  const a = history[lo];
  const b = history[hi];
  if (b.t === a.t) return a.p;
  const frac = (ts - a.t) / (b.t - a.t);
  return a.p + frac * (b.p - a.p);
}

// ---------------------------------------------------------------------------
// 7. Reactive data source runner for backtests
// ---------------------------------------------------------------------------

/**
 * Run a reactive data source (one with upstream inputs) during backtest replay.
 * Uses upstream search_terms from the river to find matching markets, then
 * returns their historical price at the current tick timestamp.
 */
async function _runReactiveSource(
  node: StrategyNode,
  river: River,
  tickTs: number,
  startTs: number,
  endTs: number,
  polymarketPool: any[],
  geminiPool: any[],
  hCache: Map<string, { t: number; p: number }[]>,
  allMarkets: HistoricalMarket[],
): Promise<Record<string, any>> {
  // Resolve search terms: upstream search_terms > static node config
  const searchTerms =
    river.search_terms ?? river.search_query ?? river.query ??
    node.config.market_search ?? node.config.event_search ?? node.config.keywords ?? "";

  if (!searchTerms || typeof searchTerms !== "string" || !searchTerms.trim()) {
    return { _item_count: 0 };
  }

  const maxResults = node.config.max_results ?? 5;
  // AI often returns comma-separated phrases — use the first 2 phrases only
  const phrases = searchTerms.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 2);
  const condensed = phrases.join(" ").toLowerCase();
  const rawKeywords = condensed.split(/\s+/).filter(Boolean);
  // Filter out stop words to prevent overly broad matching
  const STOP_WORDS = new Set(["the", "of", "in", "a", "an", "to", "for", "and", "or", "is", "it", "on", "at", "by", "be", "will", "has", "have", "can", "do", "does"]);
  const effectiveKeywords = rawKeywords.filter((kw) => kw.length > 2 && !STOP_WORDS.has(kw));
  // Cap at 6 keywords to keep matching practical
  const keywords = (effectiveKeywords.length > 0 ? effectiveKeywords : rawKeywords).slice(0, 6);
  // Full phrase for substring matching
  const fullPhrase = phrases[0]?.toLowerCase() ?? keywords.join(" ");

  // Scoring: check full-phrase substring match first, then require at least
  // 1/3 of individual keywords (min 1). This balances specificity with recall.
  const minMatchCount = Math.max(1, Math.ceil(keywords.length / 3));

  function matchesSearch(text: string): boolean {
    // Full phrase match is always a pass
    if (fullPhrase.length > 3 && text.includes(fullPhrase)) return true;
    // Otherwise count individual keyword hits
    const matchCount = keywords.filter((kw: string) => text.includes(kw)).length;
    return matchCount >= minMatchCount;
  }

  if (node.type === "polymarket_feed") {
    const filtered = polymarketPool
      .filter((m) => {
        const text = (m.question ?? "").toLowerCase();
        return matchesSearch(text);
      })
      .slice(0, maxResults);

    const results: Record<string, any>[] = [];
    for (const m of filtered) {
      const yesToken = m.tokens?.find((t: any) => t.outcome === "Yes");
      const tokenId = yesToken?.token_id || m.condition_id;

      let history = hCache.get(tokenId);
      if (!history) {
        history = await fetchPolymarketHistory(tokenId, startTs, endTs);
        hCache.set(tokenId, history);
      }

      const price = priceAt(history, tickTs);
      if (price == null) continue;

      // Register market so position tracking / exit logic can find it
      if (!allMarkets.some((am) => am.marketId === tokenId)) {
        allMarkets.push({ eventTitle: m.question, marketId: tokenId, platform: "polymarket", category: m.tags?.[0] || "general", history });
      }

      results.push({
        event_title: m.question,
        market_id: tokenId,
        platform: "polymarket",
        price,
        yes_price: price,
        no_price: parseFloat((1 - price).toFixed(4)),
        bid: Math.max(0.01, price - 0.005),
        ask: Math.min(0.99, price + 0.005),
        spread: 0.01,
        volume_24h: 0,
      });
    }

    if (results.length === 0) return { _item_count: 0 };
    return { ...results[0], available_markets: results, available_market_count: results.length, _item_count: results.length };
  }

  if (node.type === "gemini_markets_feed") {
    const filtered = geminiPool
      .filter((e) => {
        const text = (e.title ?? "").toLowerCase();
        return matchesSearch(text);
      })
      .slice(0, maxResults);

    const results: Record<string, any>[] = [];
    for (const e of filtered) {
      const contract = e.contracts?.[0];
      if (!contract) continue;
      const symbol = contract.instrumentSymbol;

      let history = hCache.get(symbol);
      if (!history) {
        history = await fetchGeminiHistory(symbol);
        hCache.set(symbol, history);
      }

      const price = priceAt(history, tickTs);
      if (price == null) continue;

      if (!allMarkets.some((am) => am.marketId === symbol)) {
        allMarkets.push({ eventTitle: e.title, marketId: symbol, platform: "gemini", category: e.category || "general", history });
      }

      results.push({
        event_title: e.title,
        market_id: symbol,
        platform: "gemini",
        price,
        contract_price: price,
        bid_price: Math.max(0.01, price - 0.005),
        ask_price: Math.min(0.99, price + 0.005),
        spread: 0.01,
      });
    }

    if (results.length === 0) return { _item_count: 0 };
    return { ...results[0], available_markets: results, available_market_count: results.length, _item_count: results.length };
  }

  return { _item_count: 0 };
}

// ---------------------------------------------------------------------------
// 8. Main backtest runner
// ---------------------------------------------------------------------------

export async function runBacktest(
  strategy: Strategy,
  config: Partial<BacktestConfig> = {},
  onProgress?: BacktestProgressCallback,
): Promise<BacktestResult> {
  // Clear per-run state caches (NOT aiCache — AI results are deterministic per input)
  for (const k of Object.keys(btHistoryBuffers)) delete btHistoryBuffers[k];

  const periodMs: Record<string, number> = {
    "1d": 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
    "2w": 14 * 24 * 60 * 60 * 1000,
    "1m": 30 * 24 * 60 * 60 * 1000,
  };

  const cfg: BacktestConfig = {
    ticks: config.ticks ?? 60,
    startingCapital: config.startingCapital ?? 1000,
    period: config.period ?? "1w",
  };

  const now = Date.now();
  const endTs = Math.floor(now / 1000);
  const startTs = Math.floor((now - periodMs[cfg.period]) / 1000);
  const tickInterval = (endTs - startTs) / cfg.ticks;

  // --- Phase 1: Discover real markets & fetch historical prices ---
  onProgress?.({ type: "setup", message: "Discovering markets & fetching prices..." });
  const sorted = topoSort(strategy.nodes, strategy.connections);

  // Distinguish standalone data sources (entry points with no upstream) from
  // reactive data sources (e.g., polymarket_feed driven by AI search_terms).
  // Matches the live executor's split so backtests reflect real execution.
  const incomingCount = new Map<string, number>();
  for (const n of sorted) incomingCount.set(n.id, 0);
  for (const c of strategy.connections) {
    incomingCount.set(c.target_id, (incomingCount.get(c.target_id) ?? 0) + 1);
  }
  const sourceNodes = sorted.filter(
    (n) => n.category === "data" && (incomingCount.get(n.id) ?? 0) === 0,
  );
  const downstream = sorted.filter(
    (n) => n.category !== "data" || (incomingCount.get(n.id) ?? 0) > 0,
  );

  const allMarkets: HistoricalMarket[] = [];
  const marketsBySource: Record<string, HistoricalMarket[]> = {};

  for (const src of sourceNodes) {
    if (src.type === "market_watch" || src.type === "price_alert" || src.type === "polymarket_feed" || src.type === "gemini_markets_feed") {
      const markets = await discoverMarkets(src, startTs, endTs);
      marketsBySource[src.id] = markets;
      allMarkets.push(...markets);
    }
  }

  // Fetch real historical news for the backtest period.
  // Pulls from NewsAPI /everything with the strategy's keywords and date range.
  // Falls back to DB articles if NewsAPI returns nothing.
  // Collect keywords from all news source nodes and convert to OR query for NewsAPI.
  // Strategy keywords are space/comma separated; NewsAPI needs explicit " OR " joins.
  const newsKeywords = sourceNodes
    .filter((n) => n.type === "news_monitor" || n.type === "news_feed")
    .flatMap((n) => (n.config.keywords ?? "").split(/[\s,]+/).filter(Boolean))
    .filter((v, i, a) => a.indexOf(v) === i) // dedupe
    .join(" OR ");
  const startDate = new Date(startTs * 1000).toISOString().slice(0, 10);
  const endDate = new Date(endTs * 1000).toISOString().slice(0, 10);
  const historicalArticles = await fetchHistoricalNews({
    keywords: newsKeywords,
    from: startDate,
    to: endDate,
    pageSize: 50,
  });
  // Map to same shape as DB articles, fall back to DB if API returns nothing
  const articles = historicalArticles.length > 0
    ? historicalArticles.map((a) => ({
        id: "",
        title: a.title,
        description: a.description ?? "",
        source: a.source,
        url: a.url ?? "",
        publishedAt: a.publishedAt,
        category: a.category ?? "",
        processed: false,
        createdAt: a.publishedAt,
      }))
    : getRecentArticles(100);

  // Pre-fetch active market lists for reactive data source searches.
  // Fetched once, filtered per-tick using upstream search_terms.
  const polymarketSearchPool = await fetchActivePolymarkets(2).catch(() => [] as any[]);
  const geminiSearchPool = await fetchAllActiveGeminiEvents().catch(() => [] as any[]);
  const historyCache = new Map<string, { t: number; p: number }[]>();

  // Pre-fetch crypto price history for crypto_price nodes
  const cryptoHistoryByPair = new Map<string, { t: number; p: number }[]>();
  const cryptoNodes = sourceNodes.filter((n) => n.type === "crypto_price");
  for (const cn of cryptoNodes) {
    const token = (cn.config.token ?? "BTC").toUpperCase();
    const pair = `${token}usd`;
    if (!cryptoHistoryByPair.has(pair)) {
      try {
        const url = `${GEMINI_BASE}/v2/candles/${pair}/1hr`;
        const res = await fetch(url);
        if (res.ok) {
          const candles = await res.json();
          const history = (candles ?? [])
            .map((c: [number, number, number, number, number, number]) => ({
              t: Math.floor(c[0] / 1000),
              p: c[4], // close price
            }))
            .sort((a: { t: number }, b: { t: number }) => a.t - b.t);
          cryptoHistoryByPair.set(pair, history);
        }
      } catch { /* skip */ }
    }
  }

  // Pre-fetch on-chain (whale) trade history from Gemini for onchain_activity nodes
  const onchainTradeHistory: { timestamp: number; token: string; dollar_value: number; from_address: string; to_address: string; tx_hash: string; chain: string }[] = [];
  const onchainNodes = sourceNodes.filter((n) => n.type === "onchain_activity");
  if (onchainNodes.length > 0) {
    const pairs = ["btcusd", "ethusd", "solusd"];
    for (const pair of pairs) {
      try {
        const res = await fetch(`${GEMINI_BASE}/v1/trades/${pair}?limit_trades=200`);
        if (res.ok) {
          const trades = await res.json();
          const token = pair.replace("usd", "").toUpperCase();
          for (const tr of trades ?? []) {
            const dollarValue = parseFloat(tr.price) * parseFloat(tr.amount);
            onchainTradeHistory.push({
              timestamp: tr.timestampms ? Math.floor(tr.timestampms / 1000) : tr.timestamp,
              token,
              dollar_value: dollarValue,
              from_address: `0x${(tr.tid ?? "").toString(16).padStart(40, "a")}`,
              to_address: `0x${(tr.tid ?? "").toString(16).padStart(40, "b")}`,
              tx_hash: `0x${(tr.tid ?? "").toString(16).padStart(64, "0")}`,
              chain: token === "SOL" ? "solana" : "ethereum",
            });
          }
        }
      } catch { /* skip */ }
    }
    onchainTradeHistory.sort((a, b) => a.timestamp - b.timestamp);
  }

  // --- Phase 2: Pre-fetch AI estimates (cached, one call per unique event) ---
  onProgress?.({ type: "setup", message: "Running AI analysis..." });
  // Identify which AI node types are in the graph
  const hasAIEstimate = downstream.some((n) => n.type === "ai_analyst" || n.type === "ai_estimate");
  const hasSentiment = downstream.some((n) => n.type === "sentiment_scanner" || n.type === "sentiment");

  if (hasAIEstimate) {
    const uniqueEvents = Array.from(new Set(allMarkets.map((m) => m.eventTitle)));
    // Call Claude for each unique event (parallel, max 5 concurrent)
    const batches = [];
    for (let i = 0; i < uniqueEvents.length; i += 5) {
      batches.push(uniqueEvents.slice(i, i + 5));
    }
    for (const batch of batches) {
      await Promise.all(batch.map((title) => cachedAIEstimate(title)));
    }
  }

  if (hasSentiment && articles.length > 0) {
    const uniqueHeadlines = Array.from(new Set(articles.slice(0, 20).map((a) => a.title)));
    const batches = [];
    for (let i = 0; i < uniqueHeadlines.length; i += 5) {
      batches.push(uniqueHeadlines.slice(i, i + 5));
    }
    for (const batch of batches) {
      await Promise.all(batch.map((h) => cachedSentiment(h)));
    }
  }

  // --- Phase 3: Replay strategy tick-by-tick ---
  onProgress?.({ type: "setup", message: "Simulating strategy..." });
  const allTrades: BacktestTrade[] = [];
  const tickData: BacktestTick[] = [];
  const openPositions: {
    entryTick: number;
    entryTs: number;
    entryPrice: number;
    marketId: string;
    eventTitle: string;
    platform: string;
    direction: "YES" | "NO";
    amount: number;
    market: HistoricalMarket;
    exitStrategy: "hold_ticks" | "tp_sl" | "both";
    exitTicks: number;
    takeProfit: number;
    stopLoss: number;
  }[] = [];

  // Per-position price history for momentum-based exit detection.
  // If the strategy has a router that gates on price movement (sell when stalled),
  // we check each open position's recent price change and close when it stalls.
  const positionPriceHistory: Map<string, number[]> = new Map();
  const posKey = (pos: typeof openPositions[number]) => `${pos.marketId}:${pos.entryTs}`;

  // Detect if the strategy has a sell-on-stall pattern:
  // router with rate_of_change route → sell node on default/stall route
  const hasStallSellPattern = downstream.some((n) => {
    if (n.type !== "router") return false;
    const routes = n.config.routes ?? [];
    // Find a default/stall route that connects to a sell node
    const stallRoute = routes.find((r: any) => r.is_default || (r.field?.includes("rate_of_change") && r.comparator === "<="));
    if (!stallRoute) return false;
    const routeIdx = routes.indexOf(stallRoute);
    const routeHandle = `route_${routeIdx + 1}`;
    const downstream_conn = strategy.connections.find(
      (c) => c.source_id === n.id && c.source_handle === routeHandle,
    );
    if (!downstream_conn) return false;
    const targetNode = strategy.nodes.find((nd) => nd.id === downstream_conn.target_id);
    return targetNode?.type === "trade_advanced" && targetNode?.config?.direction === "sell";
  });

  // Extract the stall threshold from the router config
  let stallThreshold = 0.005;
  if (hasStallSellPattern) {
    const routerNode = downstream.find((n) => n.type === "router");
    const movingRoute = routerNode?.config?.routes?.find(
      (r: any) => r.field?.includes("rate_of_change") && (r.comparator === ">" || r.comparator === ">="),
    );
    if (movingRoute?.value) stallThreshold = parseFloat(movingRoute.value);
  }

  let equity = cfg.startingCapital;
  let peak = equity;
  let maxDD = 0;

  for (let t = 0; t < cfg.ticks; t++) {
    const tickTs = startTs + Math.floor(t * tickInterval);
    const timestamp = new Date(tickTs * 1000).toISOString();
    let tradesThisTick = 0;
    let marketsScanned = 0;

    // --- Check exit conditions for open positions ---
    const toClose: number[] = [];
    for (let i = openPositions.length - 1; i >= 0; i--) {
      const pos = openPositions[i];
      const currentPrice = priceAt(pos.market.history, tickTs) ?? pos.entryPrice;
      const unrealizedPnl = pos.direction === "YES"
        ? (currentPrice - pos.entryPrice) * pos.amount
        : (pos.entryPrice - currentPrice) * pos.amount;
      const returnPct = Math.abs(pos.entryPrice) > 0
        ? (pos.direction === "YES" ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice) / pos.entryPrice
        : 0;

      let shouldClose = false;
      let exitReason = "";

      // Check hold-ticks exit
      if (pos.exitStrategy === "hold_ticks" || pos.exitStrategy === "both") {
        if (t - pos.entryTick >= pos.exitTicks) {
          shouldClose = true;
          exitReason = `hold ${pos.exitTicks} ticks`;
        }
      }

      // Check TP/SL exit
      if (!shouldClose && (pos.exitStrategy === "tp_sl" || pos.exitStrategy === "both")) {
        if (returnPct >= pos.takeProfit) {
          shouldClose = true;
          exitReason = `take-profit ${(pos.takeProfit * 100).toFixed(0)}%`;
        } else if (returnPct <= -pos.stopLoss) {
          shouldClose = true;
          exitReason = `stop-loss ${(pos.stopLoss * 100).toFixed(0)}%`;
        }
      }

      // Check momentum-stall exit: if the strategy has a "sell when price stalls"
      // pattern (router → sell node), close positions whose price has stopped moving.
      // Need at least 3 ticks of history to measure rate of change.
      if (!shouldClose && hasStallSellPattern && t - pos.entryTick >= 2) {
        const pk = posKey(pos);
        if (!positionPriceHistory.has(pk)) positionPriceHistory.set(pk, []);
        const hist = positionPriceHistory.get(pk)!;
        hist.push(currentPrice);
        // Keep last 5 data points
        if (hist.length > 5) hist.shift();

        if (hist.length >= 3) {
          // Rate of change = average price change per tick over recent history
          const roc = Math.abs(hist[hist.length - 1] - hist[0]) / (hist.length - 1);
          if (roc <= stallThreshold) {
            shouldClose = true;
            exitReason = `sell signal (price stalled, roc=${roc.toFixed(4)} <= ${stallThreshold})`;
          }
        }
      } else if (hasStallSellPattern && !positionPriceHistory.has(posKey(pos))) {
        // Start tracking even before we check
        positionPriceHistory.set(posKey(pos), [currentPrice]);
      } else if (hasStallSellPattern && positionPriceHistory.has(posKey(pos))) {
        positionPriceHistory.get(posKey(pos))!.push(currentPrice);
      }

      if (shouldClose) {
        allTrades.push({
          tick: t,
          timestamp,
          marketId: pos.marketId,
          eventTitle: pos.eventTitle,
          platform: pos.platform,
          direction: pos.direction,
          entryPrice: parseFloat(pos.entryPrice.toFixed(4)),
          exitPrice: parseFloat(currentPrice.toFixed(4)),
          amount: pos.amount,
          pnl: parseFloat(unrealizedPnl.toFixed(2)),
          status: "closed",
          exitReason,
        });

        equity += unrealizedPnl;
        toClose.push(i);
      }
    }
    // Remove closed positions (iterate in reverse so indices stay valid)
    for (const idx of toClose) {
      positionPriceHistory.delete(posKey(openPositions[idx]));
      openPositions.splice(idx, 1);
    }

    // --- Build rivers from data sources at this tick ---
    const rivers: River[] = [];
    // Track which nodes fired this tick for canvas visualization (ordered left-to-right)
    const tickActiveNodeIds: string[] = [];

    for (const src of sourceNodes) {
      const riversBefore = rivers.length;
      if (src.type === "news_feed" || src.type === "news_monitor") {
        // Feed articles published within the current tick's time window so
        // trades are distributed across the entire backtest, not clustered at
        // the end.  Falls back to a wider cumulative window when no articles
        // exist in the narrow window (ensures early ticks still get data).
        const windowStart = tickTs - Math.floor(tickInterval);
        const windowEnd = tickTs;
        const tickDate = new Date(windowEnd * 1000);
        const windowStartDate = new Date(windowStart * 1000);

        const topics = (src.config.keywords || src.config.topics || "")
          .split(/[\s,]+/)
          .map((t: string) => t.trim().toLowerCase())
          .filter(Boolean);

        // Prefer articles published in *this* tick window
        let filtered = articles
          .filter((a) => {
            const pub = new Date(a.publishedAt);
            return pub > windowStartDate && pub <= tickDate;
          })
          .filter((a) => {
            if (topics.length === 0) return true;
            const text = `${a.title} ${a.description || ""}`.toLowerCase();
            return topics.some((topic: string) => text.includes(topic));
          })
          .slice(0, 3);

        // Fallback: spread all matching articles across ticks evenly
        if (filtered.length === 0) {
          const topicFiltered = articles.filter((a) => {
            if (topics.length === 0) return true;
            const text = `${a.title} ${a.description || ""}`.toLowerCase();
            return topics.some((topic: string) => text.includes(topic));
          });
          if (topicFiltered.length > 0) {
            const chunkSize = Math.max(1, Math.ceil(topicFiltered.length / cfg.ticks));
            const start = t * chunkSize;
            filtered = topicFiltered.slice(start, start + chunkSize).slice(0, 3);
          }
        }

        for (const a of filtered) {
          rivers.push({
            headline: a.title,
            description: a.description || "",
            source_name: a.source,
            url: a.url || "",
            category: a.category || "",
            published_at: a.publishedAt,
          });
        }
        continue;
      }

      if (src.type === "crypto_price") {
        const token = (src.config.token ?? "BTC").toUpperCase();
        const pair = `${token}usd`;
        const history = cryptoHistoryByPair.get(pair);
        if (history && history.length > 0) {
          const price = priceAt(history, tickTs);
          if (price != null) {
            // Compute change from previous tick
            const prevPrice = priceAt(history, tickTs - Math.floor(tickInterval));
            const changePct = prevPrice && prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
            rivers.push({
              current_price: price,
              change_pct: Math.round(changePct * 100) / 100,
              change_abs: prevPrice ? Math.round((price - prevPrice) * 100) / 100 : 0,
              volume_24h: 0,
              high_24h: price,
              low_24h: price,
              token,
            });
          }
        }
        continue;
      }

      if (src.type === "onchain_activity") {
        const minValue = parseFloat(src.config.min_value ?? "0");
        const chain = src.config.chain ?? "all";
        // Find trades near this tick's timestamp
        const windowStart = tickTs - Math.floor(tickInterval);
        const windowEnd = tickTs;
        const matching = onchainTradeHistory.filter((tr) => {
          if (tr.timestamp < windowStart || tr.timestamp > windowEnd) return false;
          if (minValue > 0 && tr.dollar_value < minValue) return false;
          if (chain !== "all" && tr.chain !== chain) return false;
          return true;
        });
        for (const tr of matching.slice(0, 5)) {
          rivers.push({
            tx_hash: tr.tx_hash,
            from_address: tr.from_address,
            to_address: tr.to_address,
            token: tr.token,
            dollar_value: tr.dollar_value,
            chain: tr.chain,
            block_timestamp: new Date(tr.timestamp * 1000).toISOString(),
          });
        }
        continue;
      }

      if (src.type === "twitter_monitor") {
        // In backtest, use historical news as tweet source (same as live mode's synthetic approach).
        // Per-tick window so tweets are distributed, not clustered at end.
        const windowStart = tickTs - Math.floor(tickInterval);
        const windowEnd = tickTs;
        const tickDate = new Date(windowEnd * 1000);
        const windowStartDate = new Date(windowStart * 1000);
        const twKeywords = (src.config.keywords ?? "").split(/[\s,]+/).filter(Boolean).map((k: string) => k.toLowerCase());

        let twFiltered = articles
          .filter((a) => {
            const pub = new Date(a.publishedAt);
            return pub > windowStartDate && pub <= tickDate;
          })
          .filter((a) => {
            if (twKeywords.length === 0) return true;
            const text = a.title.toLowerCase();
            return twKeywords.some((kw: string) => text.includes(kw));
          })
          .slice(0, 3);

        // Fallback: spread articles evenly across ticks
        if (twFiltered.length === 0) {
          const topicFiltered = articles.filter((a) => {
            if (twKeywords.length === 0) return true;
            const text = a.title.toLowerCase();
            return twKeywords.some((kw: string) => text.includes(kw));
          });
          if (topicFiltered.length > 0) {
            const chunkSize = Math.max(1, Math.ceil(topicFiltered.length / cfg.ticks));
            const start = t * chunkSize;
            twFiltered = topicFiltered.slice(start, start + chunkSize).slice(0, 3);
          }
        }

        for (const a of twFiltered) {
          rivers.push({
            tweet_text: a.title,
            author_handle: `@${a.source.replace(/\s+/g, "").toLowerCase()}`,
            author_followers: 50000,
            author_verified: true,
            timestamp: a.publishedAt,
            retweet_count: 0,
            like_count: 0,
          });
        }
        continue;
      }

      if (src.type === "calendar_timer") {
        // In backtest, fire on every tick
        rivers.push({
          fired_at: new Date(tickTs * 1000).toISOString(),
          fire_reason: "backtest_tick",
          next_fire_at: new Date((tickTs + Math.floor(tickInterval)) * 1000).toISOString(),
        });
        continue;
      }

      // market feed nodes (polymarket_feed, gemini_markets_feed, etc.)
      const markets = marketsBySource[src.id] ?? [];
      for (const mkt of markets) {
        const price = priceAt(mkt.history, tickTs);
        if (price == null) continue;
        marketsScanned++;

        // Use the same field names as the live executor data sources so the
        // real edge_calculator / trade_advanced / alert_advanced read them.
        const base: River = {
          event_title: mkt.eventTitle,
          market_id: mkt.marketId,
          platform: mkt.platform,
          spread: 0.01,
          volume_24h: 0,
          category: mkt.category,
        };
        if (mkt.platform === "polymarket") {
          base.yes_price = price;
          base.no_price = parseFloat((1 - price).toFixed(4));
          base.liquidity = 0;
        } else {
          // gemini
          base.contract_price = price;
          base.bid_price = Math.max(0.01, price - 0.005);
          base.ask_price = Math.min(0.99, price + 0.005);
          base.instrument_symbol = mkt.marketId;
        }
        rivers.push(base);
      }

      // Track this source as active if it produced any rivers
      if (rivers.length > riversBefore) tickActiveNodeIds.push(src.id);
    }


    // --- Process each river through downstream nodes ---
    // Track which markets have already been traded this tick to prevent duplicates
    // from multiple news articles pointing to the same market.
    const tradedThisTick = new Set<string>();
    const tickNarrations: TickNarration[] = [];
    const tickNodeOutputs: Record<string, Record<string, any>> = {};

    for (const river of rivers) {
      const outputMap: Record<string, Record<string, any>> = {};
      outputMap["__source__"] = river;
      // Track blocked nodes — only downstream of blocked gates are affected,
      // not the entire pipeline (matches live executor behavior).
      const blockedNodes = new Set<string>();
      let riverTradeAction: "BUY" | "SELL" | null = null;
      let riverTradeDir: "YES" | "NO" | undefined;
      let riverTradeAmt: number | undefined;
      let riverTradePrice: number | undefined;

      for (const node of downstream) {
        if (blockedNodes.has(node.id)) continue;

        // Build river: merge initial + upstream outputs
        const builtRiver: River = { ...river };
        const incoming = strategy.connections.filter((c) => c.target_id === node.id);
        let nodeUnreachable = false;
        for (const conn of incoming) {
          const src = outputMap[conn.source_id];
          if (!src) continue;
          // Only check _active_handle on the DIRECT source — don't leak through
          if (src._active_handle && conn.source_handle !== src._active_handle) {
            nodeUnreachable = true;
            break;
          }
          Object.entries(src).forEach(([k, v]) => { if (!k.startsWith("_")) builtRiver[k] = v; });
          Object.entries(src).forEach(([k, v]) => { if (k.startsWith("_")) builtRiver[k] = v; });
        }
        if (nodeUnreachable) continue;

        let outputs: Record<string, any> = {};

        // --- Reactive data sources: search markets using upstream context ---
        if (node.category === "data") {
          outputs = await _runReactiveSource(
            node, builtRiver, tickTs, startTs, endTs,
            polymarketSearchPool, geminiSearchPool, historyCache, allMarkets,
          );
        // --- AI nodes: use cached real Claude calls ---
        } else if (node.category === "ai") {
          switch (node.type) {
            case "ai_analyst":
            case "ai_estimate": {
              // If the river comes from a news/text source (has headline but no
              // market event_title), use the real runAINode so the node's custom
              // instruction is used (e.g. "Output search_terms for markets").
              // cachedAIEstimate is for market event titles only — it asks Claude
              // to estimate probability of an event, which doesn't work for news.
              const hasMarketContext = !!builtRiver.event_title;
              if (!hasMarketContext) {
                try {
                  // eslint-disable-next-line @typescript-eslint/no-require-imports
                  const { runAINode: realAIRunner } = require("./node-runners/ai-nodes");
                  outputs = await realAIRunner(node, builtRiver);
                } catch {
                  outputs = { analyst_probability: 0.5, analyst_confidence: "low", analyst_direction: "neutral", analyst_reasoning: "AI call failed", search_terms: "" };
                }
              } else {
                const title = builtRiver.event_title;
                const result = await cachedAIEstimate(title);
                if (node.type === "ai_analyst") {
                  outputs = {
                    analyst_probability: result.ai_probability,
                    analyst_confidence: result.ai_confidence,
                    analyst_direction: result.ai_probability != null ? (result.ai_probability > 0.55 ? "bullish" : result.ai_probability < 0.45 ? "bearish" : "neutral") : "neutral",
                    analyst_reasoning: result.ai_reasoning,
                    search_terms: result.search_terms,
                  };
                } else {
                  outputs = result;
                }
              }
              break;
            }
            case "sentiment_scanner":
            case "sentiment": {
              const text = builtRiver.headline || builtRiver.event_title || builtRiver.description || "";
              const result = text ? await cachedSentiment(text) : { sentiment_score: 0, sentiment_label: "neutral" };
              if (node.type === "sentiment_scanner") {
                outputs = {
                  scanner_sentiment_score: Math.round((result.sentiment_score ?? 0) * 100),
                  scanner_magnitude: Math.round(Math.abs((result.sentiment_score ?? 0)) * 100),
                  scanner_volume_count: 1,
                };
              } else {
                outputs = result;
              }
              break;
            }
            case "history_tracker": {
              // Custom backtest implementation — uses tick timestamp instead of
              // Date.now() so the time_window config works correctly during replay.
              outputs = runBacktestHistoryTracker(node, builtRiver, tickTs);
              break;
            }
            default: {
              try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { runAINode: realAIRunner } = require("./node-runners/ai-nodes");
                outputs = await realAIRunner(node, builtRiver);
              } catch {
                outputs = {};
              }
              break;
            }
          }
        } else if (node.category === "logic") {
          outputs = runLogicNode(node, builtRiver);
          if (outputs._gate_result === false) {
            // Block only downstream nodes, not the entire pipeline
            const q = [node.id];
            while (q.length) {
              const id = q.shift()!;
              for (const c of strategy.connections) {
                if (c.source_id === id && !blockedNodes.has(c.target_id)) {
                  blockedNodes.add(c.target_id);
                  q.push(c.target_id);
                }
              }
            }
            outputMap[node.id] = { ...builtRiver, ...outputs };
            continue;
          }
        } else if (node.category === "action") {
          const actionResult = runActionNode(node, builtRiver);
          if (actionResult.trade) {
            const tr = actionResult.trade;
            const currentPrice = builtRiver.yes_price ?? builtRiver.contract_price ?? builtRiver.current_price ?? null;
            // Dedup: skip if we already traded this market+action this tick.
            const tradeKey = `${tr.marketId}:${tr.action}`;
            if (currentPrice != null && !tradedThisTick.has(tradeKey)) {
              tradedThisTick.add(tradeKey);
              riverTradeAction = tr.action === "sell" ? "SELL" : "BUY";
              riverTradeDir = tr.direction;
              riverTradeAmt = tr.amount;
              riverTradePrice = currentPrice;

              if (tr.action === "sell") {
                // Close open positions for this market
                for (let i = openPositions.length - 1; i >= 0; i--) {
                  const pos = openPositions[i];
                  if (pos.marketId === tr.marketId) {
                    const exitPrice = priceAt(pos.market.history, tickTs) ?? currentPrice;
                    const pnl = pos.direction === "YES"
                      ? (exitPrice - pos.entryPrice) * pos.amount
                      : (pos.entryPrice - exitPrice) * pos.amount;
                    allTrades.push({
                      tick: t,
                      timestamp: new Date(tickTs * 1000).toISOString(),
                      marketId: pos.marketId,
                      eventTitle: pos.eventTitle,
                      platform: pos.platform,
                      direction: pos.direction,
                      entryPrice: parseFloat(pos.entryPrice.toFixed(4)),
                      exitPrice: parseFloat(exitPrice.toFixed(4)),
                      amount: pos.amount,
                      pnl: parseFloat(pnl.toFixed(2)),
                      status: "closed",
                      exitReason: "sell signal (price stalled)",
                    });
                    equity += pnl;
                    openPositions.splice(i, 1);
                    tradesThisTick++;
                  }
                }
              } else {
                // Buy — open a new position
                const market = allMarkets.find((m) => m.marketId === tr.marketId);
                if (market) {
                  openPositions.push({
                    entryTick: t,
                    entryTs: tickTs,
                    entryPrice: currentPrice,
                    marketId: tr.marketId,
                    eventTitle: tr.eventTitle,
                    platform: tr.platform,
                    direction: tr.direction,
                    amount: tr.amount,
                    market,
                    exitStrategy: tr.exitStrategy,
                    exitTicks: tr.exitTicks,
                    takeProfit: tr.takeProfit,
                    stopLoss: tr.stopLoss,
                  });
                  tradesThisTick++;
                }
              }
            }
          }
        }

        const accumulated = { ...builtRiver, ...outputs };
        // Don't leak _active_handle through non-router nodes (same fix as live executor)
        if (!outputs._active_handle) delete accumulated._active_handle;
        outputMap[node.id] = accumulated;

        // Track active nodes and their outputs for canvas visualization
        if (Object.keys(outputs).length > 0) {
          if (!tickActiveNodeIds.includes(node.id)) tickActiveNodeIds.push(node.id);
          // Merge outputs (later rivers overwrite earlier for same node)
          tickNodeOutputs[node.id] = { ...tickNodeOutputs[node.id], ...outputs };
        }
      }

      // --- Collect narration from this river's outputs ---
      const narration: TickNarration = {
        headline: river.headline,
        eventTitle: river.event_title,
        marketPrice: river.yes_price ?? river.contract_price ?? river.current_price,
        platform: river.platform,
      };
      for (const [nid, out] of Object.entries(outputMap)) {
        if (nid === "__source__") continue;
        if (out.analyst_probability != null) {
          narration.aiEstimate = out.analyst_probability;
          narration.aiConfidence = out.analyst_confidence;
          narration.aiDirection = out.analyst_direction;
        }
        if (out.scanner_sentiment_score != null) {
          narration.sentimentScore = out.scanner_sentiment_score;
        }
        if (out.ec_edge_pct != null) {
          narration.edgePct = out.ec_edge_pct;
          narration.rawEdge = out.ec_raw_edge;
          narration.adjustedEdge = out.ec_edge;
          narration.sourceWeight = out.ec_source_weight;
          narration.timeDecay = out.ec_time_decay;
          narration.liquidityFactor = out.ec_liquidity_factor;
        }
        if (out._gate_result != null && narration.gateResult == null) {
          narration.gateResult = out._gate_result;
          narration.gateDetails = out._gate_details;
        }
      }
      // Attach trade info from this river
      narration.tradeAction = riverTradeAction;
      narration.tradeDirection = riverTradeDir;
      narration.tradeAmount = riverTradeAmt;
      narration.tradePrice = riverTradePrice;
      // Only include narrations that have at least some meaningful data
      if (narration.aiEstimate != null || narration.edgePct != null || narration.eventTitle) {
        tickNarrations.push(narration);
      }
    }

    // --- Track equity including unrealized P&L on open positions ---
    let unrealized = 0;
    for (const pos of openPositions) {
      const currentPrice = priceAt(pos.market.history, tickTs) ?? pos.entryPrice;
      const uPnl = pos.direction === "YES"
        ? (currentPrice - pos.entryPrice) * pos.amount
        : (pos.entryPrice - currentPrice) * pos.amount;
      unrealized += uPnl;
    }

    const totalEquity = equity + unrealized;
    if (totalEquity > peak) peak = totalEquity;
    const dd = peak - totalEquity;
    if (dd > maxDD) maxDD = dd;

    tickData.push({
      tick: t,
      timestamp,
      equity: parseFloat(totalEquity.toFixed(2)),
      drawdown: parseFloat(dd.toFixed(2)),
      tradesThisTick,
      marketsScanned,
      narrations: tickNarrations.length > 0 ? tickNarrations : undefined,
      activeNodeIds: tickActiveNodeIds.length > 0 ? tickActiveNodeIds : undefined,
      nodeOutputs: Object.keys(tickNodeOutputs).length > 0 ? tickNodeOutputs : undefined,
    });

    if (onProgress) {
      const runningMetrics = computeMetrics(allTrades, totalEquity, cfg.startingCapital, peak, maxDD);
      await onProgress({
        type: "tick",
        tick: t,
        totalTicks: cfg.ticks,
        data: {
          strategyId: strategy.id,
          strategyName: strategy.name,
          config: cfg,
          ticks: tickData,
          trades: allTrades,
          marketsUsed: allMarkets.map((m) => ({ id: m.marketId, title: m.eventTitle, platform: m.platform })),
          metrics: runningMetrics,
        },
      });
    }
  }

  // --- Close any remaining open positions at the final price ---
  const finalTs = endTs;
  for (const pos of openPositions) {
    const exitPrice = priceAt(pos.market.history, finalTs) ?? pos.entryPrice;
    const pnl = pos.direction === "YES"
      ? (exitPrice - pos.entryPrice) * pos.amount
      : (pos.entryPrice - exitPrice) * pos.amount;

    allTrades.push({
      tick: cfg.ticks - 1,
      timestamp: new Date(finalTs * 1000).toISOString(),
      marketId: pos.marketId,
      eventTitle: pos.eventTitle,
      platform: pos.platform,
      direction: pos.direction,
      entryPrice: parseFloat(pos.entryPrice.toFixed(4)),
      exitPrice: parseFloat(exitPrice.toFixed(4)),
      amount: pos.amount,
      pnl: parseFloat(pnl.toFixed(2)),
      status: "open",
      exitReason: "backtest ended",
    });

    equity += pnl;
  }

  // --- Compute final metrics ---
  const finalMetrics = computeMetrics(allTrades, equity, cfg.startingCapital, peak, maxDD);

  const finalResult: BacktestResult = {
    strategyId: strategy.id,
    strategyName: strategy.name,
    config: cfg,
    ticks: tickData,
    trades: allTrades,
    marketsUsed: allMarkets.map((m) => ({ id: m.marketId, title: m.eventTitle, platform: m.platform })),
    metrics: finalMetrics,
  };

  onProgress?.({ type: "done", data: finalResult });
  return finalResult;
}
