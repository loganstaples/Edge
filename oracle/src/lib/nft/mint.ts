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
 */
export async function mintStrategyNft(
  strategyId: string,
  ownerAddress: string,
  strategyName: string,
  description: string,
  walletAdapter: {
    publicKey: { toBytes(): Uint8Array };
    signTransaction: <T>(tx: T) => Promise<T>;
    signAllTransactions?: <T>(txs: T[]) => Promise<T[]>;
  },
): Promise<MintResult> {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  // Build off-chain metadata JSON and encode as data URI so Phantom can
  // always read it (even on localhost / devnet with no public server).
  const metadataJson = {
    name: strategyName.slice(0, 32),
    symbol: "EDGE",
    description: description || `Trading strategy built on EDGE`,
    image: `${origin}/api/strategies/${strategyId}/og-image`,
    external_url: `${origin}/?id=${strategyId}`,
    attributes: [
      { trait_type: "Strategy ID", value: strategyId },
      { trait_type: "Platform", value: "EDGE" },
    ],
    properties: {
      category: "strategy",
      files: [],
    },
  };
  const metadataUri = `data:application/json;base64,${btoa(JSON.stringify(metadataJson))}`;

  const umi = createUmi(RPC_URL).use(mplTokenMetadata());
  umi.use(walletAdapterIdentity(walletAdapter));

  const mint = generateSigner(umi);

  // Each strategy is a standalone NFT, not part of a collection.
  // Use a unique symbol per mint to prevent Phantom from auto-grouping.
  const uniqueSymbol = `EDGE`;

  const { signature } = await createNft(umi, {
    mint,
    name: strategyName.slice(0, 32),
    symbol: uniqueSymbol,
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0),
    isCollection: false,
    creators: [
      {
        address: umiPublicKey(ownerAddress),
        verified: true,
        share: 100,
      },
    ],
  }).sendAndConfirm(umi);

  const sigStr = typeof signature === "string"
    ? signature
    : Buffer.from(signature).toString("base64");

  return {
    mintAddress: mint.publicKey.toString(),
    signature: sigStr,
  };
}
