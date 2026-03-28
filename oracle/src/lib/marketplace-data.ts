// ============================================================================
// Marketplace Seed Data — static strategies for demo
// ============================================================================

import type { StrategyNode, StrategyConnection } from "@/types";

export type MarketplaceStrategy = {
  id: string;
  name: string;
  creator: string;
  creatorAvatar: string; // deterministic gradient seed
  description: string;
  category: StrategyCategory;
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  avgEdge: number;
  sharpeRatio: number;
  maxDrawdown: number;
  nodeCount: number;
  clones: number;
  nftVerified: boolean;
  publishedAgo: string;
  nodePipeline: string[];
  equityCurve: number[];
  nodes: StrategyNode[];
  connections: StrategyConnection[];
};

export type StrategyCategory =
  | "All"
  | "Crypto"
  | "Politics"
  | "Economics"
  | "Sports"
  | "Multi-Market"
  | "Arbitrage";

export const CATEGORIES: StrategyCategory[] = [
  "All",
  "Crypto",
  "Politics",
  "Economics",
  "Sports",
  "Multi-Market",
  "Arbitrage",
];

export type SortOption =
  | "top-performing"
  | "most-cloned"
  | "newest"
  | "highest-win-rate";

export const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "top-performing", label: "Top Performing" },
  { id: "most-cloned", label: "Most Cloned" },
  { id: "newest", label: "Newest" },
  { id: "highest-win-rate", label: "Highest Win Rate" },
];

// Generate a realistic-looking equity curve
function generateEquityCurve(
  totalReturn: number,
  trades: number,
  seed: number,
): number[] {
  const points = 30;
  const curve: number[] = [100];
  const perStep = totalReturn / points;

  // Simple seeded pseudo-random
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (let i = 1; i <= points; i++) {
    const noise = (rand() - 0.45) * (totalReturn > 0 ? 3 : 5);
    const next = curve[i - 1] + perStep + noise;
    curve.push(Math.round(next * 100) / 100);
  }
  return curve;
}

// ============================================================================
// Node strategy blueprints for each marketplace strategy
// ============================================================================

const FED_RATE_HAWK_NODES: StrategyNode[] = [
  { id: "frh_news", type: "news_monitor", category: "data", position: { x: 0, y: 150 }, config: { keywords: "Federal Reserve, FOMC, interest rate, rate decision, Powell, Fed meeting", source_tier: "tier_1", refresh: "60" } },
  { id: "frh_gemini", type: "gemini_markets_feed", category: "data", position: { x: 0, y: 350 }, config: { event_search: "federal reserve, interest rate, FOMC", watch_mode: "watchlist", category: "economics", max_results: 5, alert_threshold: 5 } },
  { id: "frh_sentiment", type: "sentiment_scanner", category: "ai", position: { x: 350, y: 150 }, config: { domain: "finance", aggregation: "per_item" } },
  { id: "frh_analyst", type: "ai_analyst", category: "ai", position: { x: 700, y: 250 }, config: { instruction: "Analyze Federal Reserve news and market data to estimate rate decision probabilities. Consider FOMC language, economic indicators mentioned, and market pricing. Output a probability for rate hike, hold, or cut.", model: "claude-haiku", depth: "thorough", structured: true } },
  { id: "frh_edge", type: "edge_calculator", category: "logic", position: { x: 1050, y: 250 }, config: { min_edge: 8, decay_halflife: "120", sizing_mode: "fixed", fixed_size: 25, pct_size: 5 } },
  { id: "frh_cooldown", type: "cooldown_gate", category: "logic", position: { x: 1400, y: 250 }, config: { period: "1800", max_triggers: 2, reset_on_reversal: false } },
  { id: "frh_trade", type: "trade_advanced", category: "action", position: { x: 1750, y: 250 }, config: { platform: "gemini", direction: "auto", order_type: "market", limit_price: 0.5, mode: "simulate", only_new: true, auto_close: false, scale_in: false, max_position: 100 } },
];

const FED_RATE_HAWK_CONNECTIONS: StrategyConnection[] = [
  { id: "frh_e1", source_id: "frh_news", source_handle: "output", target_id: "frh_sentiment", target_handle: "input" },
  { id: "frh_e2", source_id: "frh_sentiment", source_handle: "output", target_id: "frh_analyst", target_handle: "input" },
  { id: "frh_e3", source_id: "frh_gemini", source_handle: "output", target_id: "frh_analyst", target_handle: "input" },
  { id: "frh_e4", source_id: "frh_analyst", source_handle: "output", target_id: "frh_edge", target_handle: "input" },
  { id: "frh_e5", source_id: "frh_edge", source_handle: "output", target_id: "frh_cooldown", target_handle: "input" },
  { id: "frh_e6", source_id: "frh_cooldown", source_handle: "output", target_id: "frh_trade", target_handle: "input" },
];

const CRYPTO_MOMENTUM_NODES: StrategyNode[] = [
  { id: "cm_btc", type: "crypto_price", category: "data", position: { x: 0, y: 0 }, config: { token: "BTC", timeframe: "1h" } },
  { id: "cm_eth", type: "crypto_price", category: "data", position: { x: 0, y: 200 }, config: { token: "ETH", timeframe: "1h" } },
  { id: "cm_whale", type: "onchain_activity", category: "data", position: { x: 0, y: 400 }, config: { mode: "whale_alerts", wallet_address: "", min_value: "1000000", chain: "all" } },
  { id: "cm_twitter", type: "twitter_monitor", category: "data", position: { x: 0, y: 600 }, config: { keywords: "BTC, ETH, Bitcoin, Ethereum, crypto pump, crypto dump", handles: "@whale_alert,@CryptoQuant,@glaboratenode", min_followers: "10000", verified_only: false, exclude_retweets: true, language: "en" } },
  { id: "cm_sentiment", type: "sentiment_scanner", category: "ai", position: { x: 350, y: 500 }, config: { domain: "crypto", aggregation: "per_item" } },
  { id: "cm_analyst", type: "ai_analyst", category: "ai", position: { x: 700, y: 100 }, config: { instruction: "Analyze crypto momentum signals from price data, whale activity, and social sentiment. Determine if BTC/ETH are in a momentum regime (trending up/down) or mean-reverting. Output directional probability.", model: "claude-haiku", depth: "balanced", structured: true } },
  { id: "cm_consensus", type: "consensus", category: "ai", position: { x: 1050, y: 300 }, config: { consensus_mode: "weighted_avg", input_count: 2, weights: [60, 40] } },
  { id: "cm_edge", type: "edge_calculator", category: "logic", position: { x: 1400, y: 300 }, config: { min_edge: 5, decay_halflife: "60", sizing_mode: "pct", fixed_size: 25, pct_size: 5 } },
  { id: "cm_cooldown", type: "cooldown_gate", category: "logic", position: { x: 1750, y: 300 }, config: { period: "1800", max_triggers: 3, reset_on_reversal: true } },
  { id: "cm_trade", type: "trade_advanced", category: "action", position: { x: 2100, y: 300 }, config: { platform: "auto", direction: "auto", order_type: "market", limit_price: 0.5, mode: "simulate", only_new: true, auto_close: false, scale_in: false, max_position: 100 } },
];

const CRYPTO_MOMENTUM_CONNECTIONS: StrategyConnection[] = [
  { id: "cm_e1", source_id: "cm_btc", source_handle: "output", target_id: "cm_analyst", target_handle: "input" },
  { id: "cm_e2", source_id: "cm_eth", source_handle: "output", target_id: "cm_analyst", target_handle: "input" },
  { id: "cm_e3", source_id: "cm_whale", source_handle: "output", target_id: "cm_analyst", target_handle: "input" },
  { id: "cm_e4", source_id: "cm_twitter", source_handle: "output", target_id: "cm_sentiment", target_handle: "input" },
  { id: "cm_e5", source_id: "cm_analyst", source_handle: "output", target_id: "cm_consensus", target_handle: "input_1" },
  { id: "cm_e6", source_id: "cm_sentiment", source_handle: "output", target_id: "cm_consensus", target_handle: "input_2" },
  { id: "cm_e7", source_id: "cm_consensus", source_handle: "output", target_id: "cm_edge", target_handle: "input" },
  { id: "cm_e8", source_id: "cm_edge", source_handle: "output", target_id: "cm_cooldown", target_handle: "input" },
  { id: "cm_e9", source_id: "cm_cooldown", source_handle: "output", target_id: "cm_trade", target_handle: "input" },
];

const BREAKING_NEWS_NODES: StrategyNode[] = [
  { id: "bn_news", type: "news_monitor", category: "data", position: { x: 0, y: 200 }, config: { keywords: "", source_tier: "tier_1", refresh: "15" } },
  { id: "bn_polymarket", type: "polymarket_feed", category: "data", position: { x: 0, y: 400 }, config: { market_search: "", watch_mode: "trending", category: "all", max_results: 20 } },
  { id: "bn_analyst", type: "ai_analyst", category: "ai", position: { x: 400, y: 300 }, config: { instruction: "Rapidly assess breaking news for prediction market impact. Determine: 1) Does this news materially change the probability of any active prediction market? 2) How large is the expected price move? 3) How quickly will the market reprice? Focus on speed — output a clear YES/NO signal with probability shift estimate.", model: "claude-haiku", depth: "fast", structured: true } },
  { id: "bn_edge", type: "edge_calculator", category: "logic", position: { x: 800, y: 300 }, config: { min_edge: 5, decay_halflife: "15", sizing_mode: "fixed", fixed_size: 20, pct_size: 5 } },
  { id: "bn_cooldown", type: "cooldown_gate", category: "logic", position: { x: 1200, y: 300 }, config: { period: "120", max_triggers: 5, reset_on_reversal: false } },
  { id: "bn_trade", type: "trade_advanced", category: "action", position: { x: 1600, y: 300 }, config: { platform: "auto", direction: "auto", order_type: "market", limit_price: 0.5, mode: "simulate", only_new: true, auto_close: true, scale_in: false, max_position: 50 } },
];

const BREAKING_NEWS_CONNECTIONS: StrategyConnection[] = [
  { id: "bn_e1", source_id: "bn_news", source_handle: "output", target_id: "bn_analyst", target_handle: "input" },
  { id: "bn_e2", source_id: "bn_polymarket", source_handle: "output", target_id: "bn_analyst", target_handle: "input" },
  { id: "bn_e3", source_id: "bn_analyst", source_handle: "output", target_id: "bn_edge", target_handle: "input" },
  { id: "bn_e4", source_id: "bn_edge", source_handle: "output", target_id: "bn_cooldown", target_handle: "input" },
  { id: "bn_e5", source_id: "bn_cooldown", source_handle: "output", target_id: "bn_trade", target_handle: "input" },
];

const CROSS_MARKET_ARB_NODES: StrategyNode[] = [
  { id: "arb_gemini", type: "gemini_markets_feed", category: "data", position: { x: 0, y: 150 }, config: { event_search: "", watch_mode: "watchlist", category: "all", max_results: 15, alert_threshold: 3 } },
  { id: "arb_poly", type: "polymarket_feed", category: "data", position: { x: 0, y: 400 }, config: { market_search: "", watch_mode: "watchlist", category: "all", max_results: 15 } },
  { id: "arb_detect", type: "arb_detector", category: "logic", position: { x: 450, y: 275 }, config: { match_mode: "auto", min_spread: 3, net_of_fees: true } },
  { id: "arb_edge", type: "edge_calculator", category: "logic", position: { x: 900, y: 275 }, config: { min_edge: 3, decay_halflife: "30", sizing_mode: "fixed", fixed_size: 50, pct_size: 5 } },
  { id: "arb_trade", type: "trade_advanced", category: "action", position: { x: 1350, y: 275 }, config: { platform: "auto", direction: "auto", order_type: "market", limit_price: 0.5, mode: "simulate", only_new: true, auto_close: false, scale_in: false, max_position: 200 } },
];

const CROSS_MARKET_ARB_CONNECTIONS: StrategyConnection[] = [
  { id: "arb_e1", source_id: "arb_gemini", source_handle: "output", target_id: "arb_detect", target_handle: "input_1" },
  { id: "arb_e2", source_id: "arb_poly", source_handle: "output", target_id: "arb_detect", target_handle: "input_2" },
  { id: "arb_e3", source_id: "arb_detect", source_handle: "output", target_id: "arb_edge", target_handle: "input" },
  { id: "arb_e4", source_id: "arb_edge", source_handle: "output", target_id: "arb_trade", target_handle: "input" },
];

const ELECTION_CYCLE_NODES: StrategyNode[] = [
  { id: "ec_news", type: "news_monitor", category: "data", position: { x: 0, y: 0 }, config: { keywords: "election, poll, candidate, primary, campaign, ballot, swing state, approval rating", source_tier: "all_major", refresh: "120" } },
  { id: "ec_twitter", type: "twitter_monitor", category: "data", position: { x: 0, y: 200 }, config: { keywords: "election, polls, voting, ballot, swing state", handles: "@NateSilver538,@Nate_Cohn,@PollsterPatrick,@FiveThirtyEight", min_followers: "5000", verified_only: false, exclude_retweets: true, language: "en" } },
  { id: "ec_polymarket", type: "polymarket_feed", category: "data", position: { x: 0, y: 400 }, config: { market_search: "election, president, senate, governor", watch_mode: "watchlist", category: "politics", max_results: 10 } },
  { id: "ec_sentiment", type: "sentiment_scanner", category: "ai", position: { x: 400, y: 100 }, config: { domain: "politics", aggregation: "per_item" } },
  { id: "ec_analyst1", type: "ai_analyst", category: "ai", position: { x: 800, y: 0 }, config: { instruction: "Analyze polling data and political news to estimate election outcome probabilities. Focus on polling averages, trend lines, and historical accuracy of similar polls.", model: "claude-haiku", depth: "thorough", structured: true } },
  { id: "ec_analyst2", type: "ai_analyst", category: "ai", position: { x: 800, y: 220 }, config: { instruction: "Analyze social media sentiment and narrative momentum around election candidates. Assess whether the current media narrative favors or disfavors each candidate relative to current market pricing.", model: "claude-haiku", depth: "balanced", structured: true } },
  { id: "ec_analyst3", type: "ai_analyst", category: "ai", position: { x: 800, y: 440 }, config: { instruction: "Assess structural and fundamental factors: economic indicators, incumbency advantage, demographic shifts, and historical base rates for similar electoral contexts. Provide a probability estimate independent of current polling.", model: "claude-haiku", depth: "thorough", structured: true } },
  { id: "ec_consensus", type: "consensus", category: "ai", position: { x: 1200, y: 220 }, config: { consensus_mode: "weighted_avg", input_count: 3, weights: [40, 30, 30] } },
  { id: "ec_edge", type: "edge_calculator", category: "logic", position: { x: 1600, y: 220 }, config: { min_edge: 8, decay_halflife: "240", sizing_mode: "fixed", fixed_size: 30, pct_size: 5 } },
  { id: "ec_cooldown", type: "cooldown_gate", category: "logic", position: { x: 2000, y: 220 }, config: { period: "3600", max_triggers: 2, reset_on_reversal: false } },
  { id: "ec_trade", type: "trade_advanced", category: "action", position: { x: 2400, y: 220 }, config: { platform: "auto", direction: "auto", order_type: "market", limit_price: 0.5, mode: "simulate", only_new: true, auto_close: false, scale_in: false, max_position: 100 } },
];

const ELECTION_CYCLE_CONNECTIONS: StrategyConnection[] = [
  { id: "ec_e1", source_id: "ec_news", source_handle: "output", target_id: "ec_sentiment", target_handle: "input" },
  { id: "ec_e2", source_id: "ec_twitter", source_handle: "output", target_id: "ec_sentiment", target_handle: "input" },
  { id: "ec_e3", source_id: "ec_sentiment", source_handle: "output", target_id: "ec_analyst1", target_handle: "input" },
  { id: "ec_e4", source_id: "ec_sentiment", source_handle: "output", target_id: "ec_analyst2", target_handle: "input" },
  { id: "ec_e5", source_id: "ec_polymarket", source_handle: "output", target_id: "ec_analyst3", target_handle: "input" },
  { id: "ec_e6", source_id: "ec_analyst1", source_handle: "output", target_id: "ec_consensus", target_handle: "input_1" },
  { id: "ec_e7", source_id: "ec_analyst2", source_handle: "output", target_id: "ec_consensus", target_handle: "input_2" },
  { id: "ec_e8", source_id: "ec_analyst3", source_handle: "output", target_id: "ec_consensus", target_handle: "input_3" },
  { id: "ec_e9", source_id: "ec_consensus", source_handle: "output", target_id: "ec_edge", target_handle: "input" },
  { id: "ec_e10", source_id: "ec_edge", source_handle: "output", target_id: "ec_cooldown", target_handle: "input" },
  { id: "ec_e11", source_id: "ec_cooldown", source_handle: "output", target_id: "ec_trade", target_handle: "input" },
];

// ============================================================================
// Strategy definitions
// ============================================================================

export const STRATEGIES: MarketplaceStrategy[] = [
  {
    id: "strat-fed-rate-hawk",
    name: "Fed Rate Hawk",
    creator: "macro_alpha",
    creatorAvatar: "ma",
    description:
      "Monitors Federal Reserve news and FOMC meeting coverage, estimates rate decision probabilities using AI analysis, and trades Gemini Fed prediction markets when edge exceeds 8%.",
    category: "Economics",
    totalReturn: 12.4,
    winRate: 68,
    totalTrades: 47,
    avgEdge: 9.2,
    sharpeRatio: 1.84,
    maxDrawdown: 4.1,
    nodeCount: 7,
    clones: 124,
    nftVerified: true,
    publishedAgo: "3 days ago",
    nodePipeline: [
      "News Monitor",
      "Gemini Markets",
      "Sentiment Scanner",
      "AI Analyst",
      "Edge Calculator",
      "Cooldown Gate",
      "Trade",
    ],
    equityCurve: generateEquityCurve(12.4, 47, 42),
    nodes: FED_RATE_HAWK_NODES,
    connections: FED_RATE_HAWK_CONNECTIONS,
  },
  {
    id: "strat-crypto-momentum",
    name: "Crypto Momentum Alpha",
    creator: "on_chain_edge",
    creatorAvatar: "oc",
    description:
      "Tracks BTC and ETH price momentum alongside whale wallet activity, scores sentiment from crypto Twitter, and trades crypto prediction markets on momentum signals with a 30-minute cooldown.",
    category: "Crypto",
    totalReturn: 8.7,
    winRate: 61,
    totalTrades: 83,
    avgEdge: 6.8,
    sharpeRatio: 1.32,
    maxDrawdown: 6.3,
    nodeCount: 10,
    clones: 89,
    nftVerified: true,
    publishedAgo: "5 days ago",
    nodePipeline: [
      "Crypto Price (BTC)",
      "Crypto Price (ETH)",
      "On-Chain Activity",
      "Twitter Monitor",
      "Sentiment Scanner",
      "AI Analyst",
      "Consensus",
      "Edge Calculator",
      "Cooldown Gate",
      "Trade",
    ],
    equityCurve: generateEquityCurve(8.7, 83, 77),
    nodes: CRYPTO_MOMENTUM_NODES,
    connections: CRYPTO_MOMENTUM_CONNECTIONS,
  },
  {
    id: "strat-breaking-news",
    name: "Breaking News Scalper",
    creator: "speed_edge",
    creatorAvatar: "se",
    description:
      "Reacts to breaking news from tier-1 sources within seconds, runs rapid AI probability estimation, and scalps prediction market mispricings before the market adjusts.",
    category: "Multi-Market",
    totalReturn: 15.1,
    winRate: 58,
    totalTrades: 156,
    avgEdge: 5.4,
    sharpeRatio: 1.67,
    maxDrawdown: 7.8,
    nodeCount: 6,
    clones: 203,
    nftVerified: false,
    publishedAgo: "1 day ago",
    nodePipeline: [
      "News Monitor",
      "Polymarket Feed",
      "AI Analyst",
      "Edge Calculator",
      "Cooldown Gate",
      "Trade",
    ],
    equityCurve: generateEquityCurve(15.1, 156, 99),
    nodes: BREAKING_NEWS_NODES,
    connections: BREAKING_NEWS_CONNECTIONS,
  },
  {
    id: "strat-cross-market-arb",
    name: "Cross-Market Arbitrage",
    creator: "arb_hunter",
    creatorAvatar: "ah",
    description:
      "Monitors identical events across Gemini and Polymarket simultaneously, detects pricing discrepancies net of fees, and executes both legs of the arbitrage when spread exceeds threshold.",
    category: "Arbitrage",
    totalReturn: 4.2,
    winRate: 82,
    totalTrades: 31,
    avgEdge: 3.1,
    sharpeRatio: 2.41,
    maxDrawdown: 1.9,
    nodeCount: 5,
    clones: 67,
    nftVerified: true,
    publishedAgo: "1 week ago",
    nodePipeline: [
      "Gemini Feed",
      "Polymarket Feed",
      "Arb Detector",
      "Edge Calculator",
      "Trade",
    ],
    equityCurve: generateEquityCurve(4.2, 31, 13),
    nodes: CROSS_MARKET_ARB_NODES,
    connections: CROSS_MARKET_ARB_CONNECTIONS,
  },
  {
    id: "strat-election-cycle",
    name: "Election Cycle Trader",
    creator: "poly_prophet",
    creatorAvatar: "pp",
    description:
      "Aggregates polling data, tracks political news and Twitter sentiment from key political accounts, uses consensus across three AI analysts to trade election outcome markets.",
    category: "Politics",
    totalReturn: 6.9,
    winRate: 64,
    totalTrades: 28,
    avgEdge: 11.3,
    sharpeRatio: 1.55,
    maxDrawdown: 3.7,
    nodeCount: 11,
    clones: 45,
    nftVerified: false,
    publishedAgo: "4 days ago",
    nodePipeline: [
      "News Monitor",
      "Twitter Monitor",
      "Polymarket Feed",
      "Sentiment Scanner",
      "AI Analyst x3",
      "Consensus",
      "Edge Calculator",
      "Cooldown Gate",
      "Trade",
    ],
    equityCurve: generateEquityCurve(6.9, 28, 55),
    nodes: ELECTION_CYCLE_NODES,
    connections: ELECTION_CYCLE_CONNECTIONS,
  },
];
