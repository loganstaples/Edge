import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getExecutionLogs } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const logs = getExecutionLogs(id, limit);
  return NextResponse.json(logs);
}
