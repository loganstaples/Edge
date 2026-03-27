import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { updateStrategy, upsertStrategyPerformance } from "@/lib/db/queries";
import { getDb } from "@/lib/db/index";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  updateStrategy(id, { status: "running" });

  const db = getDb();
  const existing = db.prepare("SELECT id FROM strategy_performance WHERE strategy_id = ?").get(id);
  if (!existing) {
    upsertStrategyPerformance(id, {
      totalTrades: 0,
      winningTrades: 0,
      totalPnl: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
    });
  }

  return NextResponse.json({ status: "running" });
}
