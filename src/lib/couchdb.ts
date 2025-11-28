"use client";

import { UserDoc } from "@/types";

/**
 * CouchDB connection configuration
 */
export interface CouchDBConfig {
  url: string; // e.g., "http://localhost:5984" or "https://your-couchdb-instance.cloudant.com"
  username: string;
  password: string;
  shopId: string;
}

/**
 * CouchDB session information
 */
export interface CouchDBSession {
  name: string;
  roles: string[];
  shopId: string;
  token?: string; // Session token if using cookie-based auth
  expiresAt?: string;
}

/**
 * Test CouchDB connection and authenticate
 */
export async function testCouchDBConnection(
  url: string,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; session?: CouchDBSession }> {
  try {
    // Remove trailing slash
    const cleanUrl = url.replace(/\/$/, "");

    // Test connection with CouchDB session endpoint
    const response = await fetch(`${cleanUrl}/_session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: username,
        password: password,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Authentication failed: ${response.status} ${response.statusText}. ${errorText}`,
      };
    }

    const data = await response.json();
    const cookie = response.headers.get("Set-Cookie");

    return {
      success: true,
      session: {
        name: data.userCtx.name,
        roles: data.userCtx.roles || [],
        shopId: "", // Will be set by caller
        token: cookie ? extractTokenFromCookie(cookie) : undefined,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Extract session token from Set-Cookie header
 */
function extractTokenFromCookie(cookie: string | null): string | undefined {
  if (!cookie) return undefined;

  const match = cookie.match(/AuthSession=([^;]+)/);
  return match ? match[1] : undefined;
}

/**
 * Get remote CouchDB database connection
 * Uses basic auth for PouchDB replication
 */
export async function getRemoteDB(
  localDBName: string,
  config: CouchDBConfig
): Promise<PouchDB.Database> {
  if (typeof window === "undefined") {
    throw new Error(
      "CouchDB operations are only supported in browser environment"
    );
  }

  // Remove trailing slash from URL
  const cleanUrl = config.url.replace(/\/$/, "");

  // Database naming: {shopId}_{databaseName}
  const remoteDBName = `${config.shopId}_${localDBName}`;
  const remoteUrl = `${cleanUrl}/${remoteDBName}`;

  // Import PouchDB dynamically
  // PouchDB 9.x includes HTTP adapter by default
  const PouchDB = (await import("pouchdb-browser")).default;

  // Create remote database with authentication
  // PouchDB will automatically use HTTP adapter for remote URLs
  const remoteDB = new PouchDB(remoteUrl, {
    auth: {
      username: config.username,
      password: config.password,
    },
    // Enable CORS if needed (for local development)
    skip_setup: false, // Will create database if it doesn't exist
  });

  return remoteDB;
}

/**
 * Ensure remote database exists (create if it doesn't)
 */
export async function ensureRemoteDatabase(
  localDBName: string,
  config: CouchDBConfig
): Promise<void> {
  try {
    const remoteDB = await getRemoteDB(localDBName, config);
    // Try to get database info - this will create it if it doesn't exist
    await remoteDB.info();
  } catch (error) {
    console.error(`Error ensuring remote database ${localDBName}:`, error);
    throw new Error(
      `Failed to ensure remote database exists: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Get local database by name
 */
export async function getLocalDB(dbName: string): Promise<PouchDB.Database> {
  const {
    getProductsDB,
    getSalesDB,
    getPurchasesDB,
    getCashInHandDB,
    getLedgerDB,
    getInventoryLotsDB,
  } = await import("./databases");
  const { getUsersDB } = await import("./usersDB");
  const { getSettingsDB } = await import("./settingsDB");

  const dbMap: Record<string, () => Promise<PouchDB.Database>> = {
    products: getProductsDB,
    sales: getSalesDB,
    purchases: getPurchasesDB,
    cash_in_hand: getCashInHandDB,
    ledger: getLedgerDB,
    inventory_lots: getInventoryLotsDB,
    users: getUsersDB,
    settings: getSettingsDB,
  };

  const getter = dbMap[dbName];
  if (!getter) {
    throw new Error(`Unknown database: ${dbName}`);
  }

  return getter();
}

/**
 * Validate that a document belongs to the correct shop
 */
export function validateShopId(doc: any, expectedShopId: string): boolean {
  return doc.shopId === expectedShopId;
}
