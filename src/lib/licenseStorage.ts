"use client";

/**
 * License Key Storage
 * Stores license key in session only (not in dedicated localStorage)
 * License is NOT stored in database - user must save it securely
 */

/**
 * Store license key in session
 */
export function storeLicenseKey(
  userId: string,
  shopId: string,
  licenseKey: string
): void {
  if (typeof window === "undefined") {
    return; // Server-side, skip
  }

  try {
    const { updateSessionLicense } = require("@/lib/auth");
    updateSessionLicense(licenseKey);
  } catch (err) {
    console.error("Failed to store license key in session:", err);
  }
}

/**
 * Get license key from session
 */
export function getLicenseKey(userId: string, shopId: string): string | null {
  if (typeof window === "undefined") {
    return null; // Server-side
  }

  try {
    const { getSession } = require("@/lib/auth");
    const session = getSession();
    return session?.licenseKey || null;
  } catch (err) {
    console.error("Failed to get license key from session:", err);
    return null;
  }
}

/**
 * Remove license key from session
 */
export function removeLicenseKey(userId: string, shopId: string): void {
  if (typeof window === "undefined") {
    return; // Server-side
  }

  try {
    const { getSession } = require("@/lib/auth");
    const session = getSession();
    if (session && session.licenseKey) {
      // Remove license key from session
      const SESSION_KEY = "shopkeeper_session";
      const sessionJson = localStorage.getItem(SESSION_KEY);
      if (sessionJson) {
        const sessionData = JSON.parse(sessionJson);
        delete sessionData.licenseKey;
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      }
    }
  } catch (err) {
    console.error("Failed to remove license key from session:", err);
  }
}
