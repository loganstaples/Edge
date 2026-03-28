import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getBacktestJob } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

/** GET — Poll backtest job status and results */
export async function GET(_req: Request, { params }: { params: { jobId: string } }) {
  ensureInit();
  const job = getBacktestJob(params.jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
