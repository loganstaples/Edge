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
  _ownerAddress: string,
  strategyName: string,
  description: string,
  walletAdapter: {
    publicKey: { toBytes(): Uint8Array };
    signTransaction: <T>(tx: T) => Promise<T>;
    signAllTransactions?: <T>(txs: T[]) => Promise<T[]>;
  },
): Promise<MintResult> {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  // Point to the metadata.json API endpoint — Metaplex limits the on-chain
  // URI field to 200 bytes, so a data-URI approach won't fit.
  const metadataUri = `${origin}/api/strategies/${strategyId}/metadata.json`;

  const umi = createUmi(RPC_URL).use(mplTokenMetadata());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  umi.use(walletAdapterIdentity(walletAdapter as any));

  const mint = generateSigner(umi);

  const { signature } = await createNft(umi, {
    mint,
    name: strategyName.slice(0, 32),
    symbol: `E-${strategyId.slice(0, 8)}`,
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0),
    isCollection: false,
    creators: [
      {
        address: umi.identity.publicKey,
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
