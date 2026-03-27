import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getAllStrategies, insertStrategy } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

export async function GET() {
  ensureInit();
  const strategies = getAllStrategies();
  return NextResponse.json(strategies);
}

export async function POST(req: Request) {
  ensureInit();
  const body = await req.json();
  const id = insertStrategy({
    name: body.name || "Untitled Strategy",
    description: body.description,
    authorName: body.authorName,
    nodes: body.nodes || [],
    connections: body.connections || [],
  });
  return NextResponse.json({ id }, { status: 201 });
}
