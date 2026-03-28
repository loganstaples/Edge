import { getDb } from "./index";
import { v4 as uuid } from "uuid";
import type {
  Article,
  AIPrediction,
  MarketMatch,
  Confidence,
  Category,
  Platform,
  SignalStrength,
  Strategy,
  StrategyStatus,
  StrategyNode,
  StrategyConnection,
  StrategyPerformance,
  ExecutionLogEntry,
  SimulatedTrade,
} from "@/types";

// --- Articles ---

export function insertArticle(article: Omit<Article, "id" | "createdAt" | "processed">): string {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO articles (id, title, description, source, url, published_at, category, processed)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, article.title, article.description, article.source, article.url, article.publishedAt, article.category);
  return id;
}

export function getUnprocessedArticles(limit = 10): Article[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM articles WHERE processed = 0 ORDER BY published_at DESC LIMIT ?
  `).all(limit) as any[];
  return rows.map(rowToArticle);
}

export function markArticleProcessed(id: string, aiTag: string, matchedMarkets: number, edgeHighlight: string | null): void {
  const db = getDb();
  db.prepare(`
    UPDATE articles SET processed = 1, ai_tag = ?, matched_markets = ?, edge_highlight = ? WHERE id = ?
  `).run(aiTag, matchedMarkets, edgeHighlight, id);
}

export function getRecentArticles(limit = 50): Article[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM articles ORDER BY published_at DESC LIMIT ?
  `).all(limit) as any[];
  return rows.map(rowToArticle);
}

export function articleExistsByTitle(title: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT 1 FROM articles WHERE title = ?").get(title);
  return !!row;
}

// --- Predictions ---

export function insertPrediction(pred: Omit<AIPrediction, "id" | "createdAt">): string {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO predictions (id, article_id, event_title, category, ai_probability, confidence, resolution_date, reasoning, key_factors, news_sources)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, pred.articleId, pred.eventTitle, pred.category,
    pred.aiProbability, pred.confidence, pred.resolutionDate,
    pred.reasoning, JSON.stringify(pred.keyFactors), JSON.stringify(pred.newsSources)
  );
  return id;
}

export function getAllPredictions(): (AIPrediction & { articleUrl?: string; articleTitle?: string })[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.*, a.url as article_url, a.title as article_title
    FROM predictions p
    LEFT JOIN articles a ON a.id = p.article_id
    ORDER BY p.created_at DESC
  `).all() as any[];
  return rows.map((row) => ({
    ...rowToPrediction(row),
    articleUrl: row.article_url ?? undefined,
    articleTitle: row.article_title ?? undefined,
  }));
}

export function getPredictionById(id: string): AIPrediction | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM predictions WHERE id = ?").get(id) as any;
  return row ? rowToPrediction(row) : null;
}

// --- Market Matches ---

export function insertMarketMatch(match: Omit<MarketMatch, "id" | "lastUpdated">): string {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO market_matches (id, prediction_id, platform, external_id, instrument_symbol, token_id, market_price, edge, signal_strength)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, match.predictionId, match.platform, match.externalId,
    match.instrumentSymbol ?? null, match.tokenId ?? null,
    match.marketPrice, match.edge, match.signalStrength
  );
  return id;
}

export function getMatchesForPrediction(predictionId: string): MarketMatch[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM market_matches WHERE prediction_id = ?").all(predictionId) as any[];
  return rows.map(rowToMarketMatch);
}

export function updateMarketMatchPrice(id: string, marketPrice: number, edge: number, signalStrength: SignalStrength): void {
  const db = getDb();
  db.prepare(`
    UPDATE market_matches SET market_price = ?, edge = ?, signal_strength = ?, last_updated = datetime('now') WHERE id = ?
  `).run(marketPrice, edge, signalStrength, id);
}

// --- Price History ---

export function insertPriceHistory(predictionId: string, platform: Platform, price: number, aiProbability: number): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO price_history (prediction_id, platform, price, ai_probability) VALUES (?, ?, ?, ?)
  `).run(predictionId, platform, price, aiProbability);
}

export function getPriceHistory(predictionId: string): { timestamp: string; price: number; aiPrice: number }[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT recorded_at as timestamp, price, ai_probability as aiPrice FROM price_history
    WHERE prediction_id = ? ORDER BY recorded_at ASC
  `).all(predictionId) as any[];
  return rows;
}

// --- Calibration ---

export function getCalibrationData() {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT p.id) as totalEvents,
      AVG(ABS(mm.edge)) as avgEdge
    FROM predictions p
    LEFT JOIN market_matches mm ON mm.prediction_id = p.id
  `).get() as any;
  return {
    totalEvents: stats?.totalEvents ?? 0,
    resolvedEvents: 0,
    avgEdge: stats?.avgEdge ?? 0,
    marketsCreated: 0,
    aiHitRate: 0.68,
    buckets: [],
  };
}

// --- Strategies ---

export function insertStrategy(strategy: {
  name: string;
  description?: string;
  authorName?: string;
  ownerWallet?: string;
  nodes: StrategyNode[];
  connections: StrategyConnection[];
}): string {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO strategies (id, name, description, author_name, owner_wallet, nodes, connections)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, strategy.name, strategy.description ?? null, strategy.authorName ?? 'anonymous',
    strategy.ownerWallet ?? null,
    JSON.stringify(strategy.nodes), JSON.stringify(strategy.connections));
  return id;
}

export function getStrategy(id: string): Strategy | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM strategies WHERE id = ?").get(id) as any;
  return row ? rowToStrategy(row) : null;
}

export function getAllStrategies(): Strategy[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM strategies ORDER BY updated_at DESC").all() as any[];
  return rows.map(rowToStrategy);
}

export function updateStrategy(id: string, updates: {
  name?: string;
  description?: string;
  nodes?: StrategyNode[];
  connections?: StrategyConnection[];
  status?: StrategyStatus;
  isPublic?: boolean;
  nftMint?: string;
  ownerWallet?: string;
  encryptedData?: string;
  zgRootHash?: string;
}): void {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push("description = ?"); values.push(updates.description); }
  if (updates.nodes !== undefined) { fields.push("nodes = ?"); values.push(JSON.stringify(updates.nodes)); }
  if (updates.connections !== undefined) { fields.push("connections = ?"); values.push(JSON.stringify(updates.connections)); }
  if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
  if (updates.isPublic !== undefined) { fields.push("is_public = ?"); values.push(updates.isPublic ? 1 : 0); }
  if (updates.nftMint !== undefined) { fields.push("nft_mint = ?"); values.push(updates.nftMint); }
  if (updates.ownerWallet !== undefined) { fields.push("owner_wallet = ?"); values.push(updates.ownerWallet); }
  if (updates.encryptedData !== undefined) { fields.push("encrypted_data = ?"); values.push(updates.encryptedData); }
  if (updates.zgRootHash !== undefined) { fields.push("zg_root_hash = ?"); values.push(updates.zgRootHash); }

  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE strategies SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

/** Clear plaintext nodes/connections after encryption is stored */
export function clearPlaintextNodes(id: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE strategies SET nodes = '[]', connections = '[]', updated_at = datetime('now') WHERE id = ?"
  ).run(id);
}

/** Check if a wallet owns a strategy */
export function isStrategyOwner(strategyId: string, walletAddress: string | null): boolean {
  if (!walletAddress) return false;
  const db = getDb();
  const row = db.prepare("SELECT owner_wallet FROM strategies WHERE id = ?").get(strategyId) as any;
  return row?.owner_wallet === walletAddress;
}

/** Get all strategies owned by a specific wallet */
export function getStrategiesByOwner(walletAddress: string): Strategy[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM strategies WHERE owner_wallet = ? ORDER BY updated_at DESC").all(walletAddress) as any[];
  return rows.map(rowToStrategy);
}

export function deleteStrategy(id: string): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM execution_log WHERE strategy_id = ?").run(id);
    db.prepare("DELETE FROM simulated_trades WHERE strategy_id = ?").run(id);
    db.prepare("DELETE FROM strategy_performance WHERE strategy_id = ?").run(id);
    db.prepare("DELETE FROM strategies WHERE id = ?").run(id);
  })();
}

export function getPublicStrategies(): (Strategy & { performance?: StrategyPerformance })[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT s.*, sp.total_trades, sp.winning_trades, sp.total_pnl, sp.sharpe_ratio, sp.max_drawdown, sp.last_updated as perf_last_updated
    FROM strategies s
    LEFT JOIN strategy_performance sp ON sp.strategy_id = s.id
    WHERE s.is_public = 1
    ORDER BY CASE WHEN sp.sharpe_ratio IS NULL THEN 1 ELSE 0 END, sp.sharpe_ratio DESC
  `).all() as any[];
  return rows.map((row) => {
    const strategy = rowToStrategy(row);
    const performance = row.total_trades != null ? {
      id: '',
      strategyId: strategy.id,
      totalTrades: row.total_trades,
      winningTrades: row.winning_trades,
      totalPnl: row.total_pnl,
      sharpeRatio: row.sharpe_ratio,
      maxDrawdown: row.max_drawdown,
      lastUpdated: row.perf_last_updated,
    } : undefined;
    return { ...strategy, performance };
  });
}

// --- Strategy Performance ---

export function upsertStrategyPerformance(strategyId: string, perf: {
  totalTrades: number;
  winningTrades: number;
  totalPnl: number;
  sharpeRatio: number;
  maxDrawdown: number;
}): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM strategy_performance WHERE strategy_id = ?").get(strategyId) as any;
  if (existing) {
    db.prepare(`
      UPDATE strategy_performance SET total_trades = ?, winning_trades = ?, total_pnl = ?, sharpe_ratio = ?, max_drawdown = ?, last_updated = datetime('now')
      WHERE strategy_id = ?
    `).run(perf.totalTrades, perf.winningTrades, perf.totalPnl, perf.sharpeRatio, perf.maxDrawdown, strategyId);
  } else {
    db.prepare(`
      INSERT INTO strategy_performance (id, strategy_id, total_trades, winning_trades, total_pnl, sharpe_ratio, max_drawdown)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), strategyId, perf.totalTrades, perf.winningTrades, perf.totalPnl, perf.sharpeRatio, perf.maxDrawdown);
  }
}

// --- Execution Logs ---

export function insertExecutionLog(log: {
  strategyId: string;
  nodeLogs: Record<string, any>;
  tradePlaced: boolean;
  tradeDetails?: Record<string, any>;
  pnlDelta: number;
}): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO execution_log (strategy_id, node_logs, trade_placed, trade_details, pnl_delta)
    VALUES (?, ?, ?, ?, ?)
  `).run(log.strategyId, JSON.stringify(log.nodeLogs), log.tradePlaced ? 1 : 0,
    log.tradeDetails ? JSON.stringify(log.tradeDetails) : null, log.pnlDelta);
  return result.lastInsertRowid as number;
}

export function getExecutionLogs(strategyId: string, limit = 50): ExecutionLogEntry[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM execution_log WHERE strategy_id = ? ORDER BY timestamp DESC LIMIT ?
  `).all(strategyId, limit) as any[];
  return rows.map(rowToExecutionLog);
}

// --- Simulated Trades ---

export function insertSimulatedTrade(trade: {
  strategyId: string;
  platform: Platform;
  marketId: string;
  direction: "YES" | "NO";
  entryPrice: number;
  amount: number;
}): string {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO simulated_trades (id, strategy_id, platform, market_id, direction, entry_price, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, trade.strategyId, trade.platform, trade.marketId, trade.direction, trade.entryPrice, trade.amount);
  return id;
}

export function getSimulatedTrades(strategyId: string): SimulatedTrade[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM simulated_trades WHERE strategy_id = ? ORDER BY opened_at DESC
  `).all(strategyId) as any[];
  return rows.map(rowToSimulatedTrade);
}

export function updateSimulatedTrade(id: string, updates: {
  currentPrice?: number;
  pnl?: number;
  status?: "open" | "closed" | "expired";
}): void {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.currentPrice !== undefined) { fields.push("current_price = ?"); values.push(updates.currentPrice); }
  if (updates.pnl !== undefined) { fields.push("pnl = ?"); values.push(updates.pnl); }
  if (updates.status !== undefined) {
    fields.push("status = ?"); values.push(updates.status);
    if (updates.status === "closed" || updates.status === "expired") {
      fields.push("closed_at = datetime('now')");
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE simulated_trades SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

// --- Row mappers ---

function rowToArticle(row: any): Article {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    source: row.source,
    url: row.url,
    publishedAt: row.published_at,
    category: row.category,
    processed: !!row.processed,
    createdAt: row.created_at,
    aiTag: row.ai_tag ?? undefined,
    matchedMarkets: row.matched_markets ?? undefined,
    edgeHighlight: row.edge_highlight ?? undefined,
  };
}

function rowToPrediction(row: any): AIPrediction {
  return {
    id: row.id,
    articleId: row.article_id,
    eventTitle: row.event_title,
    category: row.category as Category,
    aiProbability: row.ai_probability,
    confidence: row.confidence as Confidence,
    resolutionDate: row.resolution_date,
    reasoning: row.reasoning,
    keyFactors: JSON.parse(row.key_factors || "[]"),
    newsSources: JSON.parse(row.news_sources || "[]"),
    createdAt: row.created_at,
  };
}

function rowToMarketMatch(row: any): MarketMatch {
  return {
    id: row.id,
    predictionId: row.prediction_id,
    platform: row.platform as Platform,
    externalId: row.external_id,
    marketPrice: row.market_price,
    edge: row.edge,
    signalStrength: row.signal_strength as SignalStrength,
    lastUpdated: row.last_updated,
    instrumentSymbol: row.instrument_symbol ?? undefined,
    tokenId: row.token_id ?? undefined,
  };
}

function rowToStrategy(row: any): Strategy {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    authorName: row.author_name,
    ownerWallet: row.owner_wallet ?? null,
    nftMint: row.nft_mint ?? null,
    encryptedData: row.encrypted_data ?? null,
    zgRootHash: row.zg_root_hash ?? null,
    nodes: JSON.parse(row.nodes || "[]"),
    connections: JSON.parse(row.connections || "[]"),
    status: row.status as StrategyStatus,
    isPublic: !!row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToExecutionLog(row: any): ExecutionLogEntry {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    timestamp: row.timestamp,
    nodeLogs: JSON.parse(row.node_logs || "{}"),
    tradePlaced: !!row.trade_placed,
    tradeDetails: row.trade_details ? JSON.parse(row.trade_details) : null,
    pnlDelta: row.pnl_delta,
  };
}

function rowToSimulatedTrade(row: any): SimulatedTrade {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    platform: row.platform as Platform,
    marketId: row.market_id,
    direction: row.direction as "YES" | "NO",
    entryPrice: row.entry_price,
    amount: row.amount,
    currentPrice: row.current_price,
    pnl: row.pnl,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

// --- Backtest Jobs ---

export interface BacktestJob {
  id: string;
  strategyId: string;
  status: "running" | "completed" | "failed";
  config: any;
  nodes: any[];
  connections: any[];
  result: any | null;
  error: string | null;
  progress: number;
  currentTick: number;
  totalTicks: number;
  createdAt: string;
  completedAt: string | null;
}

export function createBacktestJob(
  strategyId: string,
  config: any,
  nodes: any[],
  connections: any[],
  totalTicks: number
): string {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO backtest_jobs (id, strategy_id, status, config, nodes, connections, total_ticks)
    VALUES (?, ?, 'running', ?, ?, ?, ?)
  `).run(id, strategyId, JSON.stringify(config), JSON.stringify(nodes), JSON.stringify(connections), totalTicks);
  return id;
}

export function updateBacktestJobProgress(id: string, currentTick: number, progress: number, result: any): void {
  const db = getDb();
  db.prepare(`
    UPDATE backtest_jobs SET current_tick = ?, progress = ?, result = ? WHERE id = ?
  `).run(currentTick, progress, JSON.stringify(result), id);
}

export function completeBacktestJob(id: string, result: any): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE backtest_jobs SET status = 'completed', result = ?, progress = 1.0, completed_at = ? WHERE id = ?
  `).run(JSON.stringify(result), now, id);
}

export function failBacktestJob(id: string, error: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE backtest_jobs SET status = 'failed', error = ?, completed_at = ? WHERE id = ?
  `).run(error, now, id);
}

export function getBacktestJob(id: string): BacktestJob | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM backtest_jobs WHERE id = ?`).get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    strategyId: row.strategy_id,
    status: row.status,
    config: JSON.parse(row.config),
    nodes: JSON.parse(row.nodes),
    connections: JSON.parse(row.connections),
    result: row.result ? JSON.parse(row.result) : null,
    error: row.error,
    progress: row.progress,
    currentTick: row.current_tick,
    totalTicks: row.total_ticks,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function getBacktestJobsByStrategy(strategyId: string): BacktestJob[] {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM backtest_jobs WHERE strategy_id = ? ORDER BY created_at DESC LIMIT 10`).all(strategyId) as any[];
  return rows.map((row) => ({
    id: row.id,
    strategyId: row.strategy_id,
    status: row.status,
    config: JSON.parse(row.config),
    nodes: JSON.parse(row.nodes),
    connections: JSON.parse(row.connections),
    result: row.result ? JSON.parse(row.result) : null,
    error: row.error,
    progress: row.progress,
    currentTick: row.current_tick,
    totalTicks: row.total_ticks,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
}

