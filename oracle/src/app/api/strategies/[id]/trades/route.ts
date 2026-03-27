import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getSimulatedTrades } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  const trades = getSimulatedTrades(id);
  return NextResponse.json(trades);
}
