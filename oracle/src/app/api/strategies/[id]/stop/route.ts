import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { updateStrategy } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  updateStrategy(id, { status: "stopped" });
  return NextResponse.json({ status: "stopped" });
}
