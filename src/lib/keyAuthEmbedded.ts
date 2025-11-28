"use client";

/**
 * Embedded Key Authentication
 *
 * Key contains embedded information (username, phone) that can be extracted
 * when user provides the key. No lookups needed - key is self-contained!
 */

/**
 * Embedded user information
 */
export interface EmbeddedUserInfo {
  email: string;
  shopId: string;
  username?: string;
  phoneNumber?: string;
}

/**
 * Derive encryption key from master key only
 * ShopId is embedded in encrypted data, so we don't need it for key derivation
 */
async function deriveEncryptionKey(masterKey: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterKey),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Use a constant salt so same key always gives same encryption key
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("shopkeeper-embedded-auth"), // Constant salt
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
 * Encrypt user information with key-derived encryption key
 */
async function encryptUserInfo(
  encryptionKey: CryptoKey,
  info: EmbeddedUserInfo
): Promise<string> {
  const data = JSON.stringify(info);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    encryptionKey,
    new TextEncoder().encode(data)
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Convert to base64url for URL-safe encoding
  return btoa(String.fromCharCode(...combined))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Decrypt user information with key-derived encryption key
 */
async function decryptUserInfo(
  encryptionKey: CryptoKey,
  encryptedData: string
): Promise<EmbeddedUserInfo> {
  try {
    // Decode from base64url
    let base64 = encryptedData.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    while (base64.length % 4) {
      base64 += "=";
    }

    const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Validate minimum size (12 bytes IV + at least some encrypted data)
    if (combined.length < 13) {
      throw new Error(
        `Encrypted data too small: ${combined.length} bytes (minimum 13 required)`
      );
    }

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Validate encrypted data is not empty
    if (encrypted.length === 0) {
      throw new Error("Encrypted data is empty after extracting IV");
    }

    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      encryptionKey,
      encrypted
    );

    const data = JSON.parse(new TextDecoder().decode(decrypted));
    return data as EmbeddedUserInfo;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Derive user ID from key only
 * ShopId is embedded in encrypted data, so we derive userId from key alone
 */
async function deriveUserIdFromKey(masterKey: string): Promise<string> {
  const input = `userid:${masterKey}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * @deprecated Token-based authentication is no longer supported. This function is kept for backwards compatibility but should not be used.
 * Create embedded key token
 * Contains: userId (for verification) + encrypted user info (including shopId)
 */
export async function createEmbeddedKeyToken(
  masterKey: string,
  userInfo: EmbeddedUserInfo
): Promise<{
  userId: string;
  token: string; // userId + encrypted info
  shortId: string; // First 8 chars for easy remembering
}> {
  // Derive userId from key only (shopId is in encrypted data)
  const userId = await deriveUserIdFromKey(masterKey);

  // Derive encryption key from key only
  const encryptionKey = await deriveEncryptionKey(masterKey);

  // Encrypt user info (includes shopId)
  const encryptedInfo = await encryptUserInfo(encryptionKey, userInfo);

  // Combine userId + encrypted info
  // Format: userId:encryptedInfo (base64url encoded)
  const token = `${userId}:${encryptedInfo}`;

  return {
    userId,
    token,
    shortId: userId.substring(0, 8),
  };
}

/**
 * @deprecated Token-based authentication is no longer supported. This function is kept for backwards compatibility but should not be used.
 * Verify key and extract embedded information
 * User provides ONLY the key + token - system extracts everything!
 */
export async function verifyKeyAndExtractInfo(
  providedKey: string,
  providedToken: string // User provides this (from registration)
): Promise<{
  valid: boolean;
  userId?: string;
  userInfo?: EmbeddedUserInfo;
  error?: string;
}> {
  try {
    // Split token into userId and encrypted info
    const [storedUserId, encryptedInfo] = providedToken.split(":");

    if (!storedUserId || !encryptedInfo) {
      return {
        valid: false,
        error: "Invalid token format",
      };
    }

    // Derive userId from provided key (no shopId needed!)
    const derivedUserId = await deriveUserIdFromKey(providedKey);

    // Verify userId matches (key is correct)
    if (derivedUserId !== storedUserId) {
      return {
        valid: false,
        error: "Invalid key - user ID does not match",
      };
    }

    // Key is valid! Now decrypt embedded information (includes shopId!)
    const encryptionKey = await deriveEncryptionKey(providedKey);
    const userInfo = await decryptUserInfo(encryptionKey, encryptedInfo);

    return {
      valid: true,
      userId: derivedUserId,
      userInfo, // Contains username, phoneNumber, and shopId!
    };
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to verify key or extract information",
    };
  }
}

/**
 * @deprecated Token-based authentication is no longer supported. This function is kept for backwards compatibility but should not be used.
 * Alternative: Embed info directly in userId format
 * userId = Hash(Key) + Base64(EncryptedInfo)
 * ShopId is in encrypted data, so no need for it in hash
 */
export async function createEmbeddedUserId(
  masterKey: string,
  userInfo: EmbeddedUserInfo
): Promise<{
  userId: string; // Contains hash + encrypted info
  shortId: string;
}> {
  // Derive base hash from key only
  const baseHash = await deriveUserIdFromKey(masterKey);

  // Encrypt user info (includes shopId)
  const encryptionKey = await deriveEncryptionKey(masterKey);
  const encryptedInfo = await encryptUserInfo(encryptionKey, userInfo);

  // Combine: hash + encrypted info
  // Format: {hash}_{encryptedInfo}
  const userId = `${baseHash}_${encryptedInfo}`;

  return {
    userId,
    shortId: baseHash.substring(0, 8),
  };
}

/**
 * @deprecated Token-based authentication is no longer supported. This function is kept for backwards compatibility but should not be used.
 * Verify key and extract info from embedded userId
 * User provides ONLY key + token - shopId is extracted!
 */
export async function verifyKeyFromEmbeddedUserId(
  providedKey: string,
  embeddedUserId: string // Contains hash + encrypted info
): Promise<{
  valid: boolean;
  userId?: string;
  userInfo?: EmbeddedUserInfo;
  error?: string;
}> {
  try {
    // Split embedded userId
    const [storedHash, encryptedInfo] = embeddedUserId.split("_");

    if (!storedHash || !encryptedInfo) {
      return {
        valid: false,
        error: "Invalid user ID format",
      };
    }

    // Derive hash from provided key (no shopId needed!)
    const derivedHash = await deriveUserIdFromKey(providedKey);

    // Verify hash matches
    if (derivedHash !== storedHash) {
      return {
        valid: false,
        error: "Invalid key",
      };
    }

    // Key is valid! Decrypt embedded info (includes shopId!)
    const encryptionKey = await deriveEncryptionKey(providedKey);
    const userInfo = await decryptUserInfo(encryptionKey, encryptedInfo);

    return {
      valid: true,
      userId: derivedHash,
      userInfo, // Contains username, phoneNumber, and shopId!
    };
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to verify or extract information",
    };
  }
}

/**
 * @deprecated Token-based authentication is no longer supported. This function is kept for backwards compatibility but should not be used.
 * Generate a user-friendly token format
 * Format: {shortId}-{encryptedInfo}
 * Example: a7f3b9c2-XyZ123AbC...
 * ShopId is embedded in encrypted info - no need to provide it!
 */
export async function createUserFriendlyToken(
  masterKey: string,
  userInfo: EmbeddedUserInfo
): Promise<{
  token: string; // User-friendly format
  userId: string; // Full hash
  shortId: string; // First 8 chars
}> {
  // Derive userId from key only (shopId is in encrypted data)
  const userId = await deriveUserIdFromKey(masterKey);
  const shortId = userId.substring(0, 8);

  // Derive encryption key from key only
  const encryptionKey = await deriveEncryptionKey(masterKey);
  const encryptedInfo = await encryptUserInfo(encryptionKey, userInfo);

  // User-friendly format: shortId-encryptedInfo
  const token = `${shortId}-${encryptedInfo}`;

  return {
    token,
    userId,
    shortId,
  };
}

/**
 * @deprecated Token-based authentication is no longer supported. This function is kept for backwards compatibility but should not be used.
 * Verify key from user-friendly token
 * User provides ONLY key + token - shopId is extracted from token!
 */
export async function verifyKeyFromUserFriendlyToken(
  providedKey: string,
  token: string // Format: shortId-encryptedInfo
): Promise<{
  valid: boolean;
  userId?: string;
  userInfo?: EmbeddedUserInfo;
  error?: string;
}> {
  try {
    // Split only on the first hyphen (shortId is 8 chars, rest is encryptedInfo)
    const firstHyphenIndex = token.indexOf("-");
    if (firstHyphenIndex === -1 || firstHyphenIndex !== 8) {
      return {
        valid: false,
        error: "Invalid token format - expected format: shortId-encryptedInfo",
      };
    }

    const shortId = token.substring(0, firstHyphenIndex);
    const encryptedInfo = token.substring(firstHyphenIndex + 1);

    if (!shortId || !encryptedInfo) {
      return {
        valid: false,
        error: "Invalid token format - missing shortId or encryptedInfo",
      };
    }

    // Derive userId from key only (no shopId needed!)
    const derivedUserId = await deriveUserIdFromKey(providedKey);
    const derivedShortId = derivedUserId.substring(0, 8);

    // Verify short ID matches
    if (derivedShortId !== shortId) {
      return {
        valid: false,
        error: "Invalid key - short ID does not match",
      };
    }

    // Key is valid! Decrypt embedded info (includes shopId!)
    const encryptionKey = await deriveEncryptionKey(providedKey);
    const userInfo = await decryptUserInfo(encryptionKey, encryptedInfo);

    return {
      valid: true,
      userId: derivedUserId,
      userInfo, // Contains username, phoneNumber, and shopId!
    };
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to verify or extract information",
    };
  }
}
