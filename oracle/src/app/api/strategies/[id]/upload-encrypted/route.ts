import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy, updateStrategy } from "@/lib/db/queries";
import { uploadToZeroG } from "@/lib/storage/zg-client";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

/**
 * POST /api/strategies/:id/upload-encrypted
 *
 * Accepts client-side encrypted strategy data and:
 * 1. Stores it in the DB (encryptedData column)
 * 2. Uploads to 0G Storage and records the root hash
 *
 * Only the owner can call this.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
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

  const body = await req.json();
  const { encryptedData } = body;

  if (!encryptedData || typeof encryptedData !== "string") {
    return NextResponse.json({ error: "encryptedData required" }, { status: 400 });
  }

  // Store encrypted data in DB
  updateStrategy(id, { encryptedData });

  // Upload to 0G Storage (best-effort — works even if 0G is not configured)
  const zgRootHash = await uploadToZeroG(encryptedData);
  if (zgRootHash) {
    updateStrategy(id, { zgRootHash });
  }

  return NextResponse.json({ ok: true, zgRootHash });
}
