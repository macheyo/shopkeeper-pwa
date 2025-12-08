"use client";

/**
 * Zero-Lookup Key Authentication
 *
 * NO database lookups - pure mathematical verification!
 * User provides: Key + Email + ShopID + UserID
 * System verifies: Does key generate the provided UserID?
 */

/**
 * Derive user ID from key (deterministic)
 */
export async function deriveUserIdFromKey(
  masterKey: string,
  shopId: string,
  email: string
): Promise<string> {
  const input = `${masterKey}:${shopId}:${email.toLowerCase()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

/**
 * Verify key with ZERO lookups
 * User provides everything - system just verifies mathematically
 */
export async function verifyKeyZeroLookup(
  providedKey: string,
  email: string,
  shopId: string,
  providedUserId: string // User provides this (they remember it or it's in URL/session)
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  try {
    // Derive userId from provided key
    const derivedUserId = await deriveUserIdFromKey(providedKey, shopId, email);

    // Compare - pure math, no lookup!
    if (derivedUserId !== providedUserId) {
      return {
        valid: false,
        error: "Invalid key - derived user ID does not match",
      };
    }

    // Key is valid!
    return {
      valid: true,
      userId: derivedUserId,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Generate a user identifier that can be embedded in URL or remembered
 * This is deterministic from key + email + shopId
 */
export async function generateUserIdentifier(
  masterKey: string,
  email: string,
  shopId: string
): Promise<{
  userId: string;
  shortId: string; // First 8 chars for easy remembering
  recoveryCode: string;
}> {
  const userId = await deriveUserIdFromKey(masterKey, shopId, email);
  const shortId = userId.substring(0, 8);

  // Generate recovery code
  const recoveryInput = `recovery:${masterKey}:${shopId}:${email.toLowerCase()}`;
  const encoder = new TextEncoder();
  const recoveryData = encoder.encode(recoveryInput);
  const recoveryHash = await crypto.subtle.digest("SHA-256", recoveryData);
  const recoveryArray = Array.from(new Uint8Array(recoveryHash));
  const recoveryHex = recoveryArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const recoveryCode = [
    recoveryHex.substring(0, 4),
    recoveryHex.substring(4, 8),
    recoveryHex.substring(8, 12),
    recoveryHex.substring(12, 16),
  ]
    .join("-")
    .toUpperCase();

  return {
    userId,
    shortId,
    recoveryCode,
  };
}

/**
 * Verify key using short ID (easier for users to remember)
 */
export async function verifyKeyWithShortId(
  providedKey: string,
  email: string,
  shopId: string,
  providedShortId: string // First 8 chars of userId
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const derivedUserId = await deriveUserIdFromKey(providedKey, shopId, email);
  const derivedShortId = derivedUserId.substring(0, 8);

  if (derivedShortId !== providedShortId) {
    return {
      valid: false,
      error: "Invalid key - short ID does not match",
    };
  }

  return {
    valid: true,
    userId: derivedUserId,
  };
}

/**
 * Complete authentication with ZERO lookups
 * User provides everything - system just verifies
 */
export async function authenticateKeyZeroLookup(
  providedKey: string,
  email: string,
  shopId: string,
  providedUserId: string
): Promise<{
  valid: boolean;
  user?: {
    userId: string;
    email: string;
    shopId: string;
  };
  error?: string;
}> {
  const result = await verifyKeyZeroLookup(
    providedKey,
    email,
    shopId,
    providedUserId
  );

  if (!result.valid) {
    return {
      valid: false,
      error: result.error,
    };
  }

  // Key is valid - create user object from provided data
  // NO lookup needed - we trust the key derivation!
  return {
    valid: true,
    user: {
      userId: result.userId!,
      email: email.toLowerCase(),
      shopId,
    },
  };
}

/**
 * Alternative: Key generates a signature that can be verified
 * User provides signature (from registration) and we verify key generates same signature
 */
export async function verifyKeyBySignature(
  providedKey: string,
  email: string,
  shopId: string,
  providedSignature: string // User provides this (from registration)
): Promise<boolean> {
  // Generate signature from key
  const input = `signature:${providedKey}:${shopId}:${email.toLowerCase()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signature === providedSignature;
}

/**
 * Generate signature during registration
 * User writes this down - it's their "proof" of key correctness
 */
export async function generateKeySignature(
  masterKey: string,
  email: string,
  shopId: string
): Promise<string> {
  const input = `signature:${masterKey}:${shopId}:${email.toLowerCase()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Best approach: Key + Email + ShopID → UserID
 * User remembers UserID (or it's in URL/bookmark)
 * System verifies: Does key generate this UserID?
 *
 * NO LOOKUP - pure math!
 */
export async function verifyKeyPureMath(
  key: string,
  email: string,
  shopId: string,
  expectedUserId: string // User provides this
): Promise<boolean> {
  const derivedUserId = await deriveUserIdFromKey(key, shopId, email);
  return derivedUserId === expectedUserId;
}




