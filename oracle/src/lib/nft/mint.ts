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
  walletAdapter: {
    publicKey: { toBytes(): Uint8Array };
    signTransaction: <T>(tx: T) => Promise<T>;
    signAllTransactions?: <T>(txs: T[]) => Promise<T[]>;
  },
): Promise<MintResult> {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const metadataUri = `${origin}/api/strategies/${strategyId}/metadata.json`;

  const umi = createUmi(RPC_URL).use(mplTokenMetadata());
  umi.use(walletAdapterIdentity(walletAdapter));

  const mint = generateSigner(umi);

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

  const sigStr = typeof signature === "string"
    ? signature
    : Buffer.from(signature).toString("base64");

  return {
    mintAddress: mint.publicKey.toString(),
    signature: sigStr,
  };
}
