/**
 * Seed the database with 6 demo strategies + performance data.
 * Run: npx tsx scripts/seed-strategies.ts
 */
import { initializeDatabase } from "../src/lib/db/schema";
import {
  insertStrategy,
  updateStrategy,
  upsertStrategyPerformance,
  insertExecutionLog,
  insertSimulatedTrade,
  updateSimulatedTrade,
} from "../src/lib/db/queries";

initializeDatabase();

// Helper to make node IDs deterministic per strategy
let nodeCounter = 0;
function nid(): string {
  return `node-${++nodeCounter}`;
}

function cid(): string {
  return `conn-${nodeCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

function pastTimestamp(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60000).toISOString();
}

// ------- Strategy definitions -------

interface StrategyDef {
  name: string;
  description: string;
  authorName: string;
  nodes: { id: string; type: string; category: "data" | "ai" | "logic" | "action"; position: { x: number; y: number }; config: Record<string, any> }[];
  connections: { id: string; source_id: string; source_handle: string; target_id: string; target_handle: string }[];
  perf: { totalTrades: number; winningTrades: number; totalPnl: number; sharpeRatio: number; maxDrawdown: number };
  trades: { platform: "polymarket" | "gemini"; marketId: string; direction: "YES" | "NO"; entryPrice: number; amount: number; currentPrice?: number; pnl?: number; status?: "open" | "closed" }[];
}

const strategies: StrategyDef[] = [];

// 1. Momentum Scalper
{
  const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid();
  strategies.push({
    name: "Momentum Scalper",
    description: "Fast-moving strategy that watches Polymarket prices, calculates edge, and trades when the edge exceeds 10%.",
    authorName: "demo_trader",
    nodes: [
      { id: n1, type: "polymarket_markets", category: "data", position: { x: 250, y: 0 }, config: { keyword: "politics" } },
      { id: n2, type: "edge_calculator", category: "ai", position: { x: 250, y: 150 }, config: {} },
      { id: n3, type: "threshold_gate", category: "logic", position: { x: 250, y: 300 }, config: { threshold: 0.10, operator: ">" } },
      { id: n4, type: "trade_polymarket", category: "action", position: { x: 250, y: 450 }, config: { amount: 15 } },
    ],
    connections: [
      { id: cid(), source_id: n1, source_handle: "yes_price", target_id: n2, target_handle: "market_price" },
      { id: cid(), source_id: n2, source_handle: "edge_pct", target_id: n3, target_handle: "value" },
      { id: cid(), source_id: n3, source_handle: "passed_value", target_id: n4, target_handle: "signal" },
    ],
    perf: { totalTrades: 23, winningTrades: 16, totalPnl: 347.50, sharpeRatio: 1.82, maxDrawdown: 45.20 },
    trades: [
      { platform: "polymarket", marketId: "poly-fed-jul", direction: "YES", entryPrice: 0.58, amount: 20, currentPrice: 0.64, pnl: 12.00, status: "open" },
      { platform: "polymarket", marketId: "poly-btc-200k", direction: "NO", entryPrice: 0.42, amount: 15, currentPrice: 0.38, pnl: 6.00, status: "closed" },
      { platform: "polymarket", marketId: "poly-eu-ai", direction: "YES", entryPrice: 0.55, amount: 10, currentPrice: 0.52, pnl: -3.00, status: "closed" },
      { platform: "polymarket", marketId: "poly-artemis", direction: "YES", entryPrice: 0.22, amount: 15, currentPrice: 0.28, pnl: 9.00, status: "open" },
    ],
  });
}

// 2. News Sentiment Alpha
{
  const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid();
  strategies.push({
    name: "News Sentiment Alpha",
    description: "Analyzes news sentiment in real-time and trades on Gemini when bullish sentiment exceeds 0.3 threshold.",
    authorName: "alpha_seeker",
    nodes: [
      { id: n1, type: "news_feed", category: "data", position: { x: 250, y: 0 }, config: { category: "business" } },
      { id: n2, type: "sentiment_analyzer", category: "ai", position: { x: 250, y: 150 }, config: { keyword: "federal reserve" } },
      { id: n3, type: "threshold_gate", category: "logic", position: { x: 250, y: 300 }, config: { threshold: 0.30, operator: ">" } },
      { id: n4, type: "trade_gemini", category: "action", position: { x: 250, y: 450 }, config: { amount: 10 } },
    ],
    connections: [
      { id: cid(), source_id: n1, source_handle: "headline", target_id: n2, target_handle: "text" },
      { id: cid(), source_id: n2, source_handle: "sentiment_score", target_id: n3, target_handle: "value" },
      { id: cid(), source_id: n3, source_handle: "passed_value", target_id: n4, target_handle: "signal" },
    ],
    perf: { totalTrades: 18, winningTrades: 11, totalPnl: 218.30, sharpeRatio: 1.45, maxDrawdown: 32.10 },
    trades: [
      { platform: "gemini", marketId: "GEMI-FEDJUL26-DN25", direction: "YES", entryPrice: 0.60, amount: 12, currentPrice: 0.67, pnl: 8.40, status: "open" },
      { platform: "gemini", marketId: "GEMI-BTC200K-UP", direction: "NO", entryPrice: 0.40, amount: 10, currentPrice: 0.35, pnl: 5.00, status: "closed" },
      { platform: "gemini", marketId: "GEMI-EUAI-EXT", direction: "YES", entryPrice: 0.52, amount: 8, currentPrice: 0.48, pnl: -3.20, status: "closed" },
    ],
  });
}

// 3. Cross-Market Arbitrage
{
  const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid(), n5 = nid();
  strategies.push({
    name: "Cross-Market Arbitrage",
    description: "Compares prices across Gemini and Polymarket to find cross-platform edge opportunities above 15%.",
    authorName: "arb_master",
    nodes: [
      { id: n1, type: "gemini_markets", category: "data", position: { x: 100, y: 0 }, config: { category: "economics" } },
      { id: n2, type: "polymarket_markets", category: "data", position: { x: 400, y: 0 }, config: { keyword: "" } },
      { id: n3, type: "edge_calculator", category: "ai", position: { x: 250, y: 150 }, config: {} },
      { id: n4, type: "threshold_gate", category: "logic", position: { x: 250, y: 300 }, config: { threshold: 0.15, operator: ">" } },
      { id: n5, type: "trade_polymarket", category: "action", position: { x: 250, y: 450 }, config: { amount: 25 } },
    ],
    connections: [
      { id: cid(), source_id: n1, source_handle: "contract_price", target_id: n3, target_handle: "ai_probability" },
      { id: cid(), source_id: n2, source_handle: "yes_price", target_id: n3, target_handle: "market_price" },
      { id: cid(), source_id: n3, source_handle: "edge_pct", target_id: n4, target_handle: "value" },
      { id: cid(), source_id: n4, source_handle: "passed_value", target_id: n5, target_handle: "signal" },
    ],
    perf: { totalTrades: 31, winningTrades: 23, totalPnl: 512.80, sharpeRatio: 2.10, maxDrawdown: 58.40 },
    trades: [
      { platform: "polymarket", marketId: "poly-fed-jul", direction: "YES", entryPrice: 0.56, amount: 25, currentPrice: 0.64, pnl: 20.00, status: "closed" },
      { platform: "polymarket", marketId: "poly-btc-200k", direction: "YES", entryPrice: 0.34, amount: 20, currentPrice: 0.38, pnl: 8.00, status: "open" },
      { platform: "polymarket", marketId: "poly-artemis", direction: "NO", entryPrice: 0.78, amount: 25, currentPrice: 0.82, pnl: 10.00, status: "closed" },
      { platform: "polymarket", marketId: "poly-uk-pm", direction: "YES", entryPrice: 0.30, amount: 15, currentPrice: 0.27, pnl: -4.50, status: "closed" },
      { platform: "polymarket", marketId: "poly-eu-ai", direction: "NO", entryPrice: 0.45, amount: 20, currentPrice: 0.48, pnl: -6.00, status: "open" },
    ],
  });
}

// 4. AI Conviction Trader
{
  const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid(), n5 = nid();
  strategies.push({
    name: "AI Conviction Trader",
    description: "Uses Claude AI to estimate event probability from news, then trades on Gemini when both edge and sentiment align.",
    authorName: "ai_believer",
    nodes: [
      { id: n1, type: "news_feed", category: "data", position: { x: 250, y: 0 }, config: { category: "" } },
      { id: n2, type: "ai_probability_estimator", category: "ai", position: { x: 100, y: 150 }, config: {} },
      { id: n3, type: "edge_calculator", category: "ai", position: { x: 100, y: 300 }, config: {} },
      { id: n4, type: "and_or", category: "logic", position: { x: 250, y: 450 }, config: { mode: "AND" } },
      { id: n5, type: "trade_gemini", category: "action", position: { x: 250, y: 600 }, config: { amount: 12 } },
    ],
    connections: [
      { id: cid(), source_id: n1, source_handle: "headline", target_id: n2, target_handle: "event_context" },
      { id: cid(), source_id: n2, source_handle: "ai_probability", target_id: n3, target_handle: "ai_probability" },
      { id: cid(), source_id: n3, source_handle: "edge", target_id: n4, target_handle: "input_1" },
      { id: cid(), source_id: n2, source_handle: "confidence", target_id: n4, target_handle: "input_2" },
      { id: cid(), source_id: n4, source_handle: "result", target_id: n5, target_handle: "signal" },
    ],
    perf: { totalTrades: 14, winningTrades: 8, totalPnl: 156.40, sharpeRatio: 1.23, maxDrawdown: 28.50 },
    trades: [
      { platform: "gemini", marketId: "GEMI-FEDJUL26-DN25", direction: "YES", entryPrice: 0.61, amount: 12, currentPrice: 0.67, pnl: 7.20, status: "open" },
      { platform: "gemini", marketId: "GEMI-BTC200K-UP", direction: "YES", entryPrice: 0.36, amount: 10, currentPrice: 0.38, pnl: 2.00, status: "open" },
      { platform: "gemini", marketId: "GEMI-EUAI-EXT", direction: "NO", entryPrice: 0.48, amount: 12, currentPrice: 0.52, pnl: -4.80, status: "closed" },
    ],
  });
}

// 5. Conservative Yield
{
  const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid(), n5 = nid();
  strategies.push({
    name: "Conservative Yield",
    description: "Low-frequency strategy that filters Gemini markets, only trading when edge exceeds 20% and with a cooldown between trades.",
    authorName: "steady_hands",
    nodes: [
      { id: n1, type: "gemini_markets", category: "data", position: { x: 250, y: 0 }, config: { category: "" } },
      { id: n2, type: "market_filter", category: "data", position: { x: 250, y: 130 }, config: { min_volume: 1000, category: "", price_range: [0.2, 0.8] } },
      { id: n3, type: "edge_calculator", category: "ai", position: { x: 250, y: 260 }, config: {} },
      { id: n4, type: "threshold_gate", category: "logic", position: { x: 250, y: 390 }, config: { threshold: 0.20, operator: ">" } },
      { id: n5, type: "cooldown_timer", category: "logic", position: { x: 250, y: 520 }, config: { seconds: 600 } },
    ],
    connections: [
      { id: cid(), source_id: n1, source_handle: "contract_price", target_id: n2, target_handle: "markets" },
      { id: cid(), source_id: n2, source_handle: "filtered_markets", target_id: n3, target_handle: "market_price" },
      { id: cid(), source_id: n3, source_handle: "edge_pct", target_id: n4, target_handle: "value" },
      { id: cid(), source_id: n4, source_handle: "passed_value", target_id: n5, target_handle: "trigger" },
    ],
    perf: { totalTrades: 8, winningTrades: 4, totalPnl: 89.20, sharpeRatio: 0.95, maxDrawdown: 18.30 },
    trades: [
      { platform: "gemini", marketId: "GEMI-FEDJUL26-DN25", direction: "YES", entryPrice: 0.55, amount: 20, currentPrice: 0.62, pnl: 14.00, status: "closed" },
      { platform: "gemini", marketId: "GEMI-BTC200K-UP", direction: "NO", entryPrice: 0.44, amount: 15, currentPrice: 0.38, pnl: 9.00, status: "closed" },
      { platform: "gemini", marketId: "GEMI-EUAI-EXT", direction: "YES", entryPrice: 0.50, amount: 10, currentPrice: 0.48, pnl: -2.00, status: "open" },
    ],
  });
}

// 6. Full Autopilot
{
  const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid(), n5 = nid(), n6 = nid(), n7 = nid(), n8 = nid();
  strategies.push({
    name: "Full Autopilot",
    description: "Multi-source strategy combining news, Gemini, and Polymarket data through AI probability estimation, then auto-trades and logs alerts.",
    authorName: "oracle_team",
    nodes: [
      { id: n1, type: "news_feed", category: "data", position: { x: 50, y: 0 }, config: { category: "" } },
      { id: n2, type: "gemini_markets", category: "data", position: { x: 250, y: 0 }, config: { category: "" } },
      { id: n3, type: "polymarket_markets", category: "data", position: { x: 450, y: 0 }, config: { keyword: "" } },
      { id: n4, type: "ai_probability_estimator", category: "ai", position: { x: 250, y: 150 }, config: {} },
      { id: n5, type: "edge_calculator", category: "ai", position: { x: 250, y: 300 }, config: {} },
      { id: n6, type: "and_or", category: "logic", position: { x: 250, y: 450 }, config: { mode: "AND" } },
      { id: n7, type: "trade_polymarket", category: "action", position: { x: 150, y: 600 }, config: { amount: 20 } },
      { id: n8, type: "alert_log", category: "action", position: { x: 400, y: 600 }, config: { severity: "info" } },
    ],
    connections: [
      { id: cid(), source_id: n1, source_handle: "headline", target_id: n4, target_handle: "event_context" },
      { id: cid(), source_id: n4, source_handle: "ai_probability", target_id: n5, target_handle: "ai_probability" },
      { id: cid(), source_id: n3, source_handle: "yes_price", target_id: n5, target_handle: "market_price" },
      { id: cid(), source_id: n5, source_handle: "edge", target_id: n6, target_handle: "input_1" },
      { id: cid(), source_id: n4, source_handle: "confidence", target_id: n6, target_handle: "input_2" },
      { id: cid(), source_id: n6, source_handle: "result", target_id: n7, target_handle: "signal" },
      { id: cid(), source_id: n6, source_handle: "result", target_id: n8, target_handle: "message" },
    ],
    perf: { totalTrades: 27, winningTrades: 19, totalPnl: 423.60, sharpeRatio: 1.67, maxDrawdown: 52.10 },
    trades: [
      { platform: "polymarket", marketId: "poly-fed-jul", direction: "YES", entryPrice: 0.57, amount: 20, currentPrice: 0.64, pnl: 14.00, status: "open" },
      { platform: "polymarket", marketId: "poly-btc-200k", direction: "NO", entryPrice: 0.43, amount: 18, currentPrice: 0.38, pnl: 9.00, status: "closed" },
      { platform: "polymarket", marketId: "poly-artemis", direction: "YES", entryPrice: 0.20, amount: 15, currentPrice: 0.28, pnl: 12.00, status: "closed" },
      { platform: "polymarket", marketId: "poly-uk-pm", direction: "NO", entryPrice: 0.66, amount: 20, currentPrice: 0.70, pnl: -8.00, status: "closed" },
      { platform: "polymarket", marketId: "poly-eu-ai", direction: "YES", entryPrice: 0.53, amount: 12, currentPrice: 0.55, pnl: 2.40, status: "open" },
    ],
  });
}

// ------- Seed them -------

console.log("Seeding 6 demo strategies...\n");

for (const def of strategies) {
  const id = insertStrategy({
    name: def.name,
    description: def.description,
    authorName: def.authorName,
    nodes: def.nodes,
    connections: def.connections,
  });

  updateStrategy(id, { isPublic: true, status: "stopped" });

  upsertStrategyPerformance(id, def.perf);

  // Execution logs — generate 4 fake logs per strategy
  const logMessages = [
    { tradePlaced: true, pnl: +(def.perf.totalPnl / def.perf.totalTrades * 1.2).toFixed(2) },
    { tradePlaced: true, pnl: +(def.perf.totalPnl / def.perf.totalTrades * 0.8).toFixed(2) },
    { tradePlaced: false, pnl: 0 },
    { tradePlaced: true, pnl: -(def.perf.totalPnl / def.perf.totalTrades * 0.4).toFixed(2) as unknown as number },
  ];

  for (let i = 0; i < logMessages.length; i++) {
    const msg = logMessages[i];
    insertExecutionLog({
      strategyId: id,
      nodeLogs: {
        nodes_executed: def.nodes.length,
        data_fetched: true,
        edge_calculated: msg.tradePlaced,
        threshold_passed: msg.tradePlaced,
      },
      tradePlaced: msg.tradePlaced,
      tradeDetails: msg.tradePlaced ? {
        platform: def.trades[0]?.platform ?? "polymarket",
        direction: i % 2 === 0 ? "YES" : "NO",
        amount: def.nodes.find(n => n.type.startsWith("trade_"))?.config.amount ?? 10,
        price: 0.55 + Math.random() * 0.15,
      } : undefined,
      pnlDelta: +msg.pnl,
    });
  }

  // Simulated trades
  for (const t of def.trades) {
    const tradeId = insertSimulatedTrade({
      strategyId: id,
      platform: t.platform,
      marketId: t.marketId,
      direction: t.direction,
      entryPrice: t.entryPrice,
      amount: t.amount,
    });
    if (t.currentPrice !== undefined || t.pnl !== undefined || t.status) {
      updateSimulatedTrade(tradeId, {
        currentPrice: t.currentPrice,
        pnl: t.pnl,
        status: t.status,
      });
    }
  }

  const winRate = ((def.perf.winningTrades / def.perf.totalTrades) * 100).toFixed(0);
  console.log(`  [+] ${def.name} — ${def.perf.totalTrades} trades, ${winRate}% win, $${def.perf.totalPnl.toFixed(2)} P&L, Sharpe ${def.perf.sharpeRatio}`);
}

console.log("\nDone! 6 strategies seeded with performance data, execution logs, and simulated trades.");
