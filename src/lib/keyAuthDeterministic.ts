"use client";

/**
 * Deterministic Key Authentication
 *
 * Works even if ALL site data is cleared!
 * Key verification is based on email + key → derives everything
 */

/**
 * Derive user identifier from key and email
 * This is deterministic - same key + email always gives same userId
 */
export async function deriveUserIdFromKeyAndEmail(
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

  // Return full hash as userId (or first 32 chars)
  return hashHex;
}

/**
 * Verify key using email (which user knows, even if data is cleared)
 *
 * Flow:
 * 1. User provides key + email
 * 2. System derives userId from key + email
 * 3. System looks up user by email (from CouchDB or user provides)
 * 4. System compares derived userId with stored userId
 * 5. If match, key is correct!
 */
export async function verifyKeyWithEmail(
  providedKey: string,
  email: string,
  shopId: string,
  storedUserId: string // From user document (or CouchDB if local cleared)
): Promise<boolean> {
  // Derive userId from provided key + email
  const derivedUserId = await deriveUserIdFromKeyAndEmail(
    providedKey,
    shopId,
    email
  );

  // If they match, key is correct!
  return derivedUserId === storedUserId;
}

/**
 * Alternative: Key generates a signature that can be verified against email
 * Email is something user knows, so even if data is cleared, they can provide it
 */
export async function verifyKeyByEmailSignature(
  providedKey: string,
  email: string,
  shopId: string,
  storedSignature: string // Could be stored in CouchDB or user remembers it
): Promise<boolean> {
  // Generate signature from key + email
  const input = `${providedKey}:${shopId}:${email.toLowerCase()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signature === storedSignature;
}

/**
 * Best approach: Key + Email → User ID
 *
 * During registration:
 * - User provides key + email
 * - System derives userId = Hash(key + shopId + email)
 * - userId IS the verification - if key is wrong, userId won't match
 *
 * During login (even if data cleared):
 * - User provides key + email
 * - System derives userId = Hash(key + shopId + email)
 * - System looks up user by email (from CouchDB or user provides shopId)
 * - If derived userId === stored userId, key is correct!
 */
export async function authenticateWithKeyAndEmail(
  providedKey: string,
  email: string,
  shopId: string
): Promise<{
  valid: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    // Derive userId from key + email
    const derivedUserId = await deriveUserIdFromKeyAndEmail(
      providedKey,
      shopId,
      email
    );

    // Now we need to verify this userId exists
    // Option 1: Look up user by email (from CouchDB if local cleared)
    // Option 2: User provides userId and we compare

    // For now, return the derived userId
    // Caller can look up user by email and compare userIds
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
 * Verify key by comparing derived userId with stored userId
 * Works even if all local data is cleared - just need email from user
 */
export async function verifyKeyDeterministic(
  providedKey: string,
  email: string,
  shopId: string,
  storedUserId: string // From CouchDB or user provides
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  // Derive userId from key
  const derivedUserId = await deriveUserIdFromKeyAndEmail(
    providedKey,
    shopId,
    email
  );

  // Compare
  if (derivedUserId !== storedUserId) {
    return {
      valid: false,
      error: "Invalid key",
    };
  }

  return {
    valid: true,
    userId: derivedUserId,
  };
}

/**
 * Generate recovery code from key
 * User can write this down - it's deterministic from key
 */
export async function generateRecoveryCodeFromKey(
  masterKey: string,
  email: string,
  shopId: string
): Promise<string> {
  // Derive recovery code
  const input = `recovery:${masterKey}:${shopId}:${email.toLowerCase()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Format as readable code
  const formatted = [
    hex.substring(0, 4),
    hex.substring(4, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
  ]
    .join("-")
    .toUpperCase();

  return formatted;
}

/**
 * Verify recovery code
 */
export async function verifyRecoveryCode(
  providedKey: string,
  email: string,
  shopId: string,
  storedRecoveryCode: string
): Promise<boolean> {
  const generatedCode = await generateRecoveryCodeFromKey(
    providedKey,
    email,
    shopId
  );
  return generatedCode === storedRecoveryCode;
}

/**
 * Complete authentication flow that works even if data is cleared
 */
export async function authenticateKeyAfterDataClear(
  providedKey: string,
  email: string,
  shopId: string,
  getUserByEmail: (email: string) => Promise<{ userId: string } | null>
): Promise<{
  valid: boolean;
  user?: { userId: string; shopId: string; [key: string]: unknown };
  error?: string;
}> {
  // 1. Derive userId from key + email
  const derivedUserId = await deriveUserIdFromKeyAndEmail(
    providedKey,
    shopId,
    email
  );

  // 2. Look up user by email (from CouchDB if local cleared)
  const user = await getUserByEmail(email);

  if (!user) {
    return {
      valid: false,
      error: "User not found",
    };
  }

  // 3. Compare derived userId with stored userId
  if (derivedUserId !== user.userId) {
    return {
      valid: false,
      error: "Invalid key",
    };
  }

  // 4. Key is valid!
  return {
    valid: true,
    user: {
      ...user,
      userId: derivedUserId,
      shopId: shopId,
    },
  };
}

/**
 * Validate key strength
 */
export function validateKeyStrength(key: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (key.length < 8) {
    errors.push("Key must be at least 8 characters");
  }

  if (key.length > 128) {
    errors.push("Key must be less than 128 characters");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
