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
  createdAt: string;
  updatedAt: string;
}

/**
 * Get CouchDB configuration for a shop
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

      return null;
    } catch (err: any) {
      if (err.status === 404) {
        return null;
      }
      throw err;
    }
  } catch (error) {
    console.error("Error getting CouchDB config:", error);
    return null;
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
    } catch (err: any) {
      if (err.status === 404) {
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
    } catch (err: any) {
      if (err.status === 404) {
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
    } catch (err: any) {
      if (err.status === 404) {
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


