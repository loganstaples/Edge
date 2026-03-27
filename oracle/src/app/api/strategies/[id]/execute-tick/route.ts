import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { runStrategyTick } from "@/lib/engine/strategy-runner";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  try {
    const log = await runStrategyTick(id);
    if (!log) {
      return NextResponse.json({ error: "Strategy not running" }, { status: 400 });
    }
    return NextResponse.json(log);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
