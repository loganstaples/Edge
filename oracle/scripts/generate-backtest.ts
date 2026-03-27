/**
 * Export execution logs and simulated trades as JSON for the Polymarket bounty.
 * Run: npx tsx scripts/generate-backtest.ts
 */
import { initializeDatabase } from "../src/lib/db/schema";
import {
  getAllStrategies,
  getExecutionLogs,
  getSimulatedTrades,
} from "../src/lib/db/queries";
import { getDb } from "../src/lib/db/index";
import * as fs from "fs";
import * as path from "path";

initializeDatabase();

const strategies = getAllStrategies();
const db = getDb();

interface BacktestExport {
  export_date: string;
  total_strategies: number;
  summary: {
    total_trades: number;
    total_pnl: number;
    avg_sharpe: number;
    avg_win_rate: number;
  };
  strategies: any[];
}

let globalTrades = 0;
let globalPnl = 0;
let sharpeSum = 0;
let winRateSum = 0;
let stratCount = 0;

const strategyExports: any[] = [];

for (const strat of strategies) {
  // Get performance data
  const perfRow = db.prepare(
    "SELECT * FROM strategy_performance WHERE strategy_id = ?"
  ).get(strat.id) as any;

  const perf = perfRow
    ? {
        total_trades: perfRow.total_trades,
        win_rate: perfRow.total_trades > 0
          ? +((perfRow.winning_trades / perfRow.total_trades) * 100).toFixed(1)
          : 0,
        pnl: perfRow.total_pnl,
        sharpe: perfRow.sharpe_ratio,
        max_drawdown: perfRow.max_drawdown,
      }
    : { total_trades: 0, win_rate: 0, pnl: 0, sharpe: 0, max_drawdown: 0 };

  // Get execution logs
  const logs = getExecutionLogs(strat.id, 100);
  const executionLog = logs.map((log) => ({
    timestamp: log.timestamp,
    nodes_executed: log.nodeLogs?.nodes_executed ?? Object.keys(log.nodeLogs).length,
    trade_placed: log.tradePlaced,
    trade_details: log.tradeDetails ?? null,
    pnl_delta: log.pnlDelta,
  }));

  // Get simulated trades
  const trades = getSimulatedTrades(strat.id);
  const tradeExport = trades.map((t) => ({
    platform: t.platform,
    market_id: t.marketId,
    direction: t.direction,
    entry_price: t.entryPrice,
    current_price: t.currentPrice,
    amount: t.amount,
    pnl: t.pnl,
    status: t.status,
    opened_at: t.openedAt,
    closed_at: t.closedAt,
  }));

  strategyExports.push({
    id: strat.id,
    name: strat.name,
    description: strat.description,
    status: strat.status,
    author: strat.authorName,
    is_public: strat.isPublic,
    node_count: strat.nodes.length,
    connection_count: strat.connections.length,
    performance: perf,
    execution_log: executionLog,
    trades: tradeExport,
  });

  globalTrades += perf.total_trades;
  globalPnl += perf.pnl;
  sharpeSum += perf.sharpe;
  winRateSum += perf.win_rate;
  stratCount++;
}

const exportData: BacktestExport = {
  export_date: new Date().toISOString(),
  total_strategies: strategyExports.length,
  summary: {
    total_trades: globalTrades,
    total_pnl: +globalPnl.toFixed(2),
    avg_sharpe: stratCount > 0 ? +(sharpeSum / stratCount).toFixed(2) : 0,
    avg_win_rate: stratCount > 0 ? +(winRateSum / stratCount).toFixed(1) : 0,
  },
  strategies: strategyExports,
};

// Write to file
const outDir = path.resolve(__dirname, "..", "backtest-results");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, "backtest-export.json");
fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2));

// Print summary
console.log("=== ORACLE Backtest Export ===\n");
console.log(`Export date:    ${exportData.export_date}`);
console.log(`Strategies:     ${exportData.total_strategies}`);
console.log(`Total trades:   ${exportData.summary.total_trades}`);
console.log(`Total P&L:      $${exportData.summary.total_pnl.toFixed(2)}`);
console.log(`Avg Sharpe:     ${exportData.summary.avg_sharpe}`);
console.log(`Avg Win Rate:   ${exportData.summary.avg_win_rate}%`);
console.log("");

for (const s of strategyExports) {
  const p = s.performance;
  console.log(`  ${s.name}`);
  console.log(`    Trades: ${p.total_trades} | Win: ${p.win_rate}% | P&L: $${p.pnl.toFixed(2)} | Sharpe: ${p.sharpe} | Logs: ${s.execution_log.length} | Open positions: ${s.trades.filter((t: any) => t.status === "open").length}`);
}

console.log(`\nWritten to: ${outPath}`);
