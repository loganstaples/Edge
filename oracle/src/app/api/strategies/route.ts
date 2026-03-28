import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getAllStrategies, insertStrategy } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

/**
 * GET /api/strategies
 *
 * With X-Wallet-Address: returns caller's own strategies + public strategies (nodes redacted).
 * Without: returns only public strategies with nodes redacted.
 */
export async function GET(req: Request) {
  ensureInit();
  const walletAddress = req.headers.get("x-wallet-address");

  const all = getAllStrategies();

  if (walletAddress) {
    const visible = all
      .filter((s) => s.ownerWallet === walletAddress || s.isPublic)
      .map((s) => ({
        ...s,
        nodes: [],
        connections: [],
        encryptedData: s.ownerWallet === walletAddress ? s.encryptedData : undefined,
        zgRootHash: s.ownerWallet === walletAddress ? s.zgRootHash : undefined,
      }));
    return NextResponse.json(visible);
  }

  const publicOnly = all
    .filter((s) => s.isPublic)
    .map((s) => ({
      ...s,
      nodes: [],
      connections: [],
      encryptedData: undefined,
      zgRootHash: undefined,
    }));
  return NextResponse.json(publicOnly);
}

/**
 * POST /api/strategies
 *
 * Create a new strategy. Requires X-Wallet-Address header to set ownership.
 */
export async function POST(req: Request) {
  ensureInit();
  const walletAddress = req.headers.get("x-wallet-address");
  const body = await req.json();

  if (!walletAddress) {
    return NextResponse.json(
      { error: "Wallet connection required to create a strategy" },
      { status: 401 }
    );
  }

  const id = insertStrategy({
    name: body.name || "Untitled Strategy",
    description: body.description,
    authorName: body.authorName,
    ownerWallet: walletAddress,
    nodes: body.nodes || [],
    connections: body.connections || [],
  });

  return NextResponse.json({ id }, { status: 201 });
}
