// src/lib/engine/backtester.ts
// Real backtesting engine — fetches actual historical prices from
// Polymarket & Gemini, calls Claude for AI nodes (cached per event),
// then replays the strategy tick-by-tick against real market data.

import type { Strategy, StrategyNode, StrategyConnection } from "@/types";
import Anthropic from "@anthropic-ai/sdk";
import { fetchAllActiveGeminiEvents, fetchGeminiTicker } from "@/lib/data/gemini";
import { fetchActivePolymarkets } from "@/lib/data/polymarket";
import { getRecentArticles } from "@/lib/db/queries";
import { computeEdge } from "./edge";

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

export interface BacktestTick {
  tick: number;
  timestamp: string;
  equity: number;
  drawdown: number;
  tradesThisTick: number;
  marketsScanned: number;
}

export interface BacktestResult {
  strategyId: string;
  strategyName: string;
  config: BacktestConfig;
  ticks: BacktestTick[];
  trades: BacktestTrade[];
  marketsUsed: { id: string; title: string; platform: string }[];
  metrics: {
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
      base_rate_reference: parsed.base_rate_reference ?? "",
      strongest_counter: parsed.strongest_counter ?? "",
    };
    aiCache.set(cacheKey, result);
    return result;
  } catch {
    const fallback = { ai_probability: 0.5, ai_confidence: "low", ai_reasoning: "AI call failed", key_factors: [], key_factor_count: 0 };
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

async function cachedAICustom(prompt: string, riverStr: string): Promise<Record<string, any>> {
  const cacheKey = `custom:${prompt.slice(0, 50)}:${riverStr.slice(0, 50)}`;
  if (aiCache.has(cacheKey)) return aiCache.get(cacheKey)!;

  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: prompt,
      messages: [{ role: "user", content: riverStr }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      const result = typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { ai_response: parsed };
      aiCache.set(cacheKey, result);
      return result;
    } catch {
      const result = { ai_response: text };
      aiCache.set(cacheKey, result);
      return result;
    }
  } catch {
    return { ai_response: null };
  }
}

// ---------------------------------------------------------------------------
// 4. Deterministic node runners (logic, edge_calc, actions)
// ---------------------------------------------------------------------------

interface Condition { field: string; operator: string; value: string | number }

function evalCondition(c: Condition, river: River): boolean {
  const v = river[c.field];
  if (v === undefined || v === null) return false;
  const target = typeof v === "number" ? Number(c.value) : c.value;
  switch (c.operator) {
    case ">": return v > target;
    case "<": return v < target;
    case ">=": return v >= target;
    case "<=": return v <= target;
    case "==": return String(v) === String(target);
    case "!=": return String(v) !== String(target);
    case "contains": return String(v).toLowerCase().includes(String(target).toLowerCase());
    case "between": { const [lo, hi] = String(c.value).split(",").map(Number); return v >= lo && v <= hi; }
    default: return false;
  }
}

function runEdgeCalc(river: River): Record<string, any> {
  const aiProb = river.ai_probability;
  const marketPrice = river.price;
  if (aiProb == null || marketPrice == null) {
    return {
      edge: null, edge_pct: null, effective_edge: null, signal_strength: "none",
      direction: null, composite_confidence: null, kelly_fraction: null,
      suggested_size: null, bayesian_edge: null, liquidity_score: null,
      kl_divergence: null, information_ratio: null, expected_value: null,
    };
  }

  const confidence = river.ai_confidence || "medium";
  const validConfidence = (["low", "medium", "high"].includes(confidence) ? confidence : "medium") as "low" | "medium" | "high";

  const result = computeEdge(aiProb, marketPrice, validConfidence, river.platform || "polymarket", {
    confidence: validConfidence,
    sourceCount: river.source_count ?? 1,
    keyFactorCount: river.key_factor_count ?? (river.key_factors?.length ?? 2),
    spread: river.spread ?? 0.01,
    volume: river.volume ?? 0,
    newsAgeHours: 1,
    sentimentScore: river.sentiment_score ?? undefined,
  });

  return {
    edge: result.edge,
    edge_pct: parseFloat((result.edge * 100).toFixed(1)),
    effective_edge: result.effectiveEdge,
    effective_edge_pct: parseFloat((result.effectiveEdge * 100).toFixed(1)),
    calibrated_probability: result.calibratedProbability,
    signal_strength: result.signalStrength,
    direction: result.edge > 0 ? "bullish" : result.edge < 0 ? "bearish" : "neutral",
    ai_uncertainty: result.aiUncertainty,
    kl_divergence: result.klDivergence,
    information_ratio: result.informationRatio,
    composite_confidence: result.compositeConfidence,
    kelly_fraction: result.kellyFraction,
    suggested_size: result.suggestedSize,
    bayesian_edge: result.bayesianEdge,
    liquidity_score: result.liquidityScore,
    market_efficiency: result.marketEfficiency,
    expected_value: result.expectedValue,
    risk_reward_ratio: result.riskRewardRatio,
    evpi: result.evpi,
  };
}

function runLogicNode(node: StrategyNode, river: River): Record<string, any> {
  // Import and delegate to the real logic runner for new node types
  // For backtest, cooldown/timer nodes are bypassed
  if (node.type === "cooldown_gate") return { _gate_result: true, cg_status: "passing", _gate_details: "Cooldown bypassed in backtest" };

  // Edge calculator, arb_detector, router, price_alert_decide, multi_condition_gate
  // all use _gate_result — delegate to real runner
  try {
    const { runLogicNode: realRunner } = require("./node-runners/logic-nodes");
    return realRunner(node, river);
  } catch {
    return {};
  }
}

interface TradeAction {
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
    let side = node.config.side ?? "auto";
    if (side === "auto") {
      const dir = river.direction || "bullish";
      side = dir === "bearish" ? "NO" : "YES";
    }
    const configuredSize = node.config.size_usd ?? 25;
    const kellySize = river.suggested_size;
    const useKelly = node.config.size_mode === "kelly" && kellySize != null && kellySize > 0;
    const amount = useKelly ? Math.min(kellySize, configuredSize * 4) : configuredSize;

    return {
      trade: {
        platform,
        marketId: river.market_id || "unknown",
        direction: side === "NO" ? "NO" : "YES",
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
// 7. Main backtest runner
// ---------------------------------------------------------------------------

export async function runBacktest(
  strategy: Strategy,
  config: Partial<BacktestConfig> = {},
): Promise<BacktestResult> {
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
  const sorted = topoSort(strategy.nodes, strategy.connections);
  const sourceNodes = sorted.filter((n) => n.category === "data");
  const downstream = sorted.filter((n) => n.category !== "data");

  const allMarkets: HistoricalMarket[] = [];
  const marketsBySource: Record<string, HistoricalMarket[]> = {};

  for (const src of sourceNodes) {
    if (src.type === "market_watch" || src.type === "price_alert" || src.type === "polymarket_feed" || src.type === "gemini_markets_feed") {
      const markets = await discoverMarkets(src, startTs, endTs);
      marketsBySource[src.id] = markets;
      allMarkets.push(...markets);
    }
  }

  // For news_feed nodes, load real articles from the DB
  const articles = getRecentArticles(100);

  // --- Phase 2: Pre-fetch AI estimates (cached, one call per unique event) ---
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
      openPositions.splice(idx, 1);
    }

    // --- Build rivers from data sources at this tick ---
    const rivers: River[] = [];

    for (const src of sourceNodes) {
      if (src.type === "news_feed" || src.type === "news_monitor") {
        // Feed real articles that existed before this tick's timestamp
        const tickDate = new Date(tickTs * 1000);
        const availableArticles = articles.filter(
          (a) => new Date(a.publishedAt) <= tickDate,
        );
        const topics = (src.config.topics || "")
          .split(",")
          .map((t: string) => t.trim().toLowerCase())
          .filter(Boolean);

        const filtered = availableArticles
          .filter((a) => {
            if (topics.length === 0) return true;
            const text = `${a.title} ${a.description || ""}`.toLowerCase();
            return topics.some((topic: string) => text.includes(topic));
          })
          .slice(0, 5);

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

      // market feed nodes (polymarket_feed, gemini_markets_feed, etc.)
      const markets = marketsBySource[src.id] ?? [];
      for (const mkt of markets) {
        const price = priceAt(mkt.history, tickTs);
        if (price == null) continue;
        marketsScanned++;

        rivers.push({
          event_title: mkt.eventTitle,
          market_id: mkt.marketId,
          platform: mkt.platform,
          price,
          bid: Math.max(0.01, price - 0.005),
          ask: Math.min(0.99, price + 0.005),
          spread: 0.01,
          volume: 0,
          category: mkt.category,
          expiry_date: "",
        });
      }
    }

    // --- Process each river through downstream nodes ---
    for (const river of rivers) {
      const outputMap: Record<string, Record<string, any>> = {};
      outputMap["__source__"] = river;
      let blocked = false;

      for (const node of downstream) {
        if (blocked) break;

        // Build river: merge initial + upstream outputs
        const builtRiver: River = { ...river };
        const incoming = strategy.connections.filter((c) => c.target_id === node.id);
        for (const conn of incoming) {
          const src = outputMap[conn.source_id];
          if (!src) continue;
          if (src._active_handle && conn.source_handle !== src._active_handle) {
            blocked = true;
            break;
          }
          Object.entries(src).forEach(([k, v]) => { if (!k.startsWith("_")) builtRiver[k] = v; });
          Object.entries(src).forEach(([k, v]) => { if (k.startsWith("_")) builtRiver[k] = v; });
        }
        if (blocked) break;

        let outputs: Record<string, any> = {};

        // --- AI nodes: use cached real Claude calls ---
        if (node.category === "ai") {
          switch (node.type) {
            case "ai_analyst":
            case "ai_estimate": {
              const title = builtRiver.event_title || builtRiver.headline || "";
              const result = title ? await cachedAIEstimate(title) : { ai_probability: null, ai_confidence: "low", ai_reasoning: "No context", key_factors: [] };
              // Map to analyst_ prefixed fields for ai_analyst
              if (node.type === "ai_analyst") {
                outputs = {
                  analyst_probability: result.ai_probability,
                  analyst_confidence: result.ai_confidence,
                  analyst_direction: result.ai_probability != null ? (result.ai_probability > 0.55 ? "bullish" : result.ai_probability < 0.45 ? "bearish" : "neutral") : "neutral",
                  analyst_reasoning: result.ai_reasoning,
                };
              } else {
                outputs = result;
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
            default: {
              // For consensus, history_tracker, formula — delegate to real runner
              try {
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
            blocked = true;
            outputMap[node.id] = outputs;
            continue;
          }
        } else if (node.category === "action") {
          const actionResult = runActionNode(node, builtRiver);
          if (actionResult.trade) {
            const tr = actionResult.trade;
            const entryPrice = builtRiver.price;
            if (entryPrice != null) {
              // Find the market for this trade so we can track exit
              const market = allMarkets.find((m) => m.marketId === tr.marketId);
              if (market) {
                openPositions.push({
                  entryTick: t,
                  entryTs: tickTs,
                  entryPrice,
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

        outputMap[node.id] = outputs;
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
    });
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

  // --- Compute metrics ---
  const wins = allTrades.filter((t) => t.pnl > 0);
  const losses = allTrades.filter((t) => t.pnl <= 0);
  const totalReturn = equity - cfg.startingCapital;
  const returns = allTrades.map((t) => t.pnl / (t.amount || 1));
  let sharpe = 0;
  if (returns.length >= 2) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
    sharpe = variance === 0 ? 0 : mean / Math.sqrt(variance);
  }
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    config: cfg,
    ticks: tickData,
    trades: allTrades,
    marketsUsed: allMarkets.map((m) => ({ id: m.marketId, title: m.eventTitle, platform: m.platform })),
    metrics: {
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      totalReturnPct: parseFloat(((totalReturn / cfg.startingCapital) * 100).toFixed(2)),
      totalTrades: allTrades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: allTrades.length > 0 ? parseFloat(((wins.length / allTrades.length) * 100).toFixed(1)) : 0,
      sharpeRatio: parseFloat(sharpe.toFixed(3)),
      maxDrawdown: parseFloat(maxDD.toFixed(2)),
      maxDrawdownPct: peak > 0 ? parseFloat(((maxDD / peak) * 100).toFixed(2)) : 0,
      avgTradeReturn: allTrades.length > 0 ? parseFloat((totalReturn / allTrades.length).toFixed(2)) : 0,
      profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : parseFloat((grossProfit / grossLoss).toFixed(2)),
      finalEquity: parseFloat(equity.toFixed(2)),
    },
  };
}
