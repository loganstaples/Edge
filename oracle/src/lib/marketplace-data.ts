// ============================================================================
// Marketplace Seed Data — static strategies for demo
// ============================================================================

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
    nodeCount: 9,
    clones: 124,
    nftVerified: true,
    publishedAgo: "3 days ago",
    nodePipeline: [
      "News Monitor",
      "Sentiment Scanner",
      "AI Analyst",
      "Edge Calculator",
      "Cooldown Gate",
      "Trade",
    ],
    equityCurve: generateEquityCurve(12.4, 47, 42),
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
    nodeCount: 14,
    clones: 89,
    nftVerified: true,
    publishedAgo: "5 days ago",
    nodePipeline: [
      "Crypto Price",
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
    nodeCount: 7,
    clones: 203,
    nftVerified: false,
    publishedAgo: "1 day ago",
    nodePipeline: [
      "News Monitor",
      "AI Analyst",
      "Edge Calculator",
      "Cooldown Gate",
      "Trade",
    ],
    equityCurve: generateEquityCurve(15.1, 156, 99),
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
    nodeCount: 6,
    clones: 67,
    nftVerified: true,
    publishedAgo: "1 week ago",
    nodePipeline: [
      "Gemini Feed",
      "Polymarket Feed",
      "Arbitrage Detector",
      "Edge Calculator",
      "Trade",
    ],
    equityCurve: generateEquityCurve(4.2, 31, 13),
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
    nodeCount: 16,
    clones: 45,
    nftVerified: false,
    publishedAgo: "4 days ago",
    nodePipeline: [
      "News Monitor",
      "Twitter Monitor",
      "Sentiment Scanner",
      "AI Analyst ×3",
      "Consensus",
      "Edge Calculator",
      "Cooldown Gate",
      "Trade",
    ],
    equityCurve: generateEquityCurve(6.9, 28, 55),
  },
];
