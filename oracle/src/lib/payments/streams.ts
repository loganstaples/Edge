// src/lib/payments/streams.ts
// Streaming crypto payment logic for strategy execution billing.
//
// Flow rates are denominated in USDC-per-second. A strategy "stream" opens
// when the user deploys or backtests and accrues cost each tick. The stream
// can be paused/stopped. The wallet balance is checked client-side; the
// server tracks total_streamed and validates the stream is active before
// allowing execution ticks.

import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
export { TICK_COST_USDC, BACKTEST_TICK_COST_USDC, MIN_BALANCE_USDC } from "./constants";
import { TICK_COST_USDC } from "./constants";

/** Flow rate in USDC/second for a given polling interval */
export function flowRateForInterval(pollingIntervalMs: number): string {
  const ticksPerSecond = 1000 / pollingIntervalMs;
  return (ticksPerSecond * TICK_COST_USDC).toFixed(8);
}

// --- Stream types ---
export interface PaymentStream {
  id: string;
  strategyId: string;
  walletAddress: string;
  flowRate: string;
  token: string;
  totalStreamed: number;
  status: "active" | "paused" | "stopped";
  startedAt: string;
  lastTickAt: string | null;
  stoppedAt: string | null;
}

// --- DB operations ---

export function createStream(strategyId: string, walletAddress: string, flowRate: string): PaymentStream {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO payment_streams (id, strategy_id, wallet_address, flow_rate, token, status, started_at)
    VALUES (?, ?, ?, ?, 'USDC', 'active', ?)
  `).run(id, strategyId, walletAddress, flowRate, now);

  return {
    id,
    strategyId,
    walletAddress,
    flowRate,
    token: "USDC",
    totalStreamed: 0,
    status: "active",
    startedAt: now,
    lastTickAt: null,
    stoppedAt: null,
  };
}

export function getActiveStream(strategyId: string): PaymentStream | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, strategy_id, wallet_address, flow_rate, token, total_streamed, status, started_at, last_tick_at, stopped_at
    FROM payment_streams
    WHERE strategy_id = ? AND status = 'active'
    ORDER BY started_at DESC LIMIT 1
  `).get(strategyId) as any;

  if (!row) return null;

  return {
    id: row.id,
    strategyId: row.strategy_id,
    walletAddress: row.wallet_address,
    flowRate: row.flow_rate,
    token: row.token,
    totalStreamed: row.total_streamed,
    status: row.status,
    startedAt: row.started_at,
    lastTickAt: row.last_tick_at,
    stoppedAt: row.stopped_at,
  };
}

export function recordTickPayment(streamId: string, amount: number): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE payment_streams
    SET total_streamed = total_streamed + ?, last_tick_at = ?
    WHERE id = ?
  `).run(amount, now, streamId);
}

export function pauseStream(streamId: string): void {
  const db = getDb();
  db.prepare(`UPDATE payment_streams SET status = 'paused' WHERE id = ?`).run(streamId);
}

export function resumeStream(streamId: string): void {
  const db = getDb();
  db.prepare(`UPDATE payment_streams SET status = 'active' WHERE id = ?`).run(streamId);
}

export function stopStream(streamId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE payment_streams SET status = 'stopped', stopped_at = ? WHERE id = ?`).run(now, streamId);
}

export function getStreamsByWallet(walletAddress: string): PaymentStream[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, strategy_id, wallet_address, flow_rate, token, total_streamed, status, started_at, last_tick_at, stopped_at
    FROM payment_streams
    WHERE wallet_address = ?
    ORDER BY started_at DESC
  `).all(walletAddress) as any[];

  return rows.map((row) => ({
    id: row.id,
    strategyId: row.strategy_id,
    walletAddress: row.wallet_address,
    flowRate: row.flow_rate,
    token: row.token,
    totalStreamed: row.total_streamed,
    status: row.status,
    startedAt: row.started_at,
    lastTickAt: row.last_tick_at,
    stoppedAt: row.stopped_at,
  }));
}

/** Total USDC streamed across all strategies for a wallet */
export function getTotalStreamedByWallet(walletAddress: string): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT COALESCE(SUM(total_streamed), 0) as total
    FROM payment_streams
    WHERE wallet_address = ?
  `).get(walletAddress) as any;
  return row?.total ?? 0;
}
