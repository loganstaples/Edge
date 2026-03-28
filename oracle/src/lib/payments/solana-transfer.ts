"use client";

import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// USDC mint on devnet (matches useWallet.tsx)
const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

// Platform treasury wallet (hackathon demo placeholder)
export const PLATFORM_WALLET = new PublicKey(
  "EZioBQRFm8k6eqKNrqMHrXkVYZHvHLq1K9qfvtjxbGBt"
);

/** USDC uses 6 decimal places */
const USDC_DECIMALS = 6;

function getDevnetConnection(): Connection {
  const rpc =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet")
      : clusterApiUrl("devnet");
  return new Connection(rpc, "confirmed");
}

/**
 * Build a Solana transaction that transfers USDC from the user's
 * associated token account to the platform's associated token account.
 *
 * If the platform ATA does not exist yet the transaction will include
 * an instruction to create it (funded by the sender).
 */
export async function createUsdcTransferTransaction(
  fromWalletAddress: string,
  amountUsdc: number
): Promise<Transaction> {
  const connection = getDevnetConnection();
  const sender = new PublicKey(fromWalletAddress);

  // Derive ATAs
  const senderAta = await getAssociatedTokenAddress(USDC_MINT_DEVNET, sender);
  const platformAta = await getAssociatedTokenAddress(
    USDC_MINT_DEVNET,
    PLATFORM_WALLET
  );

  const transaction = new Transaction();

  // Check whether the platform ATA already exists; create it if not.
  try {
    await getAccount(connection, platformAta);
  } catch {
    // Account doesn't exist — add an instruction to create it.
    // The sender pays the rent-exempt minimum (~0.002 SOL on devnet).
    transaction.add(
      createAssociatedTokenAccountInstruction(
        sender, // payer
        platformAta, // ATA to create
        PLATFORM_WALLET, // owner of the new ATA
        USDC_MINT_DEVNET, // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // Raw amount: USDC has 6 decimals
  const rawAmount = Math.round(amountUsdc * 10 ** USDC_DECIMALS);

  transaction.add(
    createTransferInstruction(
      senderAta, // source
      platformAta, // destination
      sender, // owner / authority
      rawAmount, // amount in smallest unit
      [], // multi-signers (none)
      TOKEN_PROGRAM_ID
    )
  );

  // Set recent blockhash & fee payer so Phantom can sign immediately
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = sender;

  return transaction;
}

/**
 * End-to-end helper: build the USDC transfer transaction and submit it
 * via the wallet's `signAndSendTransaction`.
 *
 * Returns the on-chain signature and the amount transferred.
 * Errors are caught and logged — payments should never block execution.
 */
export async function sendUsdcPayment(
  signAndSendTransaction: (tx: any) => Promise<{ signature: string }>,
  fromWalletAddress: string,
  amountUsdc: number
): Promise<{ signature: string; amountUsdc: number }> {
  try {
    const transaction = await createUsdcTransferTransaction(
      fromWalletAddress,
      amountUsdc
    );
    const { signature } = await signAndSendTransaction(transaction);
    return { signature, amountUsdc };
  } catch (err) {
    console.error("[solana-transfer] USDC payment failed:", err);
    return { signature: "", amountUsdc };
  }
}
