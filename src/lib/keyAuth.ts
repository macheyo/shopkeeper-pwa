"use client";

import { UserDoc } from "@/types";

/**
 * Key-based authentication using deterministic key derivation
 * Works completely offline - no database lookup needed
 */

/**
 * Derive a deterministic key from master key + user identifier
 * This allows mathematical verification without database lookup
 */
export async function deriveUserKey(
  masterKey: string,
  userId: string,
  shopId: string
): Promise<string> {
  // Combine inputs
  const input = `${masterKey}:${userId}:${shopId}`;

  // Use Web Crypto API for deterministic hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  // Hash using SHA-256 (deterministic)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert to base64 for storage/comparison
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Return first 32 characters (128 bits) for key
  return hashHex.substring(0, 32);
}

/**
 * Derive key with additional salt/iterations for stronger security
 */
export async function deriveUserKeyPBKDF2(
  masterKey: string,
  userId: string,
  shopId: string,
  salt?: string
): Promise<{ key: string; salt: string }> {
  // Generate or use provided salt
  const userSalt = salt || (await generateSalt());

  // Import master key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterKey),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(`${userSalt}:${userId}:${shopId}`),
      iterations: 100000, // High iteration count for security
      hash: "SHA-256",
    },
    keyMaterial,
    256 // 256 bits = 32 bytes
  );

  // Convert to hex string
  const keyArray = Array.from(new Uint8Array(derivedBits));
  const keyHex = keyArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return {
    key: keyHex,
    salt: userSalt,
  };
}

/**
 * Generate a random salt
 */
async function generateSalt(): Promise<string> {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify a key mathematically (no database lookup)
 */
export async function verifyKey(
  providedKey: string,
  userId: string,
  shopId: string,
  storedKeyHash: string
): Promise<boolean> {
  // Derive expected key from provided master key
  const derivedKey = await deriveUserKey(providedKey, userId, shopId);

  // Compare with stored hash
  return derivedKey === storedKeyHash;
}

/**
 * Verify key with PBKDF2 (more secure)
 */
export async function verifyKeyPBKDF2(
  providedKey: string,
  userId: string,
  shopId: string,
  storedKeyHash: string,
  salt: string
): Promise<boolean> {
  // Derive key using same parameters
  const { key } = await deriveUserKeyPBKDF2(providedKey, userId, shopId, salt);

  // Compare
  return key === storedKeyHash;
}

/**
 * Register a key for a user (store derived key hash)
 * This is done once during registration/setup
 */
export async function registerUserKey(
  userId: string,
  shopId: string,
  masterKey: string
): Promise<{ keyHash: string; salt?: string }> {
  // Use PBKDF2 for stronger security
  const { key, salt } = await deriveUserKeyPBKDF2(masterKey, userId, shopId);

  // Store key hash (not the master key!)
  // In production, you'd store this in PouchDB
  // For now, return it so caller can store it

  return {
    keyHash: key,
    salt,
  };
}

/**
 * Authenticate user with key (mathematical verification)
 * Works offline - no database lookup needed
 */
export async function authenticateWithKey(
  userId: string,
  shopId: string,
  providedKey: string,
  storedKeyHash: string,
  salt: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Verify key mathematically
    const isValid = await verifyKeyPBKDF2(
      providedKey,
      userId,
      shopId,
      storedKeyHash,
      salt
    );

    if (!isValid) {
      return {
        valid: false,
        error: "Invalid key",
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Generate a recovery key (deterministic from master key)
 * This can be used to recover access if biometric fails
 */
export async function generateRecoveryKey(
  masterKey: string,
  userId: string,
  shopId: string
): Promise<string> {
  // Derive a recovery key (different from login key)
  const input = `recovery:${masterKey}:${userId}:${shopId}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Format as readable recovery code (e.g., ABCD-1234-EFGH-5678)
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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
 * Key strength validation
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

  // Check for complexity (optional - keys can be simple passphrases)
  // const hasUpper = /[A-Z]/.test(key);
  // const hasLower = /[a-z]/.test(key);
  // const hasNumber = /[0-9]/.test(key);
  // if (!hasUpper || !hasLower || !hasNumber) {
  //   errors.push("Key should contain uppercase, lowercase, and numbers");
  // }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Key-based authentication with biometric (two-factor)
 */
export async function authenticateWithKeyAndBiometric(
  userId: string,
  shopId: string,
  providedKey: string,
  storedKeyHash: string,
  salt: string
): Promise<{ valid: boolean; requiresBiometric: boolean; error?: string }> {
  // First verify the key
  const keyValid = await verifyKeyPBKDF2(
    providedKey,
    userId,
    shopId,
    storedKeyHash,
    salt
  );

  if (!keyValid) {
    return {
      valid: false,
      requiresBiometric: false,
      error: "Invalid key",
    };
  }

  // Key is valid, now check if biometric is required
  const { isWebAuthnSupported, isPlatformAuthenticatorAvailable } =
    await import("./webauthn");

  if (!isWebAuthnSupported()) {
    // No biometric support, key alone is sufficient
    return {
      valid: true,
      requiresBiometric: false,
    };
  }

  const biometricAvailable = await isPlatformAuthenticatorAvailable();

  if (!biometricAvailable) {
    // Biometric not available, key alone is sufficient
    return {
      valid: true,
      requiresBiometric: false,
    };
  }

  // Biometric is available and required
  return {
    valid: true,
    requiresBiometric: true,
  };
}


