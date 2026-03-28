# NFT Metadata + Strategy Encryption + Load-on-Launch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make strategy NFTs visible in wallets with Metaplex metadata, remove plaintext strategy logic from the DB, add a load-all-on-launch flow that decrypts strategies client-side, and wire up 0G download as a fallback.

**Architecture:** Strategy metadata (name, description, performance) stays public in SQLite. Strategy logic (nodes, connections) is encrypted client-side with AES-256-GCM (key derived from Phantom wallet signature) and stored in `encrypted_data` / 0G. NFTs are minted via Metaplex with a metadata URI pointing to a dynamic API route. On wallet connect, all strategies are bulk-fetched, decrypted once, and cached in React context for the session.

**Tech Stack:** Next.js 14, Solana web3.js, Metaplex mpl-token-metadata + umi, Web Crypto API (AES-256-GCM), 0G Storage SDK, SQLite (better-sqlite3)

---

### Task 1: Install Metaplex Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Metaplex packages**

Run:
```bash
cd /Users/loganstaples/hackathons/penn26/oracle && npm install @metaplex-foundation/umi @metaplex-foundation/umi-bundle-defaults @metaplex-foundation/mpl-token-metadata @metaplex-foundation/umi-signer-wallet-adapters
```

- [ ] **Step 2: Verify installation**

Run:
```bash
cd /Users/loganstaples/hackathons/penn26/oracle && node -e "require('@metaplex-foundation/umi'); require('@metaplex-foundation/mpl-token-metadata'); require('@metaplex-foundation/umi-signer-wallet-adapters'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add package.json package-lock.json && git commit -m "Add Metaplex dependencies for NFT metadata"
```

---

### Task 2: Metadata JSON API Route

**Files:**
- Create: `src/app/api/strategies/[id]/metadata.json/route.ts`

- [ ] **Step 1: Create the metadata.json route**

This route serves Metaplex-standard JSON for the NFT. It reads public metadata from the DB — no nodes/connections.

```typescript
// src/app/api/strategies/[id]/metadata.json/route.ts
import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const strategy = getStrategy(params.id);
  if (!strategy) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const authorShort = strategy.ownerWallet
    ? `${strategy.ownerWallet.slice(0, 4)}...${strategy.ownerWallet.slice(-4)}`
    : "anonymous";

  const metadata = {
    name: strategy.name,
    symbol: "EDGE",
    description: strategy.description || `Trading strategy built on EDGE`,
    image: `${origin}/api/strategies/${strategy.id}/og-image`,
    external_url: `${origin}/?id=${strategy.id}`,
    attributes: [
      { trait_type: "Author", value: authorShort },
      { trait_type: "Status", value: strategy.status },
      { trait_type: "Created", value: strategy.createdAt.split("T")[0] },
      ...(strategy.zgRootHash
        ? [{ trait_type: "0G Root Hash", value: strategy.zgRootHash }]
        : []),
    ],
    properties: {
      category: "strategy",
      files: [],
    },
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
}
```

- [ ] **Step 2: Verify the route compiles**

Run:
```bash
cd /Users/loganstaples/hackathons/penn26/oracle && npx next build 2>&1 | head -30
```
Expected: No errors related to `metadata.json/route.ts`. (Build may show other warnings — that's fine.)

- [ ] **Step 3: Commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add src/app/api/strategies/\[id\]/metadata.json/route.ts && git commit -m "Add Metaplex metadata JSON endpoint for strategy NFTs"
```

---

### Task 3: OG Image Route (SVG)

**Files:**
- Create: `src/app/api/strategies/[id]/og-image/route.ts`

- [ ] **Step 1: Create the OG image route**

Returns a branded SVG image for the NFT. No external dependencies.

```typescript
// src/app/api/strategies/[id]/og-image/route.ts
import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const strategy = getStrategy(params.id);
  if (!strategy) {
    return new NextResponse("Not found", { status: 404 });
  }

  const name = escapeXml(strategy.name.slice(0, 40));
  const status = escapeXml(strategy.status.toUpperCase());
  const statusColor = strategy.status === "running" ? "#34d399"
    : strategy.status === "paused" ? "#fbbf24"
    : strategy.status === "stopped" ? "#f87171"
    : "#a1a1aa";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#09090b"/>
      <stop offset="100%" stop-color="#18181b"/>
    </linearGradient>
  </defs>
  <rect width="600" height="400" fill="url(#bg)" rx="24"/>
  <rect x="0" y="0" width="600" height="4" fill="#fff" opacity="0.06" rx="2"/>
  <text x="40" y="60" font-family="system-ui, sans-serif" font-size="14" font-weight="700" letter-spacing="4" fill="#ffffff" opacity="0.5">EDGE</text>
  <text x="40" y="200" font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="#fafafa">${name}</text>
  <rect x="40" y="220" width="60" height="24" rx="12" fill="${statusColor}" opacity="0.15"/>
  <text x="70" y="237" font-family="system-ui, monospace" font-size="11" font-weight="600" fill="${statusColor}" text-anchor="middle">${status}</text>
  <text x="40" y="360" font-family="system-ui, monospace" font-size="11" fill="#71717a">Strategy NFT</text>
  <text x="560" y="360" font-family="system-ui, monospace" font-size="11" fill="#71717a" text-anchor="end">${escapeXml(strategy.id.slice(0, 8))}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add src/app/api/strategies/\[id\]/og-image/route.ts && git commit -m "Add SVG OG image route for strategy NFTs"
```

---

### Task 4: Rewrite NFT Minting with Metaplex

**Files:**
- Modify: `src/lib/nft/mint.ts`

- [ ] **Step 1: Rewrite mint.ts to use Metaplex**

Replace the entire file. The new version uses `@metaplex-foundation/mpl-token-metadata` with `umi` to create an NFT with on-chain metadata.

```typescript
// src/lib/nft/mint.ts
"use client";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createNft,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  generateSigner,
  percentAmount,
  publicKey as umiPublicKey,
} from "@metaplex-foundation/umi";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export interface MintResult {
  mintAddress: string;
  signature: string;
}

/**
 * Mint a strategy NFT with full Metaplex metadata.
 *
 * @param strategyId - The strategy DB id (used to build the metadata URI)
 * @param ownerAddress - The wallet address that will own the NFT
 * @param strategyName - Human-readable name for the NFT
 * @param walletAdapter - A Phantom-compatible wallet adapter with publicKey and signTransaction
 */
export async function mintStrategyNft(
  strategyId: string,
  ownerAddress: string,
  strategyName: string,
  walletAdapter: {
    publicKey: { toBytes(): Uint8Array };
    signTransaction: <T>(tx: T) => Promise<T>;
    signAllTransactions?: <T>(txs: T[]) => Promise<T[]>;
  },
): Promise<MintResult> {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const metadataUri = `${origin}/api/strategies/${strategyId}/metadata.json`;

  // Create Umi instance
  const umi = createUmi(RPC_URL).use(mplTokenMetadata());

  // Register Phantom as the signer
  umi.use(walletAdapterIdentity(walletAdapter));

  // Generate a new mint address
  const mint = generateSigner(umi);

  // Create the NFT with metadata
  const { signature } = await createNft(umi, {
    mint,
    name: strategyName.slice(0, 32),
    symbol: "EDGE",
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0),
    creators: [
      {
        address: umiPublicKey(ownerAddress),
        verified: true,
        share: 100,
      },
    ],
  }).sendAndConfirm(umi);

  // Convert Umi signature (Uint8Array) to base58 string
  const sigStr = typeof signature === "string"
    ? signature
    : Buffer.from(signature).toString("base64");

  return {
    mintAddress: mint.publicKey.toString(),
    signature: sigStr,
  };
}
```

- [ ] **Step 2: Update useStrategy.ts mintNft to pass the new arguments**

In `src/hooks/useStrategy.ts`, the `mintNft` callback needs to pass `strategyId`, `strategyName`, and a wallet adapter object instead of just `signAndSendTransaction`. Replace the `mintNft` callback (lines 153-174):

```typescript
  const mintNft = useCallback(async (
    strategyId: string,
    walletAddress: string,
    strategyName: string,
    walletAdapter: {
      publicKey: { toBytes(): Uint8Array };
      signTransaction: <T>(tx: T) => Promise<T>;
      signAllTransactions?: <T>(txs: T[]) => Promise<T[]>;
    },
  ): Promise<string> => {
    setIsMinting(true);
    try {
      const result = await mintStrategyNft(strategyId, walletAddress, strategyName, walletAdapter);

      // Store the NFT mint address on the strategy
      await fetch(`/api/strategies/${strategyId}`, {
        method: "PUT",
        headers: authHeaders(walletAddress),
        body: JSON.stringify({ nftMint: result.mintAddress }),
      });

      setStrategy((s) => s ? { ...s, nftMint: result.mintAddress } : s);
      return result.mintAddress;
    } finally {
      setIsMinting(false);
    }
  }, []);
```

Also update the import at the top of useStrategy.ts — remove the `Transaction` import since we no longer need it:

Replace line 8:
```typescript
import type { Transaction } from "@solana/web3.js";
```
With: (delete the line entirely — it's no longer needed)

- [ ] **Step 3: Update Canvas.tsx handleSave to pass new mint arguments**

In `src/components/builder/Canvas.tsx`, update the `handleSave` function. The mint call needs `strategyName` and a wallet adapter object. Replace the mint block inside handleSave (the `if (isNew && wallet.address)` block):

```typescript
    // Mint NFT for new strategies
    if (isNew && wallet.address) {
      try {
        const phantom = (window as any).phantom?.solana;
        if (phantom) {
          await mintNft(id, wallet.address, strategyName, {
            publicKey: phantom.publicKey,
            signTransaction: (tx: any) => phantom.signTransaction(tx),
            signAllTransactions: (txs: any) => phantom.signAllTransactions(txs),
          });
        }
      } catch (err: any) {
        console.warn("NFT minting skipped:", err.message);
      }
    }
```

- [ ] **Step 4: Commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add src/lib/nft/mint.ts src/hooks/useStrategy.ts src/components/builder/Canvas.tsx && git commit -m "Rewrite NFT minting with Metaplex metadata"
```

---

### Task 5: Bulk Encrypted Data Endpoint

**Files:**
- Create: `src/app/api/strategies/encrypted/route.ts`

- [ ] **Step 1: Create the bulk encrypted endpoint**

```typescript
// src/app/api/strategies/encrypted/route.ts
import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import { downloadFromZeroG } from "@/lib/storage/zg-client";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

export async function GET(req: Request) {
  ensureInit();
  const walletAddress = req.headers.get("x-wallet-address");
  if (!walletAddress) {
    return NextResponse.json({ error: "Wallet required" }, { status: 401 });
  }

  const db = getDb();
  const rows = db.prepare(
    "SELECT id, encrypted_data, zg_root_hash FROM strategies WHERE owner_wallet = ?"
  ).all(walletAddress) as any[];

  const strategies: { id: string; encryptedData: string | null }[] = [];

  for (const row of rows) {
    let encryptedData: string | null = row.encrypted_data;

    // Fallback: if DB blob is missing but 0G hash exists, download from 0G
    if (!encryptedData && row.zg_root_hash) {
      try {
        encryptedData = await downloadFromZeroG(row.zg_root_hash);
        // Cache back in DB for next time
        if (encryptedData) {
          db.prepare("UPDATE strategies SET encrypted_data = ? WHERE id = ?")
            .run(encryptedData, row.id);
        }
      } catch {
        // 0G download failed — skip this strategy
      }
    }

    strategies.push({ id: row.id, encryptedData });
  }

  return NextResponse.json({ strategies });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add src/app/api/strategies/encrypted/route.ts && git commit -m "Add bulk encrypted data endpoint with 0G fallback"
```

---

### Task 6: Clear Plaintext After Encryption

**Files:**
- Modify: `src/lib/db/queries.ts`
- Modify: `src/app/api/strategies/[id]/upload-encrypted/route.ts`

- [ ] **Step 1: Add clearPlaintextNodes function to queries.ts**

Add this function after the existing `updateStrategy` function (after line 231 in `src/lib/db/queries.ts`):

```typescript
/** Clear plaintext nodes/connections after encryption is stored */
export function clearPlaintextNodes(id: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE strategies SET nodes = '[]', connections = '[]', updated_at = datetime('now') WHERE id = ?"
  ).run(id);
}
```

- [ ] **Step 2: Update upload-encrypted route to clear plaintext**

In `src/app/api/strategies/[id]/upload-encrypted/route.ts`, add the import and call. Replace the full file:

```typescript
import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy, updateStrategy, clearPlaintextNodes } from "@/lib/db/queries";
import { uploadToZeroG } from "@/lib/storage/zg-client";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

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

  // Clear plaintext nodes/connections — they're now in encrypted_data
  clearPlaintextNodes(id);

  // Upload to 0G Storage (best-effort)
  const zgRootHash = await uploadToZeroG(encryptedData);
  if (zgRootHash) {
    updateStrategy(id, { zgRootHash });
  }

  return NextResponse.json({ ok: true, zgRootHash });
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add src/lib/db/queries.ts src/app/api/strategies/\[id\]/upload-encrypted/route.ts && git commit -m "Clear plaintext nodes from DB after encryption stored"
```

---

### Task 7: Strip Nodes from API Responses

**Files:**
- Modify: `src/app/api/strategies/route.ts`
- Modify: `src/app/api/strategies/[id]/route.ts`

- [ ] **Step 1: Update GET /api/strategies to strip nodes**

Read the current file first to get the exact contents. In `src/app/api/strategies/route.ts`, the GET handler returns strategies with full data. We need to strip nodes/connections from the response. The response should return strategies with `nodes: []` and `connections: []` — the client will get the real logic from the encrypted endpoint.

In the GET handler, after fetching strategies, map them to strip nodes before returning:

Find the line that returns strategies in the GET handler and wrap it. The response should use:

```typescript
// Strip private logic from public responses
const publicStrategies = strategies.map((s: any) => ({
  ...s,
  nodes: [],
  connections: [],
  encryptedData: undefined,
}));
```

Apply this to whatever array of strategies the GET handler returns before calling `NextResponse.json()`.

- [ ] **Step 2: Update GET /api/strategies/[id] to strip nodes for non-owners**

In `src/app/api/strategies/[id]/route.ts`, the GET handler should:
- For the owner: return metadata + `encryptedData` (no plaintext nodes)
- For non-owners: return metadata only (no nodes, no encrypted data)

In the GET handler, after fetching the strategy, before returning:

```typescript
  // Strip plaintext logic — clients use encrypted data
  const response = {
    ...strategy,
    nodes: [],
    connections: [],
  };

  // Only owner gets encrypted data
  const isOwner = strategy.ownerWallet === walletAddress;
  if (!isOwner) {
    response.encryptedData = null;
    response.zgRootHash = null;
  }

  return NextResponse.json(response);
```

- [ ] **Step 3: Commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add src/app/api/strategies/route.ts src/app/api/strategies/\[id\]/route.ts && git commit -m "Strip plaintext nodes from API responses"
```

---

### Task 8: Update Backtest Route to Accept Nodes from Request Body

**Files:**
- Modify: `src/app/api/strategies/[id]/backtest/route.ts`

- [ ] **Step 1: Rewrite the backtest route**

The backtest route currently reads nodes from the DB. Since plaintext nodes are now cleared after encryption, the client must send decrypted nodes in the request body. Replace the entire file:

```typescript
// src/app/api/strategies/[id]/backtest/route.ts
import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy } from "@/lib/db/queries";
import { runBacktest } from "@/lib/engine/backtester";

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

  let body: {
    nodes?: any[];
    connections?: any[];
    ticks?: number;
    startingCapital?: number;
    period?: "1d" | "1w" | "2w" | "1m";
  } = {};
  try {
    body = await req.json();
  } catch {
    // Use defaults
  }

  // Use nodes from request body (client-decrypted), fall back to DB (legacy/migration)
  const strategyWithNodes = {
    ...strategy,
    nodes: body.nodes && body.nodes.length > 0 ? body.nodes : strategy.nodes,
    connections: body.connections && body.connections.length > 0 ? body.connections : strategy.connections,
  };

  if (strategyWithNodes.nodes.length === 0) {
    return NextResponse.json(
      { error: "No strategy nodes provided. Decrypt your strategy and include nodes in the request." },
      { status: 400 },
    );
  }

  try {
    const result = await runBacktest(strategyWithNodes, {
      ticks: body.ticks ?? 60,
      startingCapital: body.startingCapital ?? 1000,
      period: body.period ?? "1w",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `Backtest failed: ${String(error)}` },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add src/app/api/strategies/\[id\]/backtest/route.ts && git commit -m "Accept decrypted nodes in backtest request body"
```

---

### Task 9: Create useStrategyVault Hook

**Files:**
- Create: `src/hooks/useStrategyVault.ts`

- [ ] **Step 1: Create the vault hook**

This hook manages session-level decryption. On wallet connect, it fetches all encrypted strategies, derives the decryption key once, decrypts all blobs, and caches them in state.

```typescript
// src/hooks/useStrategyVault.ts
"use client";

import { useState, useCallback, useRef } from "react";
import type { StrategyNode, StrategyConnection } from "@/types";
import { deriveEncryptionKey, decryptStrategy } from "@/lib/encryption/strategy-cipher";

export interface VaultEntry {
  nodes: StrategyNode[];
  connections: StrategyConnection[];
}

export function useStrategyVault() {
  const [entries, setEntries] = useState<Map<string, VaultEntry>>(new Map());
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const keyRef = useRef<CryptoKey | null>(null);

  /**
   * Unlock the vault: derive key, bulk-fetch encrypted data, decrypt all strategies.
   * Call once after wallet connects.
   */
  const unlock = useCallback(async (
    walletAddress: string,
    signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>,
  ) => {
    if (isUnlocked) return;
    setIsUnlocking(true);

    try {
      // 1. Derive decryption key (one Phantom signature prompt)
      const key = await deriveEncryptionKey(signMessage);
      keyRef.current = key;

      // 2. Bulk-fetch encrypted blobs
      const res = await fetch("/api/strategies/encrypted", {
        headers: { "X-Wallet-Address": walletAddress },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch encrypted strategies");
      }
      const { strategies } = await res.json() as {
        strategies: { id: string; encryptedData: string | null }[];
      };

      // 3. Decrypt each blob
      const map = new Map<string, VaultEntry>();
      for (const { id, encryptedData } of strategies) {
        if (!encryptedData) continue;
        try {
          const decrypted = await decryptStrategy(encryptedData, key);
          map.set(id, {
            nodes: decrypted.nodes,
            connections: decrypted.connections,
          });
        } catch {
          console.warn(`Failed to decrypt strategy ${id}`);
        }
      }

      setEntries(map);
      setIsUnlocked(true);
    } finally {
      setIsUnlocking(false);
    }
  }, [isUnlocked]);

  /**
   * Update a single vault entry (after saving or creating a strategy).
   */
  const put = useCallback((id: string, nodes: StrategyNode[], connections: StrategyConnection[]) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(id, { nodes, connections });
      return next;
    });
  }, []);

  /**
   * Get decrypted logic for a strategy.
   */
  const get = useCallback((id: string): VaultEntry | undefined => {
    return entries.get(id);
  }, [entries]);

  /**
   * Get the session encryption key (for encrypting on save).
   */
  const getKey = useCallback((): CryptoKey | null => {
    return keyRef.current;
  }, []);

  /**
   * Lock the vault (on disconnect).
   */
  const lock = useCallback(() => {
    setEntries(new Map());
    setIsUnlocked(false);
    keyRef.current = null;
  }, []);

  return {
    entries,
    isUnlocking,
    isUnlocked,
    unlock,
    put,
    get,
    getKey,
    lock,
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add src/hooks/useStrategyVault.ts && git commit -m "Add useStrategyVault hook for session-level decrypt cache"
```

---

### Task 10: Integrate Vault into Canvas

**Files:**
- Modify: `src/components/builder/Canvas.tsx`
- Modify: `src/hooks/useStrategy.ts`

- [ ] **Step 1: Update useStrategy.ts save to use encrypted-only flow**

The `save` function currently sends plaintext nodes in the POST/PUT request body AND encrypts separately. The new flow: still send plaintext for initial creation (server needs to create the row), but for updates only send public metadata + encrypted data.

Replace the `save` callback in `src/hooks/useStrategy.ts` (lines 71-147):

```typescript
  const save = useCallback(async (
    name: string,
    nodes: Node[],
    edges: Edge[],
    walletAddress?: string | null,
    signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array }>,
    encryptionKey?: CryptoKey | null,
  ): Promise<string> => {
    setIsSaving(true);
    try {
      const serializedNodes = serializeNodes(nodes);
      const serializedEdges = serializeEdges(edges);

      let strategyId: string;

      if (strategy?.id) {
        // Update existing — only send public metadata, no plaintext nodes
        await fetch(`/api/strategies/${strategy.id}`, {
          method: "PUT",
          headers: authHeaders(walletAddress),
          body: JSON.stringify({ name }),
        });
        strategyId = strategy.id;
      } else {
        // Create new — requires wallet, send plaintext nodes for staging
        if (!walletAddress) {
          throw new Error("Connect your wallet to save a strategy");
        }
        const res = await fetch("/api/strategies", {
          method: "POST",
          headers: authHeaders(walletAddress),
          body: JSON.stringify({
            name,
            nodes: serializedNodes,
            connections: serializedEdges,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save strategy");
        }
        const data = await res.json();
        strategyId = data.id;
        // Load the full strategy metadata after creating
        const fullRes = await fetch(`/api/strategies/${strategyId}`, {
          headers: authHeaders(walletAddress),
        });
        const full = await fullRes.json();
        setStrategy(full);
      }

      // Encrypt and upload (required, not best-effort)
      const key = encryptionKey || (signMessage ? await deriveEncryptionKey(signMessage) : null);
      if (key && walletAddress) {
        const encrypted = await encryptStrategy(
          { nodes: serializedNodes, connections: serializedEdges },
          key
        );
        await fetch(`/api/strategies/${strategyId}/upload-encrypted`, {
          method: "POST",
          headers: authHeaders(walletAddress),
          body: JSON.stringify({ encryptedData: encrypted }),
        });
      }

      return strategyId;
    } finally {
      setIsSaving(false);
    }
  }, [strategy]);
```

- [ ] **Step 2: Add vault import and integration to Canvas.tsx**

In `src/components/builder/Canvas.tsx`, add the vault import alongside the other hook imports:

```typescript
import { useStrategyVault } from "@/hooks/useStrategyVault";
```

Inside `CanvasInner()`, add the vault hook call near the other hooks:

```typescript
  const vault = useStrategyVault();
```

- [ ] **Step 3: Update Canvas handleSave to use vault**

Replace the `handleSave` callback to pass the vault's encryption key and update the vault cache after save:

```typescript
  const handleSave = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) {
      wallet.connect();
      return;
    }

    // Unlock vault if not already (derives encryption key)
    if (!vault.isUnlocked) {
      await vault.unlock(wallet.address, wallet.signMessage);
    }

    const isNew = !strategy?.id;
    const id = await save(strategyName, nodes, edges, wallet.address, wallet.signMessage, vault.getKey());
    window.history.replaceState(null, "", `?id=${id}`);

    // Update vault cache with current nodes
    const serializedNodes = nodes.map((n) => ({
      id: n.id, type: n.type!, category: "data" as const,
      position: n.position, config: n.data?.config ?? {},
    }));
    const serializedEdges = edges.map((e) => ({
      id: e.id, source_id: e.source, source_handle: e.sourceHandle ?? "",
      target_id: e.target, target_handle: e.targetHandle ?? "",
    }));
    vault.put(id, serializedNodes, serializedEdges);

    // Mint NFT for new strategies
    if (isNew && wallet.address) {
      try {
        const phantom = (window as any).phantom?.solana;
        if (phantom) {
          await mintNft(id, wallet.address, strategyName, {
            publicKey: phantom.publicKey,
            signTransaction: (tx: any) => phantom.signTransaction(tx),
            signAllTransactions: (txs: any) => phantom.signAllTransactions(txs),
          });
        }
      } catch (err: any) {
        console.warn("NFT minting skipped:", err.message);
      }
    }
  }, [strategyName, nodes, edges, save, mintNft, wallet, strategy?.id, vault]);
```

- [ ] **Step 4: Update Canvas strategy loading to use vault**

Find the `useEffect` that loads a strategy from the URL `?id=` param. It currently calls `load(id, wallet.address, wallet.signMessage)`. Update it to check the vault first:

The loading effect should:
1. If vault has the entry → use it directly
2. Otherwise → call `load()` which falls back to API + decrypt

Update the loading effect to check vault:

```typescript
  // Inside the effect that loads strategy from ?id= param:
  // After vault is unlocked, check if the strategy is cached
  const vaultEntry = vault.get(strategyId);
  if (vaultEntry) {
    setNodes(deserializeNodes(vaultEntry.nodes));
    setEdges(deserializeEdges(vaultEntry.connections));
    // Still load metadata from server
    const res = await fetch(`/api/strategies/${strategyId}`, {
      headers: { "Content-Type": "application/json", ...(wallet.address ? { "X-Wallet-Address": wallet.address } : {}) },
    });
    if (res.ok) {
      const data = await res.json();
      setStrategyName(data.name);
      setStrategyStatus(data.status);
    }
    return;
  }
  // Otherwise fall through to existing load() call
```

- [ ] **Step 5: Commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add src/hooks/useStrategy.ts src/components/builder/Canvas.tsx && git commit -m "Integrate vault into Canvas save and load flows"
```

---

### Task 11: Pass Decrypted Nodes in Backtest Calls

**Files:**
- Modify: `src/components/builder/Canvas.tsx` (or wherever backtest is triggered)

- [ ] **Step 1: Find and update backtest call**

Search for where the backtest API is called from the client. It likely sends `{ ticks, startingCapital, period }`. Update it to also include `nodes` and `connections` from the current canvas state.

Find all `fetch` calls to the backtest endpoint and update the body to include:

```typescript
body: JSON.stringify({
  nodes: serializeNodes(nodes),     // current canvas nodes
  connections: serializeEdges(edges), // current canvas edges
  ticks: backtestConfig.ticks,
  startingCapital: backtestConfig.startingCapital,
  period: backtestConfig.period,
}),
```

The `serializeNodes` and `serializeEdges` functions are in `useStrategy.ts` — they may need to be exported if not already. `serializeNodes` is currently not exported. Add `export` to both:

In `src/hooks/useStrategy.ts`, change:
```typescript
function serializeNodes(nodes: Node[]): StrategyNode[] {
```
to:
```typescript
export function serializeNodes(nodes: Node[]): StrategyNode[] {
```

And:
```typescript
function serializeEdges(edges: Edge[]): StrategyConnection[] {
```
to:
```typescript
export function serializeEdges(edges: Edge[]): StrategyConnection[] {
```

- [ ] **Step 2: Commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add -A && git commit -m "Pass decrypted nodes in backtest and execution requests"
```

---

### Task 12: Add NEXT_PUBLIC_APP_URL to Environment

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add the app URL environment variable**

The metadata JSON route uses `NEXT_PUBLIC_APP_URL` for building URIs. Add it to `.env.local`:

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

This should be updated to the production URL when deploying.

- [ ] **Step 2: Commit**

No commit needed — `.env.local` is gitignored.

---

### Task 13: Verify End-to-End Flow

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && npm run dev
```

- [ ] **Step 2: Verify metadata endpoint**

If there are existing strategies in the DB, test the metadata route:

```bash
curl http://localhost:3000/api/strategies/<existing-id>/metadata.json | jq .
```

Expected: JSON with `name`, `symbol`, `description`, `image`, `attributes`.

- [ ] **Step 3: Verify OG image endpoint**

```bash
curl -s http://localhost:3000/api/strategies/<existing-id>/og-image | head -5
```

Expected: SVG markup starting with `<svg`.

- [ ] **Step 4: Verify encrypted endpoint**

```bash
curl -H "X-Wallet-Address: <test-wallet>" http://localhost:3000/api/strategies/encrypted | jq .
```

Expected: `{ strategies: [...] }` with encrypted data blobs.

- [ ] **Step 5: Verify no client bundle errors**

Open `http://localhost:3000` in a browser. Check the console for `better-sqlite3` errors. There should be none.

- [ ] **Step 6: Test save flow**

Connect Phantom wallet, create a strategy, save it. Verify:
1. Strategy appears in DB with `encrypted_data` populated
2. `nodes` and `connections` columns are `[]`
3. NFT mint prompt appears from Phantom
4. `nft_mint` stored on the strategy row

- [ ] **Step 7: Final commit**

```bash
cd /Users/loganstaples/hackathons/penn26/oracle && git add -A && git commit -m "NFT metadata, encrypted storage, and load-on-launch — complete"
```
