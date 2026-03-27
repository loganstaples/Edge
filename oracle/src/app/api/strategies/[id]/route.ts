import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy, updateStrategy, deleteStrategy } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  const strategy = getStrategy(id);
  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }
  return NextResponse.json(strategy);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  const body = await req.json();
  updateStrategy(id, {
    name: body.name,
    description: body.description,
    nodes: body.nodes,
    connections: body.connections,
    status: body.status,
    isPublic: body.isPublic,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  deleteStrategy(id);
  return NextResponse.json({ ok: true });
}
