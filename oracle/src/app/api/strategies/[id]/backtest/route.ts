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
    ticks?: number;
    startingCapital?: number;
    period?: "1d" | "1w" | "2w" | "1m";
  } = {};
  try {
    body = await req.json();
  } catch {
    // Use defaults
  }

  try {
    const result = await runBacktest(strategy, {
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
