"use client";

/**
 * License Key System
 * Generates and validates license keys that contain user information
 * Can be sold and transferred - key itself contains all necessary data
 */

export interface LicenseData {
  phoneNumber: string; // Phone number (replaces email)
  email?: string; // Optional email (for backwards compatibility)
  shopId: string;
  shopName: string;
  ownerName: string;
  issuedAt: string;
  expiresAt?: string; // Optional expiration
  features?: string[]; // Optional feature flags
  maxUsers?: number; // Optional user limit
  deviceId?: string; // Device fingerprint - license tied to specific device
  role?: "owner" | "manager" | "employee"; // User role for this license
  userId?: string; // User ID this license is for
}

/**
 * Master key for signing license keys (in production, this should be server-side)
 * For now, we'll use a constant - in production, this should be a secret key
 */
const LICENSE_MASTER_KEY =
  process.env.NEXT_PUBLIC_LICENSE_KEY || "shopkeeper-license-master-key-2024";

/**
 * Generate a license key from user data
 * The key is signed and contains encrypted user information
 */
export async function generateLicenseKey(data: LicenseData): Promise<{
  licenseKey: string;
  formattedKey: string; // Human-readable format
}> {
  // Create license payload
  const payload = {
    phoneNumber: data.phoneNumber.replace(/[\s\-\(\)]/g, ""), // Normalize phone number
    email: data.email?.toLowerCase() || null,
    shopId: data.shopId,
    shopName: data.shopName,
    ownerName: data.ownerName,
    issuedAt: data.issuedAt,
    expiresAt: data.expiresAt || null,
    features: data.features || [],
    maxUsers: data.maxUsers || null,
    deviceId: data.deviceId || null,
    role: data.role || null,
    userId: data.userId || null,
  };

  // Convert to JSON and encrypt
  const payloadJson = JSON.stringify(payload);
  const encrypted = await encryptLicenseData(payloadJson, LICENSE_MASTER_KEY);

  // Create signature
  const signature = await signLicenseData(encrypted, LICENSE_MASTER_KEY);

  // Combine: encrypted data + signature
  const combined = `${encrypted}:${signature}`;

  // Convert to base64url
  const base64 = btoa(combined)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  // Format as readable license key (XXXX-XXXX-XXXX-XXXX format)
  const formatted = formatLicenseKey(base64);

  return {
    licenseKey: base64,
    formattedKey: formatted,
  };
}

/**
 * Validate and decode a license key
 */
export async function validateLicenseKey(licenseKey: string): Promise<{
  valid: boolean;
  data?: LicenseData;
  error?: string;
}> {
  try {
    // Remove formatting (dashes, spaces)
    const cleanKey = licenseKey.replace(/[-\s]/g, "");

    // Decode from base64url
    let base64 = cleanKey.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }

    const decoded = atob(base64);
    const [encrypted, signature] = decoded.split(":");

    if (!encrypted || !signature) {
      return {
        valid: false,
        error: "Invalid license key format",
      };
    }

    // Verify signature
    const isValidSignature = await verifyLicenseSignature(
      encrypted,
      signature,
      LICENSE_MASTER_KEY
    );

    if (!isValidSignature) {
      return {
        valid: false,
        error: "Invalid license key signature",
      };
    }

    // Decrypt data
    const decrypted = await decryptLicenseData(encrypted, LICENSE_MASTER_KEY);
    const data = JSON.parse(decrypted) as LicenseData;

    // Check expiration if present
    if (data.expiresAt) {
      const expiresAt = new Date(data.expiresAt);
      if (expiresAt < new Date()) {
        return {
          valid: false,
          error: "License key has expired",
        };
      }
    }

    // Check device ID if present (license tied to specific device)
    if (data.deviceId) {
      const { getStableDeviceId } = await import("./deviceFingerprint");
      const currentDeviceId = await getStableDeviceId();
      if (data.deviceId !== currentDeviceId) {
        return {
          valid: false,
          error: "License key is not valid for this device",
        };
      }
    }

    return {
      valid: true,
      data,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid license key",
    };
  }
}

/**
 * Encrypt license data
 */
async function encryptLicenseData(data: string, key: string): Promise<string> {
  // Derive encryption key from master key
  const encryptionKey = await deriveKey(key, "license-encryption");

  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
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

  // Convert to base64url
  return btoa(String.fromCharCode(...combined))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Decrypt license data
 */
async function decryptLicenseData(
  encryptedData: string,
  key: string
): Promise<string> {
  // Decode from base64url
  let base64 = encryptedData.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }

  const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  // Derive encryption key
  const encryptionKey = await deriveKey(key, "license-encryption");

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    encryptionKey,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Sign license data using HMAC
 */
async function signLicenseData(data: string, key: string): Promise<string> {
  // Import key for HMAC
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key + "license-signing"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign using HMAC
  const signature = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    new TextEncoder().encode(data)
  );

  // Convert to base64url
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Verify license signature
 */
async function verifyLicenseSignature(
  data: string,
  signature: string,
  key: string
): Promise<boolean> {
  try {
    // Import key for HMAC
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(key + "license-signing"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Decode signature
    let base64 = signature.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }

    const signatureBytes = Uint8Array.from(atob(base64), (c) =>
      c.charCodeAt(0)
    );

    // Verify
    const isValid = await crypto.subtle.verify(
      "HMAC",
      keyMaterial,
      signatureBytes,
      new TextEncoder().encode(data)
    );

    return isValid;
  } catch {
    return false;
  }
}

/**
 * Derive a key from master key
 */
async function deriveKey(
  masterKey: string,
  purpose: string
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterKey),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(`shopkeeper-${purpose}`),
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
}

/**
 * Format license key as readable string (XXXX-XXXX-XXXX-XXXX)
 */
function formatLicenseKey(key: string): string {
  // Take first 16 characters and format
  const clean = key.substring(0, 16).toUpperCase();
  return `${clean.substring(0, 4)}-${clean.substring(4, 8)}-${clean.substring(
    8,
    12
  )}-${clean.substring(12, 16)}`;
}

/**
 * Extract license key info without full validation (for display)
 */
export function parseLicenseKeyFormat(licenseKey: string): {
  formatted: string;
  isValidFormat: boolean;
} {
  const clean = licenseKey.replace(/[-\s]/g, "").toUpperCase();
  const formatted = formatLicenseKey(clean);
  return {
    formatted,
    isValidFormat: clean.length >= 16,
  };
}

/**
 * Generate a trial license for a new user (14 days, owner role)
 */
export async function generateTrialLicense(
  phoneNumber: string,
  shopId: string,
  shopName: string,
  ownerName: string,
  userId: string
): Promise<{ licenseKey: string; formattedKey: string }> {
  const { getStableDeviceId } = await import("./deviceFingerprint");
  const deviceId = await getStableDeviceId();

  const issuedAt = new Date().toISOString();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14); // 14 days trial

  // Get default features for owner role
  const { OWNER_DEFAULT_FEATURES } = await import("./features");

  return generateLicenseKey({
    phoneNumber,
    shopId,
    shopName,
    ownerName,
    issuedAt,
    expiresAt: expiresAt.toISOString(),
    features: OWNER_DEFAULT_FEATURES,
    deviceId,
    role: "owner",
    userId,
  });
}

/**
 * Generate a license for an invited user (employee role, tied to device)
 */
export async function generateEmployeeLicense(
  phoneNumber: string,
  shopId: string,
  shopName: string,
  employeeName: string,
  userId: string
): Promise<{ licenseKey: string; formattedKey: string }> {
  const { getStableDeviceId } = await import("./deviceFingerprint");
  const { EMPLOYEE_DEFAULT_FEATURES } = await import("./features");
  const deviceId = await getStableDeviceId();

  const issuedAt = new Date().toISOString();
  // Employee licenses don't expire (or set a long expiration)
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 10); // 10 years

  return generateLicenseKey({
    phoneNumber,
    shopId,
    shopName,
    ownerName: employeeName,
    issuedAt,
    expiresAt: expiresAt.toISOString(),
    features: EMPLOYEE_DEFAULT_FEATURES,
    deviceId,
    role: "employee",
    userId,
  });
}
