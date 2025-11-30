"use client";

/**
 * Feature Checking Utilities
 * Check if features are enabled based on license
 */

import { Feature } from "./features";
import { LicenseData } from "./licenseKey";
import { getSession } from "./auth";
import { getLicenseKey } from "./licenseStorage";
import { validateLicenseKey } from "./licenseKey";

/**
 * Check if a feature is enabled
 */
export async function isFeatureEnabled(feature: Feature): Promise<boolean> {
  try {
    const session = getSession();
    if (!session) {
      return false;
    }

    // Get license key from session or storage
    const licenseKey =
      session.licenseKey || getLicenseKey();

    if (!licenseKey) {
      // No license - check if it's a core feature that should be available
      const { CORE_FEATURES } = await import("./features");
      return CORE_FEATURES.includes(feature);
    }

    // Validate and get license data
    const validation = await validateLicenseKey(licenseKey);
    if (!validation.valid || !validation.data) {
      // Invalid license - fallback to core features
      const { CORE_FEATURES } = await import("./features");
      return CORE_FEATURES.includes(feature);
    }

    const licenseData = validation.data;

    // Check if feature is in license features array
    if (licenseData.features && licenseData.features.length > 0) {
      return licenseData.features.includes(feature);
    }

    // If no features specified, check role-based defaults
    if (licenseData.role) {
      const { getDefaultFeaturesForRole } = await import("./features");
      const defaultFeatures = getDefaultFeaturesForRole(licenseData.role);
      return defaultFeatures.includes(feature);
    }

    // Fallback: allow core features
    const { CORE_FEATURES } = await import("./features");
    return CORE_FEATURES.includes(feature);
  } catch (error) {
    console.error("Error checking feature:", error);
    // On error, allow core features
    const { CORE_FEATURES } = await import("./features");
    return CORE_FEATURES.includes(feature);
  }
}

/**
 * Check if multiple features are enabled
 */
export async function areFeaturesEnabled(
  features: Feature[]
): Promise<boolean> {
  const checks = await Promise.all(
    features.map((feature) => isFeatureEnabled(feature))
  );
  return checks.every((enabled) => enabled);
}

/**
 * Get all enabled features from license
 */
export async function getEnabledFeatures(): Promise<Feature[]> {
  try {
    const session = getSession();
    if (!session) {
      return [];
    }

    const licenseKey =
      session.licenseKey || getLicenseKey();

    if (!licenseKey) {
      // No license - return core features
      const { CORE_FEATURES } = await import("./features");
      return CORE_FEATURES;
    }

    const validation = await validateLicenseKey(licenseKey);
    if (!validation.valid || !validation.data) {
      const { CORE_FEATURES } = await import("./features");
      return CORE_FEATURES;
    }

    const licenseData = validation.data;

    // Return features from license if available
    if (licenseData.features && licenseData.features.length > 0) {
      return licenseData.features as Feature[];
    }

    // Fallback to role-based defaults
    if (licenseData.role) {
      const { getDefaultFeaturesForRole } = await import("./features");
      return getDefaultFeaturesForRole(licenseData.role);
    }

    const { CORE_FEATURES } = await import("./features");
    return CORE_FEATURES;
  } catch (error) {
    console.error("Error getting enabled features:", error);
    const { CORE_FEATURES } = await import("./features");
    return CORE_FEATURES;
  }
}

/**
 * Get license data (cached)
 */
let cachedLicenseData: LicenseData | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getLicenseData(): Promise<LicenseData | null> {
  try {
    const now = Date.now();
    if (cachedLicenseData && now - cacheTimestamp < CACHE_DURATION) {
      return cachedLicenseData;
    }

    const session = getSession();
    if (!session) {
      return null;
    }

    const licenseKey =
      session.licenseKey || getLicenseKey();

    if (!licenseKey) {
      return null;
    }

    const validation = await validateLicenseKey(licenseKey);
    if (!validation.valid || !validation.data) {
      return null;
    }

    cachedLicenseData = validation.data;
    cacheTimestamp = now;
    return cachedLicenseData;
  } catch (error) {
    console.error("Error getting license data:", error);
    return null;
  }
}

/**
 * Clear license cache (call when license changes)
 */
export function clearLicenseCache(): void {
  cachedLicenseData = null;
  cacheTimestamp = 0;
}
