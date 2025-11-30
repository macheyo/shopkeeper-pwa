"use client";

import { CouchDBConfig } from "./couchdb";
import { getSettingsDB } from "./settingsDB";

const COUCHDB_CONFIG_KEY = "couchdb_config";

/**
 * CouchDB configuration document stored in settings DB
 */
interface CouchDBConfigDoc {
  _id: string;
  _rev?: string;
  type: "couchdb_config";
  shopId: string;
  config: CouchDBConfig;
  isEnabled: boolean;
  lastTestedAt?: string;
  lastTestResult?: {
    success: boolean;
    error?: string;
  };
  firstSyncCompleted?: boolean; // Track if first sync has been done
  createdAt: string;
  updatedAt: string;
}

/**
 * Get default CouchDB configuration from environment variables
 */
function getDefaultCouchDBConfig(): CouchDBConfig | null {
  const url = process.env.NEXT_PUBLIC_COUCHDB_URL || "http://localhost:5984";
  const username = process.env.NEXT_PUBLIC_COUCHDB_USERNAME || "admin";
  const password = process.env.NEXT_PUBLIC_COUCHDB_PASSWORD || "secret";

  // Only return config if URL is set (not empty)
  if (!url || url.trim() === "") {
    return null;
  }

  return {
    url: url.trim(),
    username: username.trim(),
    password: password.trim(),
    shopId: "", // Will be set by caller
  };
}

/**
 * Get CouchDB configuration for a shop
 * Falls back to environment variables if not configured
 */
export async function getCouchDBConfig(
  shopId: string
): Promise<CouchDBConfig | null> {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const db = await getSettingsDB();
    const docId = `${COUCHDB_CONFIG_KEY}_${shopId}`;

    try {
      const doc = await db.get(docId);
      const configDoc = doc as CouchDBConfigDoc;

      if (configDoc.isEnabled && configDoc.config) {
        return configDoc.config;
      }

      // If not enabled, return null (don't use env vars if sync is disabled)
      return null;
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === 404) {
        // No config saved, use environment variables as default
        const defaultConfig = getDefaultCouchDBConfig();
        if (defaultConfig) {
          defaultConfig.shopId = shopId;
        }
        return defaultConfig;
      }
      throw err;
    }
  } catch (error) {
    console.error("Error getting CouchDB config:", error);
    // Fallback to environment variables
    const defaultConfig = getDefaultCouchDBConfig();
    if (defaultConfig) {
      defaultConfig.shopId = shopId;
    }
    return defaultConfig;
  }
}

/**
 * Save CouchDB configuration
 */
export async function saveCouchDBConfig(
  shopId: string,
  config: CouchDBConfig,
  isEnabled: boolean = true
): Promise<void> {
  try {
    if (typeof window === "undefined") {
      throw new Error("Cannot save config on server side");
    }

    const db = await getSettingsDB();
    const docId = `${COUCHDB_CONFIG_KEY}_${shopId}`;
    const now = new Date().toISOString();

    try {
      // Try to get existing document
      const existing = await db.get(docId);
      const configDoc: CouchDBConfigDoc = {
        ...(existing as CouchDBConfigDoc),
        config,
        isEnabled,
        updatedAt: now,
      };

      await db.put(configDoc);
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === 404) {
        // Create new document
        const configDoc: CouchDBConfigDoc = {
          _id: docId,
          type: "couchdb_config",
          shopId,
          config,
          isEnabled,
          createdAt: now,
          updatedAt: now,
        };

        await db.put(configDoc);
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error("Error saving CouchDB config:", error);
    throw new Error(
      `Failed to save CouchDB config: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Update CouchDB config test result
 */
export async function updateCouchDBTestResult(
  shopId: string,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    if (typeof window === "undefined") {
      return;
    }

    const db = await getSettingsDB();
    const docId = `${COUCHDB_CONFIG_KEY}_${shopId}`;

    try {
      const existing = await db.get(docId);
      const configDoc: CouchDBConfigDoc = {
        ...(existing as CouchDBConfigDoc),
        lastTestedAt: new Date().toISOString(),
        lastTestResult: {
          success,
          error,
        },
        updatedAt: new Date().toISOString(),
      };

      await db.put(configDoc);
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === 404) {
        // Config doesn't exist yet, that's fine
        return;
      }
      throw err;
    }
  } catch (error) {
    console.error("Error updating test result:", error);
  }
}

/**
 * Check if CouchDB sync is enabled for a shop
 */
export async function isCouchDBSyncEnabled(shopId: string): Promise<boolean> {
  try {
    const config = await getCouchDBConfig(shopId);
    return config !== null;
  } catch {
    return false;
  }
}

/**
 * Mark first sync as completed
 */
export async function markFirstSyncCompleted(shopId: string): Promise<void> {
  try {
    if (typeof window === "undefined") {
      return;
    }

    const db = await getSettingsDB();
    const docId = `${COUCHDB_CONFIG_KEY}_${shopId}`;

    try {
      const existing = await db.get(docId);
      const configDoc: CouchDBConfigDoc = {
        ...(existing as CouchDBConfigDoc),
        firstSyncCompleted: true,
        updatedAt: new Date().toISOString(),
      };

      await db.put(configDoc);
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === 404) {
        // Doesn't exist, that's fine
        return;
      }
      throw err;
    }
  } catch (error) {
    console.error("Error marking first sync completed:", error);
  }
}

/**
 * Check if first sync has been completed
 */
export async function hasFirstSyncCompleted(shopId: string): Promise<boolean> {
  try {
    if (typeof window === "undefined") {
      return false;
    }

    const db = await getSettingsDB();
    const docId = `${COUCHDB_CONFIG_KEY}_${shopId}`;

    try {
      const doc = await db.get(docId);
      const configDoc = doc as CouchDBConfigDoc;
      return configDoc.firstSyncCompleted === true;
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === 404) {
        return false;
      }
      throw err;
    }
  } catch (error) {
    console.error("Error checking first sync status:", error);
    return false;
  }
}

/**
 * Disable CouchDB sync
 */
export async function disableCouchDBSync(shopId: string): Promise<void> {
  try {
    if (typeof window === "undefined") {
      return;
    }

    const db = await getSettingsDB();
    const docId = `${COUCHDB_CONFIG_KEY}_${shopId}`;

    try {
      const existing = await db.get(docId);
      const configDoc: CouchDBConfigDoc = {
        ...(existing as CouchDBConfigDoc),
        isEnabled: false,
        updatedAt: new Date().toISOString(),
      };

      await db.put(configDoc);
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === 404) {
        // Doesn't exist, that's fine
        return;
      }
      throw err;
    }
  } catch (error) {
    console.error("Error disabling CouchDB sync:", error);
    throw error;
  }
}
