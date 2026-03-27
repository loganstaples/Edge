// src/lib/engine/node-runners/data-sources.ts
import type { StrategyNode } from "@/types";
import { getRecentArticles } from "@/lib/db/queries";
import { fetchAllActiveGeminiEvents, getImpliedProbability } from "@/lib/data/gemini";
import { fetchActivePolymarkets } from "@/lib/data/polymarket";
import type { River } from "../executor";
import { createHash } from "crypto";
import type { GeminiEvent, PolymarketMarket } from "@/types";

/**
 * Data source runners return an ARRAY of river objects (fan-out).
 * Each item becomes an independent river flowing through the graph.
 */
export async function runDataSource(node: StrategyNode, _river: River): Promise<River[]> {
  switch (node.type) {
    case "news_monitor":
      return await runNewsMonitor(node);
    case "polymarket_feed":
      return await runPolymarketFeed(node);
    case "gemini_markets_feed":
      return await runGeminiMarketsFeed(node);
    case "twitter_monitor":
      return await runTwitterMonitor(node);
    case "crypto_price":
      return await runCryptoPrice(node);
    case "onchain_activity":
      return await runOnChainActivity(node);
    case "calendar_timer":
      return await runCalendarTimer(node);
    case "strategy_link":
      return await runStrategyLink(node);
    default:
      return [];
  }
}

// --- News Monitor ---

const TOP_OUTLETS = ["reuters", "ap", "associated press", "bloomberg", "wsj", "wall street journal"];
const MAJOR_OUTLETS = [...TOP_OUTLETS, "cnn", "bbc", "nyt", "new york times", "cnbc", "guardian", "washington post", "financial times"];

function getSourceTier(sourceName: string): number {
  const lower = sourceName.toLowerCase();
  if (TOP_OUTLETS.some((o) => lower.includes(o))) return 1;
  if (MAJOR_OUTLETS.some((o) => lower.includes(o))) return 2;
  return 3;
}

async function runNewsMonitor(node: StrategyNode): Promise<River[]> {
  const articles = getRecentArticles(30);
  const keywords = (node.config.keywords || "")
    .split(",")
    .map((t: string) => t.trim().toLowerCase())
    .filter(Boolean);
  const tierFilter = node.config.source_tier ?? "all_major";

  return articles
    .filter((a) => {
      // Filter by source tier
      const tier = getSourceTier(a.source || "");
      if (tierFilter === "top" && tier > 1) return false;
      if (tierFilter === "all_major" && tier > 2) return false;
      // "everything" passes all tiers

      // Filter by keywords
      if (keywords.length === 0) return true;
      const text = `${a.title} ${a.description || ""}`.toLowerCase();
      return keywords.some((k: string) => text.includes(k));
    })
    .slice(0, 15)
    .map((a) => ({
      headline: a.title,
      source_name: a.source,
      source_tier: getSourceTier(a.source || ""),
      published_at: a.publishedAt,
      url: a.url || "",
    }));
}

// --- Polymarket Feed ---

async function runPolymarketFeed(node: StrategyNode): Promise<River[]> {
  const searchQuery = (node.config.market_search || "").toLowerCase();
  const watchMode = node.config.watch_mode ?? "single";
  const category = (node.config.category || "all").toLowerCase();
  const maxResults = node.config.max_results ?? 10;

  let markets: PolymarketMarket[] = [];
  try {
    markets = await fetchActivePolymarkets(50);
  } catch {
    return [];
  }

  // Filter
  markets = markets.filter((m) => {
    if (watchMode === "single" && searchQuery) {
      if (!m.question.toLowerCase().includes(searchQuery)) return false;
    }
    if (watchMode === "category" && category && category !== "all") {
      const tags = (m.tags ?? []).map((t: string) => t.toLowerCase());
      if (!tags.some((t: string) => t.includes(category))) return false;
    }
    return true;
  });

  return markets.slice(0, maxResults).map((m) => {
    const yesToken = m.tokens?.find((t) => t.outcome === "Yes");
    const noToken = m.tokens?.find((t) => t.outcome === "No");
    const yesPrice = yesToken?.price ?? 0.5;
    const noPrice = noToken?.price ?? 0.5;

    return {
      event_title: m.question,
      market_id: yesToken?.token_id || m.condition_id,
      yes_price: yesPrice,
      no_price: noPrice,
      spread: Math.abs(yesPrice - (1 - noPrice)),
      volume_24h: 0,
      liquidity: 0,
      last_trade_at: "",
      bids: [],
      asks: [],
    };
  });
}

// --- Gemini Markets Feed ---

/** Tracks previous Gemini prices per node for significant move detection */
const geminiPriceTracker: Record<string, Record<string, number>> = {};

async function runGeminiMarketsFeed(node: StrategyNode): Promise<River[]> {
  const searchQuery = (node.config.event_search || "").toLowerCase();
  const watchMode = node.config.watch_mode ?? "single";
  const category = (node.config.category || "all").toLowerCase();
  const maxResults = node.config.max_results ?? 10;
  const alertThreshold = node.config.alert_threshold ?? 5;

  let events: GeminiEvent[] = [];
  try {
    events = await fetchAllActiveGeminiEvents();
  } catch {
    return [];
  }

  // Filter
  events = events.filter((e) => {
    if (watchMode === "single" && searchQuery) {
      if (!e.title.toLowerCase().includes(searchQuery)) return false;
    }
    if (watchMode === "category" && category && category !== "all") {
      if (e.category?.toLowerCase() !== category) return false;
    }
    return true;
  });

  if (!geminiPriceTracker[node.id]) geminiPriceTracker[node.id] = {};

  return events.slice(0, maxResults).map((e) => {
    const contract = e.contracts?.[0];
    const contractPrice = contract ? getImpliedProbability(contract) : 0.5;
    const bidPrice = contract ? parseFloat(contract.prices.bestBid || "0") : 0;
    const askPrice = contract ? parseFloat(contract.prices.bestAsk || "0") : 0;
    const lastTradePrice = contract ? parseFloat(contract.prices.lastTradePrice || "0") : 0;
    const instrumentSymbol = contract?.instrumentSymbol || e.id;

    // Detect significant moves
    const prevPrice = geminiPriceTracker[node.id][instrumentSymbol] ?? contractPrice;
    geminiPriceTracker[node.id][instrumentSymbol] = contractPrice;
    const movePct = prevPrice > 0 ? Math.abs((contractPrice - prevPrice) / prevPrice) * 100 : 0;
    const significantMove = movePct >= alertThreshold;

    return {
      event_title: e.title,
      market_id: e.id,
      instrument_symbol: instrumentSymbol,
      contract_price: contractPrice,
      bid_price: bidPrice,
      ask_price: askPrice,
      last_trade_price: lastTradePrice,
      spread: askPrice - bidPrice,
      liquidity: parseFloat(e.volume || "0"),
      event_status: "active",
      expiry_date: e.expiryDate || "",
      category: e.category || "",
      significant_move: significantMove,
    };
  });
}

// --- X/Twitter Monitor ---

async function runTwitterMonitor(node: StrategyNode): Promise<River[]> {
  // Twitter API requires authentication — for hackathon, return simulated data
  // based on news feed content styled as tweets
  const keywords = (node.config.keywords || "")
    .split(",")
    .map((t: string) => t.trim().toLowerCase())
    .filter(Boolean);
  const watchHandles = (node.config.handles || "")
    .split(",")
    .map((h: string) => h.trim().replace("@", "").toLowerCase())
    .filter(Boolean);
  const minFollowers = parseInt(node.config.min_followers ?? "1000", 10);
  const verifiedOnly = node.config.verified_only ?? false;

  // Use news articles as a proxy for tweet-like content
  const articles = getRecentArticles(20);

  return articles
    .filter((a) => {
      if (keywords.length === 0 && watchHandles.length === 0) return true;
      const text = `${a.title} ${a.description || ""}`.toLowerCase();
      const matchesKeyword = keywords.length === 0 || keywords.some((k: string) => text.includes(k));
      const matchesHandle = watchHandles.length === 0 || watchHandles.some((h: string) => (a.source || "").toLowerCase().includes(h));
      return matchesKeyword || matchesHandle;
    })
    .slice(0, 10)
    .map((a) => {
      const followerCount = 50000 + Math.floor(Math.random() * 950000);
      const isVerified = followerCount > 100000;
      if (verifiedOnly && !isVerified) return null;
      if (followerCount < minFollowers) return null;
      return {
        tweet_text: a.title,
        author_handle: (a.source || "unknown").replace(/\s+/g, "").toLowerCase(),
        author_followers: followerCount,
        author_verified: isVerified,
        timestamp: a.publishedAt,
        retweet_count: Math.floor(Math.random() * 500),
        like_count: Math.floor(Math.random() * 2000),
      };
    })
    .filter(Boolean) as River[];
}

// --- Crypto Price ---

async function runCryptoPrice(node: StrategyNode): Promise<River[]> {
  const token = (node.config.token ?? "BTC").toUpperCase();
  const pair = `${token}USD`;

  try {
    const res = await fetch(`https://api.gemini.com/v2/ticker/${pair.toLowerCase()}`);
    if (!res.ok) return [];
    const data = await res.json();

    const currentPrice = parseFloat(data.close || data.last || "0");
    const open = parseFloat(data.open || "0");
    const high = parseFloat(data.high || "0");
    const low = parseFloat(data.low || "0");
    const volume = parseFloat(data.volume?.[token] || "0");
    const changePct = open > 0 ? ((currentPrice - open) / open) * 100 : 0;
    const changeAbs = currentPrice - open;

    return [{
      current_price: currentPrice,
      change_pct: Math.round(changePct * 100) / 100,
      change_abs: Math.round(changeAbs * 100) / 100,
      volume_24h: volume,
      high_24h: high,
      low_24h: low,
      token,
    }];
  } catch {
    return [];
  }
}

// --- On-Chain Activity ---

async function runOnChainActivity(node: StrategyNode): Promise<River[]> {
  const mode = node.config.mode ?? "whale_alerts";
  const chain = (node.config.chain ?? "all").toLowerCase();

  if (mode === "watch_wallet") {
    const address = (node.config.wallet_address || "").trim();
    if (!address) return [];

    // Use Etherscan-style API for Ethereum wallet watching
    // For hackathon, simulate with recent block data
    try {
      const res = await fetch(
        `https://api.gemini.com/v1/trades/btcusd?limit_trades=5`
      );
      if (!res.ok) return [];
      const trades = await res.json();

      return (trades as any[]).slice(0, 3).map((t: any) => ({
        tx_hash: `0x${createHash("sha256").update(String(t.tid)).digest("hex").slice(0, 64)}`,
        from_address: address,
        to_address: `0x${createHash("sha256").update(String(t.tid + 1)).digest("hex").slice(0, 40)}`,
        token: t.type === "buy" ? "ETH" : "USDC",
        dollar_value: parseFloat(t.amount) * parseFloat(t.price),
        chain: "ethereum",
        block_timestamp: new Date(t.timestamp * 1000).toISOString(),
      }));
    } catch {
      return [];
    }
  }

  // Whale alerts mode — use Gemini trades as a proxy for large transactions
  const minValue = parseInt(node.config.min_value ?? "1000000", 10);

  try {
    const pairs = chain === "bitcoin" ? ["btcusd"] :
                  chain === "solana" ? ["solusd"] :
                  chain === "ethereum" ? ["ethusd"] :
                  ["btcusd", "ethusd"];

    const results: River[] = [];

    for (const pair of pairs) {
      const res = await fetch(`https://api.gemini.com/v1/trades/${pair}?limit_trades=10`);
      if (!res.ok) continue;
      const trades = await res.json();
      const token = pair.replace("usd", "").toUpperCase();
      const txChain = token === "BTC" ? "bitcoin" : token === "SOL" ? "solana" : "ethereum";

      for (const t of trades as any[]) {
        const dollarValue = parseFloat(t.amount) * parseFloat(t.price);
        if (dollarValue < minValue) continue;

        results.push({
          tx_hash: `0x${createHash("sha256").update(String(t.tid)).digest("hex").slice(0, 64)}`,
          from_address: `0x${createHash("sha256").update(String(t.tid)).digest("hex").slice(0, 40)}`,
          to_address: `0x${createHash("sha256").update(String(t.tid + 1)).digest("hex").slice(0, 40)}`,
          token,
          dollar_value: Math.round(dollarValue),
          chain: txChain,
          block_timestamp: new Date(t.timestamp * 1000).toISOString(),
        });
      }
    }

    results.sort((a, b) => (b.dollar_value as number) - (a.dollar_value as number));
    return results.slice(0, 10);
  } catch {
    return [];
  }
}

// --- Calendar/Timer ---

/** Tracks last fire time per node for interval/scheduled logic */
const timerTracker: Record<string, number> = {};

async function runCalendarTimer(node: StrategyNode): Promise<River[]> {
  const mode = node.config.mode ?? "interval";
  const now = Date.now();
  const lastFire = timerTracker[node.id] ?? 0;

  if (mode === "interval") {
    const intervalSec = parseInt(node.config.interval ?? "300", 10);
    const intervalMs = intervalSec * 1000;

    // First run always fires; subsequent runs check interval
    if (lastFire > 0 && now - lastFire < intervalMs) return [];

    timerTracker[node.id] = now;
    return [{
      fired_at: new Date(now).toISOString(),
      fire_reason: `interval_${intervalSec}s`,
      next_fire_at: new Date(now + intervalMs).toISOString(),
    }];
  }

  if (mode === "scheduled") {
    const scheduledTime = node.config.scheduled_time ?? "09:00";
    const allowedDays: string[] = node.config.days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const [hours, minutes] = scheduledTime.split(":").map(Number);
    const currentDate = new Date();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDay = dayNames[currentDate.getDay()];

    if (!allowedDays.includes(currentDay)) return [];

    const scheduledToday = new Date(currentDate);
    scheduledToday.setHours(hours, minutes, 0, 0);
    const scheduledMs = scheduledToday.getTime();

    // Fire if we're within 30s of the scheduled time and haven't fired yet for this window
    if (Math.abs(now - scheduledMs) > 30000) return [];
    if (lastFire > 0 && now - lastFire < 60000) return [];

    timerTracker[node.id] = now;
    return [{
      fired_at: new Date(now).toISOString(),
      fire_reason: `scheduled_${scheduledTime}`,
      next_fire_at: new Date(scheduledMs + 86400000).toISOString(),
    }];
  }

  if (mode === "one_shot") {
    const fireAt = node.config.fire_at;
    if (!fireAt) return [];
    const fireTime = new Date(fireAt).getTime();
    if (isNaN(fireTime)) return [];

    // Fire if we're within 30s of the target and haven't fired yet
    if (Math.abs(now - fireTime) > 30000) return [];
    if (lastFire > 0) return []; // one-shot: never fire again

    timerTracker[node.id] = now;
    return [{
      fired_at: new Date(now).toISOString(),
      fire_reason: "one_shot",
      next_fire_at: "",
    }];
  }

  return [];
}

// --- Strategy Link ---

async function runStrategyLink(node: StrategyNode): Promise<River[]> {
  const strategyId = node.config.strategy_id;
  if (!strategyId) return [];

  try {
    const { getStrategy, getExecutionLogs, getSimulatedTrades } = await import("@/lib/db/queries");
    const strategy = getStrategy(strategyId);
    if (!strategy) return [];

    // Get latest execution log for signal/edge
    const logs = getExecutionLogs(strategyId, 1);
    const latestLog = logs[0];

    // Get trades for PnL/position
    const trades = getSimulatedTrades(strategyId);
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const openTrades = trades.filter((t) => t.status === "open");

    // Derive signal from latest log
    let signal = "neutral";
    if (latestLog?.nodeLogs) {
      const nodeValues = Object.values(latestLog.nodeLogs) as any[];
      const edgeNode = nodeValues.find((n: any) => n.edge != null);
      if (edgeNode) {
        signal = edgeNode.edge > 0.02 ? "bullish" : edgeNode.edge < -0.02 ? "bearish" : "neutral";
      }
    }

    // Derive edge from latest log
    let edge = 0;
    if (latestLog?.nodeLogs) {
      const nodeValues = Object.values(latestLog.nodeLogs) as any[];
      const edgeNode = nodeValues.find((n: any) => n.edge != null);
      if (edgeNode) edge = edgeNode.edge;
    }

    return [{
      linked_strategy_name: strategy.name,
      linked_signal: signal,
      linked_edge: edge,
      linked_pnl: Math.round(totalPnl * 100) / 100,
      linked_status: strategy.status,
      linked_last_trade: latestLog?.timestamp ?? "",
      linked_position: openTrades.length > 0
        ? `${openTrades.length} open (${openTrades.map((t) => t.direction).join(", ")})`
        : "flat",
    }];
  } catch {
    return [];
  }
}
