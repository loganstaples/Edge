import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

/**
 * GET /api/strategies/:id/metadata.json
 *
 * Serves Metaplex-standard NFT metadata JSON for a strategy.
 * The metadata URI on the NFT points to this endpoint.
 * Only exposes public metadata — no nodes or connections.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  ensureInit();
  const strategy = getStrategy(params.id);

  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const attributes: { trait_type: string; value: string }[] = [
    {
      trait_type: "Author",
      value: strategy.ownerWallet
        ? `${strategy.ownerWallet.slice(0, 4)}…${strategy.ownerWallet.slice(-4)}`
        : "Unknown",
    },
    {
      trait_type: "Status",
      value: strategy.status,
    },
    {
      trait_type: "Created",
      value: new Date(strategy.createdAt).toISOString().split("T")[0],
    },
  ];

  if (strategy.zgRootHash) {
    attributes.push({
      trait_type: "0G Root Hash",
      value: strategy.zgRootHash,
    });
  }

  const metadata = {
    name: strategy.name,
    symbol: "EDGE",
    description:
      strategy.description ||
      "An automated prediction market trading strategy built with Edge.",
    image: `${origin}/api/strategies/${params.id}/og-image`,
    external_url: `${origin}/?id=${params.id}`,
    attributes,
    properties: {
      category: "strategy",
      files: [] as { uri: string; type: string }[],
    },
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
}
