import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getPublicStrategies } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

export async function GET() {
  ensureInit();
  const strategies = getPublicStrategies();
  return NextResponse.json(strategies);
}
