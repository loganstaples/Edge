import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import { downloadFromZeroG } from "@/lib/storage/zg-client";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

interface StrategyRow {
  id: string;
  encrypted_data: string | null;
  zg_root_hash: string | null;
}

/**
 * GET /api/strategies/encrypted
 *
 * Bulk-fetches all encrypted strategy blobs for a wallet in one request.
 * The client decrypts them locally — no plaintext strategy data leaves
 * the client.
 *
 * If encrypted_data is missing but zg_root_hash exists, the blob is
 * pulled from 0G Storage and cached back into the DB for future requests.
 */
export async function GET(req: Request) {
  ensureInit();

  const walletAddress = req.headers.get("x-wallet-address");
  if (!walletAddress) {
    return NextResponse.json({ error: "X-Wallet-Address header required" }, { status: 401 });
  }

  const db = getDb();
  const rows = db
    .prepare("SELECT id, encrypted_data, zg_root_hash FROM strategies WHERE owner_wallet = ?")
    .all(walletAddress) as StrategyRow[];

  const strategies: { id: string; encryptedData: string }[] = [];

  for (const row of rows) {
    let encryptedData = row.encrypted_data;

    // Fall back to 0G Storage if the local cache is empty
    if (!encryptedData && row.zg_root_hash) {
      const fetched = await downloadFromZeroG(row.zg_root_hash);
      if (fetched) {
        encryptedData = fetched;
        // Cache back into DB so subsequent requests are fast
        db.prepare("UPDATE strategies SET encrypted_data = ? WHERE id = ?").run(fetched, row.id);
      }
    }

    if (encryptedData) {
      strategies.push({ id: row.id, encryptedData });
    }
  }

  return NextResponse.json({ strategies });
}
