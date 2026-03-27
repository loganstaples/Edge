import { NextResponse } from "next/server";
import { createStream, getActiveStream, flowRateForInterval, MIN_BALANCE_USDC } from "@/lib/payments/streams";
import { initializeDatabase } from "@/lib/db/schema";

// Ensure tables exist
initializeDatabase();

/** POST — Create a new payment stream for a strategy */
export async function POST(req: Request) {
  const { strategyId, walletAddress, pollingIntervalMs } = await req.json();

  if (!strategyId || !walletAddress) {
    return NextResponse.json({ error: "strategyId and walletAddress are required" }, { status: 400 });
  }

  // Check if there's already an active stream
  const existing = getActiveStream(strategyId);
  if (existing) {
    return NextResponse.json(existing);
  }

  const flowRate = flowRateForInterval(pollingIntervalMs || 30000);
  const stream = createStream(strategyId, walletAddress, flowRate);

  return NextResponse.json(stream);
}

/** GET — Get active stream for a strategy */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const strategyId = searchParams.get("strategyId");

  if (!strategyId) {
    return NextResponse.json({ error: "strategyId is required" }, { status: 400 });
  }

  const stream = getActiveStream(strategyId);
  return NextResponse.json(stream);
}
