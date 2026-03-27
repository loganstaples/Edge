// ============================================================
// Core domain types shared across the entire application
// ============================================================

// --- News ---
export interface Article {
  id: string;
  title: string;
  description: string | null;
  source: string;
  url: string | null;
  publishedAt: string;
  category: string | null;
  processed: boolean;
  createdAt: string;
  aiTag?: "event_detected" | "market_created" | "no_event";
  matchedMarkets?: number;
  edgeHighlight?: string;
}

export type Confidence = "low" | "medium" | "high";

export type Category =
  | "politics"
  | "economics"
  | "crypto"
  | "sports"
  | "science"
  | "technology"
  | "culture";

export interface AIPrediction {
  id: string;
  articleId: string;
  eventTitle: string;
  category: Category;
  aiProbability: number;
  confidence: Confidence;
  resolutionDate: string;
  reasoning: string;
  keyFactors: string[];
  newsSources: string[];
  createdAt: string;
}

export type Platform = "gemini" | "polymarket";
export type SignalStrength = "strong" | "moderate" | "weak" | "none";

export interface MarketMatch {
  id: string;
  predictionId: string;
  platform: Platform;
  externalId: string;
  marketPrice: number;
  edge: number;
  signalStrength: SignalStrength;
  lastUpdated: string;
  instrumentSymbol?: string;
  tokenId?: string;
}

export interface UnifiedMarket {
  id: string;
  eventTitle: string;
  category: Category;
  aiProbability: number;
  confidence: Confidence;
  reasoning: string;
  keyFactors: string[];
  newsSources: string[];
  resolutionDate: string;
  createdAt: string;
  platforms: {
    platform: Platform;
    externalId: string;
    marketPrice: number;
    edge: number;
    signalStrength: SignalStrength;
    instrumentSymbol?: string;
    tokenId?: string;
  }[];
  bestEdge: number;
  bestEdgePlatform: Platform;
  avgMarketPrice: number;
  priceHistory?: { timestamp: string; price: number; aiPrice: number }[];
  articleUrl?: string;
  articleTitle?: string;
}

export interface GeminiEventResponse {
  data: GeminiEvent[];
  pagination: { limit: number; offset: number; total: number };
}

export interface GeminiEvent {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  type: "binary" | "categorical";
  category: string;
  status: "approved" | "active" | "closed" | "under_review" | "settled" | "invalid";
  expiryDate: string | null;
  liquidity: string;
  volume: string;
  tags: string[];
  contracts: GeminiContract[];
  createdAt: string;
}

export interface GeminiContract {
  id: string;
  label: string;
  ticker: string;
  instrumentSymbol: string;
  prices: {
    buy: { yes: string; no: string };
    sell: { yes: string; no: string };
    bestBid: string;
    bestAsk: string;
    lastTradePrice: string;
  };
  status: string;
  expiryDate: string | null;
}

export interface GeminiTicker {
  symbol: string;
  open: string;
  high: string;
  low: string;
  close: string;
  changes: string[];
  bid: string;
  ask: string;
}

export interface PolymarketMarket {
  condition_id: string;
  question_id: string;
  question: string;
  description: string;
  market_slug: string;
  end_date_iso: string;
  game_start_time: string | null;
  active: boolean;
  closed: boolean;
  tokens: PolymarketToken[];
  tags: string[];
  neg_risk: boolean;
  minimum_order_size: string;
  minimum_tick_size: string;
  // Extra fields from the CLOB API (may not always be present)
  volume_num_24hr?: number;
  liquidity_clob?: number;
  last_trade_ts?: string;
}

export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface PolymarketOrderBook {
  market: string;
  asset_id: string;
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
  last_trade_price: string;
}

export interface CalibrationStats {
  totalEvents: number;
  resolvedEvents: number;
  aiHitRate: number;
  avgEdge: number;
  marketsCreated: number;
  buckets: CalibrationBucket[];
}

export interface CalibrationBucket {
  range: string;
  predicted: number;
  actual: number;
  count: number;
}

export interface EdgeResult {
  // ── Core edge metrics ──
  /** Calibrated edge: calibratedAI − market (linear space) */
  edge: number;
  /** Edge in log-odds space: logit(calAI) − logit(market) */
  bayesianEdge: number;
  /** Edge after confidence, slippage, and market efficiency adjustments */
  effectiveEdge: number;
  /** AI probability after Platt scaling calibration */
  calibratedProbability: number;
  /** Original AI probability (clamped to [0.005, 0.995]) */
  aiProbability: number;
  /** Market-implied probability */
  marketProbability: number;
  platform: Platform;

  // ── Probabilistic model (Beta distribution) ──
  /** Std dev of Beta(α,β) — quantifies AI's epistemic uncertainty */
  aiUncertainty: number;
  /** Beta distribution α parameter */
  betaAlpha: number;
  /** Beta distribution β parameter */
  betaBeta: number;

  // ── Information theory ──
  /** KL(AI ‖ Market) — information-theoretic disagreement in nats */
  klDivergence: number;
  /** Shannon entropy of the AI's Bernoulli distribution */
  shannonEntropy: number;
  /** |edge| / aiStdDev — edge per unit of uncertainty (quasi-Sharpe) */
  informationRatio: number;

  // ── Confidence ──
  /** Composite confidence ∈ [0,1] from 9 weighted factors */
  compositeConfidence: number;
  /** Full breakdown of each confidence factor */
  confidenceFactors: ConfidenceFactors;

  // ── Market microstructure ──
  /** Liquidity quality score ∈ [0,1] */
  liquidityScore: number;
  /** Estimated slippage as fraction of midpoint */
  estimatedSlippage: number;
  /** Market efficiency proxy ∈ [0,1] (higher = harder to beat) */
  marketEfficiency: number;
  /** Orderbook depth imbalance ∈ [-1,1] (>0 = bid-heavy/bullish) */
  orderBookImbalance: number;

  // ── Position sizing (Kelly criterion) ──
  /** Kelly-optimal fraction after half-Kelly and drawdown cap */
  kellyFraction: number;
  /** Suggested position size in USD */
  suggestedSize: number;

  // ── Expected value framework ──
  /** E[V] = E[gain] − E[loss] at suggested size */
  expectedValue: number;
  /** Expected profit if the trade wins */
  expectedGain: number;
  /** Expected loss if the trade loses */
  expectedLoss: number;
  /** E[gain] / E[loss] */
  riskRewardRatio: number;
  /** Expected Value of Perfect Information — value of further research */
  evpi: number;

  // ── Signal ──
  signalStrength: SignalStrength;
}

export interface ConfidenceFactors {
  /** AI self-assessed confidence mapped to [0,1] */
  aiConfidence: number;
  /** Source corroboration (sigmoid-saturating at ~5 sources) */
  sourceCorroboration: number;
  /** Reasoning depth (key factor count / 7) */
  reasoningDepth: number;
  /** Market liquidity quality (spread + depth composite) */
  liquidityQuality: number;
  /** Temporal freshness (exponential decay, half-life = 4h) */
  temporalFreshness: number;
  /** Extremity penalty: 4p(1−p), penalizes overconfident extremes */
  extremityPenalty: number;
  /** Sentiment-edge alignment via tanh squashing */
  sentimentAlignment: number;
  /** Orderbook directional confirmation */
  orderBookConfirmation: number;
  /** Market efficiency adjustment (inverted: efficient → lower) */
  marketEfficiencyAdj: number;
}

export interface PipelineCycleResult {
  articlesIngested: number;
  articlesAnalyzed: number;
  eventsExtracted: number;
  marketsMatched: number;
  errors: string[];
}

// --- Strategy Builder ---

export type StrategyStatus = "draft" | "running" | "paused" | "stopped";

export type NodeCategory = "data" | "ai" | "logic" | "action";

export type NodeStatus = "idle" | "processing" | "passed" | "blocked" | "warning";

export interface StrategyNode {
  id: string;
  type: string;
  category: NodeCategory;
  position: { x: number; y: number };
  config: Record<string, any>;
}

export interface StrategyConnection {
  id: string;
  source_id: string;
  source_handle: string;
  target_id: string;
  target_handle: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string | null;
  authorName: string;
  ownerWallet: string | null;
  nftMint: string | null;
  nodes: StrategyNode[];
  connections: StrategyConnection[];
  status: StrategyStatus;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyPerformance {
  id: string;
  strategyId: string;
  totalTrades: number;
  winningTrades: number;
  totalPnl: number;
  sharpeRatio: number;
  maxDrawdown: number;
  lastUpdated: string;
}

export interface ExecutionLogEntry {
  id: number;
  strategyId: string;
  timestamp: string;
  nodeLogs: Record<string, any>;
  tradePlaced: boolean;
  tradeDetails: Record<string, any> | null;
  pnlDelta: number;
}

export interface SimulatedTrade {
  id: string;
  strategyId: string;
  platform: Platform;
  marketId: string;
  direction: "YES" | "NO";
  entryPrice: number;
  amount: number;
  currentPrice: number | null;
  pnl: number;
  status: "open" | "closed" | "expired";
  openedAt: string;
  closedAt: string | null;
}
