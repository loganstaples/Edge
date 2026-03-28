// src/app/api/strategies/[id]/backtest/route.ts
// Modified: backtest runs server-side as a background job.
// Returns { jobId } immediately; results stored in DB.
// Client polls /api/backtest-jobs/[jobId] for status.

import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy, createBacktestJob, updateBacktestJobProgress, completeBacktestJob, failBacktestJob } from "@/lib/db/queries";
import { runBacktest } from "@/lib/engine/backtester";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

// In-memory store for active backtest promises (prevents GC)
const activeBacktests = new Map<string, Promise<void>>();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;

  const strategy = getStrategy(id);
  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  let body: {
    nodes?: any[];
    connections?: any[];
    ticks?: number;
    startingCapital?: number;
    period?: "1d" | "1w" | "2w" | "1m";
    speed?: "slow" | "normal" | "fast";
  } = {};
  try {
    body = await req.json();
  } catch {
    // Use defaults
  }

  const nodes = body.nodes && body.nodes.length > 0 ? body.nodes : strategy.nodes;
  const connections = body.connections && body.connections.length > 0 ? body.connections : strategy.connections;

  if (nodes.length === 0) {
    return NextResponse.json(
      { error: "No strategy nodes provided. Decrypt your strategy and include nodes in the request." },
      { status: 400 },
    );
  }

  const ticks = body.ticks ?? 60;
  const startingCapital = body.startingCapital ?? 1000;
  const period = body.period ?? "1w";
  const config = { ticks, startingCapital, period };

  // Create background job in DB
  const jobId = createBacktestJob(id, config, nodes, connections, ticks);

  const strategyWithNodes = { ...strategy, nodes, connections };

  // Fire-and-forget: run backtest in background, store results in DB
  const backtestPromise = (async () => {
    try {
      await runBacktest(
        strategyWithNodes,
        config,
        async (event) => {
          if (event.type === "tick") {
            // Update progress in DB
            updateBacktestJobProgress(jobId, event.tick, (event.tick + 1) / event.totalTicks, event.data);
          } else if (event.type === "done") {
            completeBacktestJob(jobId, event.data);
          }
          // No delay needed — no client stream to sync with
        },
      );
    } catch (error) {
      failBacktestJob(jobId, String(error));
    } finally {
      activeBacktests.delete(jobId);
    }
  })();

  // Keep reference to prevent GC
  activeBacktests.set(jobId, backtestPromise);

  return NextResponse.json({ jobId });
}
