# NFT Metadata + Strategy Encryption + Load-on-Launch

**Date:** 2026-03-28
**Status:** Approved

## Problem

1. Strategy NFTs are bare SPL tokens with no metadata — invisible in wallets/explorers
2. Strategy logic (nodes/connections) stored in plaintext in SQLite alongside encrypted copy
3. No bulk-load flow — app doesn't fetch and decrypt strategies on wallet connect
4. 0G Storage upload works but download is never called (dead code)
5. `better-sqlite3` leaks into client bundle via transitive imports

## Design

### 1. Data Model — Public vs Private

**Public (DB, readable by anyone):**
- `id`, `name`, `description`, `author_name`, `owner_wallet`
- `nft_mint`, `zg_root_hash`
- `status`, `is_public`, timestamps
- Performance stats (via `strategy_performance` table)

**Private (encrypted, 0G + DB `encrypted_data` column):**
- `nodes` and `connections` (the actual strategy logic)

**Transition:** After encryption succeeds, plaintext `nodes` and `connections` columns are set to `"[]"` (empty arrays). They exist only as a transient staging area during initial creation (the server needs the strategy ID before the client can encrypt and upload). Once `encrypted_data` is confirmed stored, plaintext is cleared in the same request.

### 2. NFT Minting with Metaplex Metadata

Replace raw SPL token minting with Metaplex `mpl-token-metadata` + `umi`.

**New dependencies:**
- `@metaplex-foundation/umi`
- `@metaplex-foundation/umi-bundle-defaults`
- `@metaplex-foundation/mpl-token-metadata`
- `@metaplex-foundation/umi-web3js-adapters` (to bridge Phantom's web3.js signer)

**On-chain metadata:**
- Name: strategy name (truncated to 32 chars)
- Symbol: `"EDGE"`
- URI: `{APP_ORIGIN}/api/strategies/{id}/metadata.json`
- Creators: `[{ address: ownerWallet, share: 100 }]`

**Off-chain metadata JSON** (served by `/api/strategies/[id]/metadata.json` route):
```json
{
  "name": "Strategy Name",
  "symbol": "EDGE",
  "description": "Strategy description",
  "image": "{APP_ORIGIN}/api/strategies/{id}/og-image",
  "external_url": "{APP_ORIGIN}/?id={id}",
  "attributes": [
    { "trait_type": "Author", "value": "wallet_address_truncated" },
    { "trait_type": "Status", "value": "draft" },
    { "trait_type": "Created", "value": "2026-03-28" },
    { "trait_type": "0G Root Hash", "value": "0xabc..." }
  ],
  "properties": {
    "category": "strategy",
    "files": []
  }
}
```

**Image route** (`/api/strategies/[id]/og-image`): Returns a simple generated SVG with the strategy name, status, and EDGE branding. No external dependencies.

**Mint flow (replaces current `mint.ts`):**
1. Create Umi instance with Solana devnet RPC
2. Register Phantom wallet as Umi signer (via `umi-web3js-adapters`)
3. Generate new mint keypair
4. Call `createNft()` from `mpl-token-metadata` with name, symbol, URI, creators
5. Phantom prompts user to approve the transaction
6. Return `{ mintAddress, signature }`

This is a single transaction from the user's perspective — same UX as before.

### 3. Save Flow

#### New strategy (create):

```
Client                                  Server
  |                                       |
  |-- POST /api/strategies -------------->|  Create row with plaintext nodes (staging)
  |<-- { id } ----------------------------|
  |                                       |
  |-- deriveEncryptionKey(signMessage) --->|  (client-side, Phantom signature)
  |-- encryptStrategy(nodes, conns, key) ->|  (client-side, AES-256-GCM)
  |                                       |
  |-- POST /api/strategies/:id/upload ---->|  Store encrypted_data in DB
  |                                       |  Upload to 0G (best-effort)
  |                                       |  Null out plaintext nodes/connections
  |<-- { ok, zgRootHash } ----------------|
  |                                       |
  |-- mintNft(id, wallet) --------------->|  Metaplex NFT mint via Phantom
  |-- PUT /api/strategies/:id ----------->|  Store nft_mint
  |<-- done -------------------------------|
```

#### Update existing strategy:

```
Client                                  Server
  |                                       |
  |-- PUT /api/strategies/:id ----------->|  Update public metadata (name, desc, status)
  |                                       |  (no plaintext nodes sent)
  |                                       |
  |-- encryptStrategy(nodes, conns, key) ->|  (client-side)
  |-- POST /api/strategies/:id/upload ---->|  Replace encrypted_data
  |                                       |  Re-upload to 0G
  |<-- { ok, zgRootHash } ----------------|
```

No re-mint on update. The metadata URI is dynamic — it always serves current DB state.

#### Running / backtesting:

Execution and backtest API routes change from reading nodes from DB to receiving them in the request body:

```
Client                                  Server
  |                                       |
  |-- POST /api/strategies/:id/backtest ->|  Request body includes:
  |   { nodes, connections, ticks, ... }  |    - decrypted nodes + connections
  |                                       |    - backtest config
  |                                       |  Server validates ownership
  |                                       |  Uses nodes ephemerally, never persists
  |<-- { results } -----------------------|
```

Same pattern for the execution runner — it receives decrypted nodes from the client.

### 4. Load-All-on-Launch Flow

When a user connects their wallet:

```
1. GET /api/strategies?owner=<wallet>
   → Returns list of strategies with public metadata only:
     { id, name, description, status, nftMint, zgRootHash, createdAt, performance }
   → No nodes or connections in the response

2. User signs deterministic message ("Edge Strategy Encryption Key v1")
   → Derive AES-256-GCM key (one-time per session)

3. GET /api/strategies/encrypted?owner=<wallet>
   → Returns { strategies: [{ id, encryptedData }, ...] }
   → Server returns encrypted_data from DB
   → If encrypted_data is null but zg_root_hash exists: download from 0G, cache in DB, return

4. Client decrypts each blob with session key
   → Store decrypted { nodes, connections } in React context keyed by strategy ID

5. Strategies available in memory for the session
   → No re-fetching until refresh or wallet change
```

**New hook: `useStrategyVault`**
- Manages the session-level decryption key and decrypted strategy cache
- Exposes: `vault.strategies` (Map of id → decrypted nodes/connections), `vault.isLoading`, `vault.unlock()` (triggers the sign + decrypt flow)
- Consumed by Canvas, Dashboard, and any component that needs strategy logic
- The existing `useStrategy` hook for single-strategy operations continues to work but reads from the vault instead of fetching nodes from the server

### 5. 0G Storage — Complete the Circuit

**Current state:** Upload works, download is dead code.

**Fix:**
- Primary storage: `encrypted_data` column in SQLite (fast, always available)
- 0G is decentralized backup via `zg_root_hash`
- The bulk-fetch endpoint (`GET /api/strategies/encrypted`) tries DB first. If `encrypted_data` is null but `zg_root_hash` exists, call `downloadFromZeroG(rootHash)`, cache result back in DB, return it.
- No change to upload — stays best-effort. If 0G is down, `encrypted_data` is in DB.

### 6. Client/Server Boundary

**Rule:** No client component ever imports from `lib/db/`, `lib/engine/`, or any module that touches `better-sqlite3`.

**Already fixed:** `PaymentModal.tsx` and `Canvas.tsx` now import pricing constants from `lib/payments/constants.ts` instead of `lib/payments/streams.ts`.

**Additional fixes:**
- Execution/backtest routes read nodes from request body, not DB — they no longer need to import full strategy data
- All `better-sqlite3` / `getDb()` usage stays strictly in `app/api/` routes and server-side engine code
- Verify no other client component has a transitive path to `better-sqlite3`

## Files to Create

- `src/lib/nft/mint.ts` — rewrite: Metaplex NFT minting with metadata
- `src/hooks/useStrategyVault.ts` — new: session-level decrypt cache
- `src/app/api/strategies/[id]/metadata.json/route.ts` — new: Metaplex metadata JSON endpoint
- `src/app/api/strategies/[id]/og-image/route.ts` — new: generated SVG image for NFT
- `src/app/api/strategies/encrypted/route.ts` — new: bulk fetch encrypted data

## Files to Modify

- `src/lib/db/schema.ts` — no schema changes needed (columns already exist)
- `src/lib/db/queries.ts` — add `clearPlaintextNodes()`, modify `getStrategiesByOwner()` to exclude nodes/connections
- `src/app/api/strategies/route.ts` — strip nodes/connections from GET responses for owner queries
- `src/app/api/strategies/[id]/route.ts` — strip nodes from GET, accept nodes in PUT only for staging
- `src/app/api/strategies/[id]/upload-encrypted/route.ts` — add plaintext clearing after encryption stored
- `src/app/api/strategies/[id]/backtest/route.ts` — accept nodes from request body
- `src/hooks/useStrategy.ts` — integrate with vault, change save flow
- `src/components/builder/Canvas.tsx` — use vault for loading, pass nodes in execution requests
- `src/lib/storage/zg-client.ts` — no changes (download already implemented)
- `package.json` — add Metaplex dependencies

## Out of Scope

- Marketplace transfer re-encryption (future feature)
- IPFS/Arweave for metadata JSON (API route is sufficient)
- On-chain RWA performance tokenization
- Custom Solana programs
