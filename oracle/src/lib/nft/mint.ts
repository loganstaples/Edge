/**
 * Strategy NFT minting on Solana.
 *
 * Each strategy is represented by a unique SPL Token (supply=1, decimals=0).
 * The token is minted to the creator's wallet, and mint authority is revoked
 * so no more can ever be created — making it a true NFT.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

function getConnection(): Connection {
  const rpc =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL || ""
      : "";
  const endpoint = rpc || clusterApiUrl("devnet");
  return new Connection(endpoint, "confirmed");
}

export interface MintResult {
  mintAddress: string;
  signature: string;
}

/**
 * Build, sign, and send a transaction that mints a 1-of-1 Strategy NFT.
 *
 * @param ownerAddress - The wallet address that will own the NFT
 * @param signAndSendTransaction - Phantom's signAndSendTransaction method
 * @returns The mint public key (NFT address) and transaction signature
 */
export async function mintStrategyNft(
  ownerAddress: string,
  signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string }>
): Promise<MintResult> {
  const connection = getConnection();
  const owner = new PublicKey(ownerAddress);
  const mintKeypair = Keypair.generate();

  // Rent-exempt minimum for mint account
  const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

  // Associated token account for the owner
  const ata = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction().add(
    // 1. Create the mint account
    SystemProgram.createAccount({
      fromPubkey: owner,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),

    // 2. Initialize mint: 0 decimals = NFT, owner is mint authority
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      0, // decimals
      owner, // mint authority
      null // no freeze authority
    ),

    // 3. Create associated token account for the owner
    createAssociatedTokenAccountInstruction(
      owner, // payer
      ata, // ATA address
      owner, // owner
      mintKeypair.publicKey // mint
    ),

    // 4. Mint exactly 1 token (the NFT)
    createMintToInstruction(
      mintKeypair.publicKey, // mint
      ata, // destination
      owner, // authority
      1 // amount
    ),

    // 5. Revoke mint authority — no more tokens can ever be minted
    createSetAuthorityInstruction(
      mintKeypair.publicKey, // mint account
      owner, // current authority
      AuthorityType.MintTokens, // authority type
      null // new authority (null = revoked)
    )
  );

  // Set transaction metadata
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = owner;

  // Mint keypair must sign (required by SystemProgram.createAccount)
  transaction.partialSign(mintKeypair);

  // Phantom signs for the owner and sends
  const { signature } = await signAndSendTransaction(transaction);

  // Wait for confirmation
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return {
    mintAddress: mintKeypair.publicKey.toBase58(),
    signature,
  };
}
