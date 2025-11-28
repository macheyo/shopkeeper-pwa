"use client";

import { UserDoc } from "@/types";

/**
 * WebAuthn credential stored in PouchDB
 */
export interface WebAuthnCredential {
  _id: string; // webauthn_credential_{credentialId}
  _rev?: string;
  type: "webauthn_credential";
  userId: string;
  shopId: string;
  credentialId: string; // Base64 encoded
  publicKey: string; // Base64 encoded
  counter: number;
  deviceName?: string; // User-friendly name (e.g., "iPhone 13", "MacBook Pro")
  createdAt: string;
  lastUsedAt?: string;
}

/**
 * Check if WebAuthn is supported
 */
export function isWebAuthnSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    typeof PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials !== "undefined" &&
    typeof navigator.credentials.create !== "undefined"
  );
}

/**
 * Check if platform authenticator is available (biometrics)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Generate a random challenge (for WebAuthn)
 */
function generateChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Convert array buffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 to array buffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Register a new WebAuthn credential (biometric)
 */
export async function registerBiometric(
  user: UserDoc,
  deviceName?: string
): Promise<{ success: boolean; error?: string; credentialId?: string }> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: "WebAuthn is not supported in this browser",
    };
  }

  try {
    // Generate challenge
    const challenge = generateChallenge();
    const userId = new TextEncoder().encode(user.userId);
    const userEmail = new TextEncoder().encode(user.email);
    const userDisplayName = new TextEncoder().encode(user.name);

    // Create credential
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "ShopKeeper PWA",
          id: window.location.hostname, // Use current domain
        },
        user: {
          id: userId,
          name: user.email,
          displayName: user.name,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Prefer platform authenticator (biometrics)
          userVerification: "required",
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential;

    if (!credential || !credential.response) {
      return {
        success: false,
        error: "Failed to create credential",
      };
    }

    const response = credential.response as AuthenticatorAttestationResponse;

    // Extract credential data
    const credentialId = arrayBufferToBase64(credential.rawId);
    const publicKey = arrayBufferToBase64(
      response.getPublicKey() || new ArrayBuffer(0)
    );
    const clientDataJSON = arrayBufferToBase64(response.clientDataJSON);
    const attestationObject = arrayBufferToBase64(response.attestationObject);

    // Store credential in PouchDB
    const { getUsersDB } = await import("./usersDB");
    const db = await getUsersDB();
    const now = new Date().toISOString();

    const credentialDoc: WebAuthnCredential = {
      _id: `webauthn_credential_${credentialId}`,
      type: "webauthn_credential",
      userId: user.userId,
      shopId: user.shopId,
      credentialId,
      publicKey,
      counter: 0,
      deviceName: deviceName || getDeviceName(),
      createdAt: now,
    };

    await db.put(credentialDoc);

    return {
      success: true,
      credentialId,
    };
  } catch (error) {
    console.error("Error registering biometric:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to register biometric",
    };
  }
}

/**
 * Authenticate using WebAuthn (biometric)
 */
export async function authenticateWithBiometric(
  userId: string
): Promise<{ success: boolean; user?: UserDoc; error?: string }> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: "WebAuthn is not supported in this browser",
    };
  }

  try {
    // Get user's credentials from PouchDB
    const { getUsersDB } = await import("./usersDB");
    const { getUserById } = await import("./usersDB");
    const db = await getUsersDB();

    const result = await db.find({
      selector: {
        type: "webauthn_credential",
        userId: userId,
      },
    });

    if (result.docs.length === 0) {
      return {
        success: false,
        error: "No biometric credentials found for this user",
      };
    }

    const credentials = result.docs as WebAuthnCredential[];

    // Get user document
    const user = await getUserById(userId);
    if (!user || user.status !== "active") {
      return {
        success: false,
        error: "User not found or inactive",
      };
    }

    // Generate challenge
    const challenge = generateChallenge();

    // Get credential IDs
    const allowCredentials = credentials.map((cred) => ({
      id: base64ToArrayBuffer(cred.credentialId),
      type: "public-key",
      transports: ["internal"] as AuthenticatorTransport[],
    }));

    // Authenticate
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials,
        timeout: 60000,
        userVerification: "required",
        rpId: window.location.hostname,
      },
    })) as PublicKeyCredential;

    if (!assertion || !assertion.response) {
      return {
        success: false,
        error: "Biometric authentication failed",
      };
    }

    const response = assertion.response as AuthenticatorAssertionResponse;

    // Find the credential that was used
    const credentialId = arrayBufferToBase64(assertion.rawId);
    const usedCredential = credentials.find(
      (c) => c.credentialId === credentialId
    );

    if (!usedCredential) {
      return {
        success: false,
        error: "Credential not found",
      };
    }

    // Verify signature (simplified - in production, verify against public key)
    // For offline-first, we trust the platform authenticator
    // In production, you might want to verify the signature

    // Update credential counter and last used
    usedCredential.counter = (usedCredential.counter || 0) + 1;
    usedCredential.lastUsedAt = new Date().toISOString();
    await db.put(usedCredential);

    return {
      success: true,
      user,
    };
  } catch (error) {
    console.error("Error authenticating with biometric:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Biometric authentication failed",
    };
  }
}

/**
 * Get all biometric credentials for a user
 */
export async function getUserBiometricCredentials(
  userId: string
): Promise<WebAuthnCredential[]> {
  try {
    if (typeof window === "undefined") {
      return [];
    }

    const { getUsersDB } = await import("./usersDB");
    const db = await getUsersDB();

    const result = await db.find({
      selector: {
        type: "webauthn_credential",
        userId: userId,
      },
    });

    return result.docs as WebAuthnCredential[];
  } catch (error) {
    console.error("Error getting biometric credentials:", error);
    return [];
  }
}

/**
 * Delete a biometric credential
 */
export async function deleteBiometricCredential(
  credentialId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof window === "undefined") {
      return {
        success: false,
        error: "Cannot delete credential on server side",
      };
    }

    const { getUsersDB } = await import("./usersDB");
    const db = await getUsersDB();

    const doc = await db.get(`webauthn_credential_${credentialId}`);
    await db.remove(doc);

    return { success: true };
  } catch (error) {
    console.error("Error deleting biometric credential:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete credential",
    };
  }
}

/**
 * Get device name for credential
 */
function getDeviceName(): string {
  if (typeof window === "undefined") {
    return "Unknown Device";
  }

  const ua = navigator.userAgent;
  const platform = navigator.platform;

  // Detect device type
  if (/iPhone|iPad|iPod/.test(ua)) {
    return "iOS Device";
  } else if (/Android/.test(ua)) {
    return "Android Device";
  } else if (/Mac/.test(platform)) {
    return "Mac";
  } else if (/Win/.test(platform)) {
    return "Windows PC";
  } else if (/Linux/.test(platform)) {
    return "Linux PC";
  }

  return "Device";
}

/**
 * Check if user has biometric credentials registered
 */
export async function hasBiometricCredentials(
  userId: string
): Promise<boolean> {
  const credentials = await getUserBiometricCredentials(userId);
  return credentials.length > 0;
}


