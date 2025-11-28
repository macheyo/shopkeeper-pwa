"use client";

/**
 * Zero-Storage Key Authentication
 *
 * The key IS the verification - no hash storage needed!
 * We derive the user identifier from the key itself.
 */

/**
 * Derive user identifier from master key
 * This makes the key self-verifying - if key is correct, it generates the correct userId
 */
export async function deriveUserIdFromKey(
  masterKey: string,
  shopId: string,
  email: string
): Promise<string> {
  // Combine: key + shopId + email (email ensures uniqueness)
  const input = `${masterKey}:${shopId}:${email}`;

  // Hash to get deterministic user ID
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Return first 32 characters as user ID
  return hashHex.substring(0, 32);
}

/**
 * Verify key by regenerating user ID
 * If the key is correct, it will generate the same userId
 */
export async function verifyKeyByUserId(
  providedKey: string,
  shopId: string,
  email: string,
  expectedUserId: string
): Promise<boolean> {
  // Derive userId from provided key
  const derivedUserId = await deriveUserIdFromKey(providedKey, shopId, email);

  // If they match, key is correct!
  return derivedUserId === expectedUserId;
}

/**
 * Alternative: Use key to decrypt user email (which is already stored)
 * If decryption succeeds, key is correct
 */
export async function verifyKeyByDecryption(
  providedKey: string,
  userId: string,
  shopId: string,
  encryptedEmail: string // Email encrypted with derived key
): Promise<{ valid: boolean; email?: string }> {
  try {
    // Derive encryption key from provided key
    const encryptionKey = await deriveEncryptionKey(
      providedKey,
      userId,
      shopId
    );

    // Try to decrypt email
    const email = await decryptEmail(encryptionKey, encryptedEmail);

    // If decryption succeeds, key is correct
    return {
      valid: true,
      email,
    };
  } catch {
    // Decryption failed = wrong key
    return {
      valid: false,
    };
  }
}

/**
 * Derive encryption key from master key
 */
async function deriveEncryptionKey(
  masterKey: string,
  userId: string,
  shopId: string
): Promise<CryptoKey> {
  // Derive key using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${masterKey}:${userId}:${shopId}`),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(`${userId}:${shopId}`),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );

  return derivedKey;
}

/**
 * Encrypt email with derived key
 */
export async function encryptEmail(
  masterKey: string,
  userId: string,
  shopId: string,
  email: string
): Promise<string> {
  const key = await deriveEncryptionKey(masterKey, userId, shopId);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    new TextEncoder().encode(email)
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt email with derived key
 */
async function decryptEmail(
  key: CryptoKey,
  encryptedData: string
): Promise<string> {
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Best approach: Key generates signature that matches stored signature
 * The signature is stored in the user document (which we already have)
 */
export async function verifyKeyBySignature(
  providedKey: string,
  userId: string,
  shopId: string,
  email: string,
  storedSignature: string // Stored in user document
): Promise<boolean> {
  // Generate signature from key
  const input = `${providedKey}:${userId}:${shopId}:${email}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Compare with stored signature
  return signature === storedSignature;
}

/**
 * Generate signature for storage (done once during registration)
 */
export async function generateKeySignature(
  masterKey: string,
  userId: string,
  shopId: string,
  email: string
): Promise<string> {
  const input = `${masterKey}:${userId}:${shopId}:${email}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Recommended: Verify key using signature stored in user document
 * This uses data we already have (user document), no extra storage needed!
 */
export async function authenticateWithKeyZeroStorage(
  providedKey: string,
  user: { userId: string; shopId: string; email: string; keySignature?: string }
): Promise<{ valid: boolean; error?: string }> {
  // If user document has keySignature, use that
  if (user.keySignature) {
    const isValid = await verifyKeyBySignature(
      providedKey,
      user.userId,
      user.shopId,
      user.email,
      user.keySignature
    );

    return {
      valid: isValid,
      error: isValid ? undefined : "Invalid key",
    };
  }

  // Fallback: Try userId derivation method
  // This works if userId was derived from key during registration
  const derivedUserId = await deriveUserIdFromKey(
    providedKey,
    user.shopId,
    user.email
  );

  // Check if derived userId matches (or is embedded in) actual userId
  // This works if userId format is: "key_{derivedUserId}" or similar
  const isValid =
    user.userId.includes(derivedUserId) ||
    user.userId === derivedUserId ||
    derivedUserId.startsWith(user.userId.substring(0, 8)); // Partial match

  return {
    valid: isValid,
    error: isValid ? undefined : "Invalid key",
  };
}


