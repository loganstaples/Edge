import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy, updateStrategy, deleteStrategy } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

/**
 * GET /api/strategies/:id
 *
 * - Owner sees full strategy (nodes, connections, config).
 * - Non-owner sees full strategy only if it's public; nodes/connections are redacted.
 * - Private strategy returns 404 for non-owners.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  const walletAddress = req.headers.get("x-wallet-address");
  const strategy = getStrategy(id);

  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  const isOwner = strategy.ownerWallet === walletAddress;

  // Private strategies are invisible to non-owners
  if (!strategy.isPublic && !isOwner) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  // Strip plaintext logic — clients use encrypted data
  const response: any = {
    ...strategy,
    nodes: [],
    connections: [],
  };

  // Only owner gets encrypted data
  if (!isOwner) {
    response.encryptedData = null;
    response.zgRootHash = null;
  }

  return NextResponse.json(response);
}

/**
 * PUT /api/strategies/:id
 *
 * Only the owner can update a strategy.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  const walletAddress = req.headers.get("x-wallet-address");
  const strategy = getStrategy(id);

  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  // Ownership check: if strategy has an owner, only they can edit
  if (strategy.ownerWallet && strategy.ownerWallet !== walletAddress) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  updateStrategy(id, {
    name: body.name,
    description: body.description,
    nodes: body.nodes,
    connections: body.connections,
    status: body.status,
    isPublic: body.isPublic,
    nftMint: body.nftMint,
    ownerWallet: body.ownerWallet,
    encryptedData: body.encryptedData,
    zgRootHash: body.zgRootHash,
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/strategies/:id
 *
 * Only the owner can delete a strategy.
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  const walletAddress = req.headers.get("x-wallet-address");
  const strategy = getStrategy(id);

  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  if (strategy.ownerWallet && strategy.ownerWallet !== walletAddress) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  deleteStrategy(id);
  return NextResponse.json({ ok: true });
}
