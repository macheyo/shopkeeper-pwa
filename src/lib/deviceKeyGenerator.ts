"use client";

/**
 * Deterministic Key Generator
 * Generates a deterministic key from user-provided data (email + password)
 * No browser dependency - works the same everywhere
 * No storage needed - key is generated on-demand from user input
 */

/**
 * Generate a deterministic key from user credentials
 * Same email + same password + same shopId = same key (always)
 * Works identically across all browsers and devices
 */
export async function generateKeyFromCredentials(
  email: string,
  password: string,
  shopId: string
): Promise<string> {
  const input = `${email.toLowerCase()}:${password}:${shopId}`;

  // Hash using SHA-256 for deterministic key
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Convert to hex string (64 characters)
  const keyHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Return first 32 characters as key (128 bits)
  // This is deterministic - same credentials = same key (always, everywhere)
  return keyHex.substring(0, 32);
}

/**
 * Generate a longer key (64 chars) if needed
 */
export async function generateKeyFromCredentialsLong(
  email: string,
  password: string,
  shopId: string
): Promise<string> {
  const input = `${email.toLowerCase()}:${password}:${shopId}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
