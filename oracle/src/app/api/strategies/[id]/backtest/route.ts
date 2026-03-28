// src/app/api/strategies/[id]/backtest/route.ts
import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy } from "@/lib/db/queries";
import { runBacktest } from "@/lib/engine/backtester";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

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
  } = {};
  try {
    body = await req.json();
  } catch {
    // Use defaults
  }

  // Use nodes from request body (client-decrypted), fall back to DB (legacy/migration)
  const strategyWithNodes = {
    ...strategy,
    nodes: body.nodes && body.nodes.length > 0 ? body.nodes : strategy.nodes,
    connections: body.connections && body.connections.length > 0 ? body.connections : strategy.connections,
  };

  if (strategyWithNodes.nodes.length === 0) {
    return NextResponse.json(
      { error: "No strategy nodes provided. Decrypt your strategy and include nodes in the request." },
      { status: 400 },
    );
  }

  try {
    const result = await runBacktest(strategyWithNodes, {
      ticks: body.ticks ?? 60,
      startingCapital: body.startingCapital ?? 1000,
      period: body.period ?? "1w",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `Backtest failed: ${String(error)}` },
      { status: 500 },
    );
  }
}
