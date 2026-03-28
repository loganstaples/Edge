/**
 * Server-side 0G (Zero Gravity) decentralized storage client.
 *
 * Uploads encrypted strategy blobs to 0G Storage and retrieves them
 * by root hash. Gracefully degrades if 0G is not configured — the
 * encrypted data is still cached in the local DB.
 *
 * Required env vars:
 *   ZEROG_PRIVATE_KEY    - EVM private key for 0G chain gas fees
 *   ZEROG_EVM_RPC        - 0G chain EVM RPC (default: testnet)
 *   ZEROG_INDEXER_RPC    - 0G storage indexer (default: testnet)
 *   ZEROG_FLOW_ADDRESS   - Flow contract address (default: testnet)
 */

import { writeFileSync, readFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const ZG_EVM_RPC =
  process.env.ZEROG_EVM_RPC || "https://evmrpc-testnet.0g.ai";
const ZG_INDEXER_RPC =
  process.env.ZEROG_INDEXER_RPC ||
  "https://indexer-storage-testnet-standard.0g.ai";
const ZG_PRIVATE_KEY = process.env.ZEROG_PRIVATE_KEY || "";
const ZG_FLOW_ADDRESS =
  process.env.ZEROG_FLOW_ADDRESS ||
  "0xbD2C3F0E65eDF5582141C35969d66e34e3bDFF68";

function isConfigured(): boolean {
  return !!ZG_PRIVATE_KEY;
}

/**
 * Upload an encrypted strategy blob to 0G Storage.
 * Returns the root hash (content address) or null if 0G is unavailable.
 */
export async function uploadToZeroG(
  encryptedData: string
): Promise<string | null> {
  if (!isConfigured()) {
    console.warn("[0G] Storage not configured (missing ZEROG_PRIVATE_KEY)");
    return null;
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "zg-"));
  const tmpPath = join(tmpDir, "strategy.enc");
  writeFileSync(tmpPath, encryptedData, "utf-8");

  try {
    // Dynamic imports — these are server-only heavy dependencies
    const { ZgFile, Indexer } = await import("@0glabs/0g-ts-sdk");
    const { ethers } = await import("ethers");

    const provider = new ethers.JsonRpcProvider(ZG_EVM_RPC);
    const signer = new ethers.Wallet(ZG_PRIVATE_KEY, provider);

    const zgFile = await ZgFile.fromFilePath(tmpPath);
    const [tree, treeErr] = await zgFile.merkleTree();
    if (treeErr) throw new Error(`Merkle tree: ${treeErr}`);

    const rootHash: string = tree!.rootHash() ?? "";

    const indexer = new Indexer(ZG_INDEXER_RPC);
    const [, uploadErr] = await indexer.upload(
      zgFile,
      ZG_EVM_RPC,
      signer as any,
      ZG_FLOW_ADDRESS as any
    );
    if (uploadErr) throw new Error(`Upload: ${uploadErr}`);

    await zgFile.close();

    console.log(`[0G] Uploaded strategy → ${rootHash}`);
    return rootHash;
  } catch (err: any) {
    console.error("[0G] Upload failed:", err.message);
    return null;
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {}
  }
}

/**
 * Download an encrypted strategy blob from 0G Storage by root hash.
 * Returns the encrypted data string or null if unavailable.
 */
export async function downloadFromZeroG(
  rootHash: string
): Promise<string | null> {
  if (!isConfigured()) return null;

  const tmpDir = mkdtempSync(join(tmpdir(), "zg-"));
  const tmpPath = join(tmpDir, "strategy.enc");

  try {
    const { Indexer } = await import("@0glabs/0g-ts-sdk");

    const indexer = new Indexer(ZG_INDEXER_RPC);
    const dlResult = await indexer.download(rootHash, tmpPath, true);
    const err = Array.isArray(dlResult) ? dlResult[0] : dlResult;
    if (err) throw new Error(`Download: ${err}`);

    return readFileSync(tmpPath, "utf-8");
  } catch (err: any) {
    console.error("[0G] Download failed:", err.message);
    return null;
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {}
  }
}
