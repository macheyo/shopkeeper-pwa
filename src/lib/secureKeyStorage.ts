"use client";

/**
 * Secure Key Storage
 * Stores the user's authentication key encrypted in localStorage
 * Uses Web Crypto API for encryption
 */

const STORAGE_KEY_PREFIX = "encrypted_key_";

/**
 * Derive a device-specific encryption key from browser fingerprint
 * This ensures the key can only be decrypted on the same device
 */
async function deriveDeviceKey(userId: string): Promise<CryptoKey> {
  // Create a device fingerprint from available browser properties
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    userId,
  ].join(":");

  // Import fingerprint as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(fingerprint),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive encryption key using PBKDF2
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("shopkeeper-key-storage"),
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

  return encryptionKey;
}

/**
 * Encrypt and store the user's key
 */
export async function storeUserKey(userId: string, key: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Cannot store key on server side");
  }

  try {
    const encryptionKey = await deriveDeviceKey(userId);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

    // Encrypt the key
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      encryptionKey,
      new TextEncoder().encode(key)
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64url for storage
    const base64 = btoa(String.fromCharCode(...combined))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Store in localStorage
    const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
    localStorage.setItem(storageKey, base64);
  } catch (error) {
    console.error("Error storing key:", error);
    throw new Error("Failed to store key securely");
  }
}

/**
 * Retrieve and decrypt the user's key
 */
export async function getUserKey(userId: string): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
    const stored = localStorage.getItem(storageKey);

    if (!stored) {
      return null;
    }

    // Decode from base64url
    let base64 = stored.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }

    const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Decrypt
    const encryptionKey = await deriveDeviceKey(userId);
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      encryptionKey,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Error retrieving key:", error);
    // If decryption fails (e.g., device changed), return null
    return null;
  }
}

/**
 * Check if a key is stored for the user
 */
export async function hasStoredKey(userId: string): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
  return localStorage.getItem(storageKey) !== null;
}

/**
 * Remove stored key
 */
export async function removeUserKey(userId: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
  localStorage.removeItem(storageKey);
}



