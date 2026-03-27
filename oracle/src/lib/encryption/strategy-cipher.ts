/**
 * Client-side strategy encryption using AES-256-GCM.
 *
 * The encryption key is derived deterministically from a Phantom wallet
 * signature of a fixed message. Since ed25519 signatures are deterministic,
 * the same wallet always produces the same key — no key storage needed.
 *
 * Only the wallet holder can derive the key and decrypt strategy data.
 */

const ENCRYPTION_MESSAGE = "Edge Strategy Encryption Key v1";

/**
 * Derive an AES-256-GCM key from the wallet's signature.
 * The wallet signs a deterministic message, and we SHA-256 hash the signature
 * to produce a 256-bit key. Same wallet = same key every time.
 */
export async function deriveEncryptionKey(
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>
): Promise<CryptoKey> {
  const message = new TextEncoder().encode(ENCRYPTION_MESSAGE);
  const { signature } = await signMessage(message);

  // SHA-256 the ed25519 signature → 32 bytes → AES-256 key
  const keyMaterial = await crypto.subtle.digest("SHA-256", signature);

  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt strategy nodes + connections with AES-256-GCM.
 * Returns a base64 string containing: 12-byte IV + ciphertext + auth tag.
 */
export async function encryptStrategy(
  data: { nodes: any[]; connections: any[] },
  key: CryptoKey
): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  // Pack: iv (12 bytes) + ciphertext (includes GCM auth tag)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt strategy data from a base64 AES-256-GCM blob.
 * Returns the original { nodes, connections } object.
 */
export async function decryptStrategy(
  encryptedBase64: string,
  key: CryptoKey
): Promise<{ nodes: any[]; connections: any[] }> {
  const combined = Uint8Array.from(atob(encryptedBase64), (c) =>
    c.charCodeAt(0)
  );
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(plaintext));
}
