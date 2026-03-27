import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy, insertStrategy } from "@/lib/db/queries";

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
  const newId = insertStrategy({
    name: `${strategy.name} (Clone)`,
    description: strategy.description ?? undefined,
    authorName: strategy.authorName ?? undefined,
    nodes: strategy.nodes,
    connections: strategy.connections,
  });
  return NextResponse.json({ id: newId }, { status: 201 });
}
