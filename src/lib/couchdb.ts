"use client";


/**
 * CouchDB connection configuration
 */
export interface CouchDBConfig {
  url: string; // e.g., "http://localhost:5984" or "https://your-couchdb-instance.cloudant.com"
  username: string; // Admin username (for creating users/databases)
  password: string; // Admin password
  shopId: string;
  syncUsername?: string; // Shop-specific sync user (shop_{shopId}_sync)
  syncPassword?: string; // Shop-specific sync password (encrypted)
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
    
    // Check for mixed content issues
    const mixedContentError = checkMixedContent(cleanUrl);
    if (mixedContentError) {
      return {
        success: false,
        error: mixedContentError,
      };
    }

    // Test connection with CouchDB session endpoint
    // Include credentials for CORS if needed
    const response = await fetch(`${cleanUrl}/_session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include credentials for CORS
      body: JSON.stringify({
        name: username,
        password: password,
      }),
    });

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        errorText = response.statusText;
      }
      return {
        success: false,
        error: `Authentication failed: ${response.status} ${response.statusText}. ${errorText}`,
      };
    }

    let data: { userCtx?: { name?: string; roles?: string[] }; name?: string; roles?: string[] };
    try {
      data = await response.json();
    } catch (err) {
      return {
        success: false,
        error: `Invalid response from server: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      };
    }

    // Validate response structure
    // CouchDB _session endpoint can return different formats:
    // 1. { ok: true, name: "...", roles: [...] } - direct response
    // 2. { ok: true, userCtx: { name: "...", roles: [...] } } - session response
    if (!data || (!data.name && !data.userCtx)) {
      return {
        success: false,
        error: `Invalid response format from CouchDB. Expected name or userCtx but got: ${JSON.stringify(
          data
        )}`,
      };
    }

    const cookie = response.headers.get("Set-Cookie");

    // Handle both response formats
    const userName = data.userCtx?.name || data.name || username;
    const userRoles = data.userCtx?.roles || data.roles || [];

    return {
      success: true,
      session: {
        name: userName,
        roles: userRoles,
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
 * Check for mixed content issues (HTTPS page -> HTTP CouchDB)
 * Returns error message if mixed content detected, null otherwise
 */
function checkMixedContent(url: string): string | null {
  // Check if we're on HTTPS
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  
  // If page is HTTPS and CouchDB URL is HTTP, we have mixed content
  if (isHttps && url.startsWith("http://")) {
    return (
      `Mixed Content Error: Your app is served over HTTPS, but CouchDB URL uses HTTP.\n` +
      `Browsers block HTTP requests from HTTPS pages for security.\n\n` +
      `Solutions:\n` +
      `1. Use HTTPS for CouchDB: Change URL to https://34.32.91.162:5984 (requires SSL certificate)\n` +
      `2. Use a reverse proxy (nginx/traefik) that terminates SSL in front of CouchDB\n` +
      `3. Use a CouchDB service with HTTPS support (e.g., Cloudant, CouchDB Cloud)\n\n` +
      `Current URL: ${url}`
    );
  }
  
  return null;
}

/**
 * Get remote CouchDB database connection
 * Uses basic auth for PouchDB replication
 * Automatically handles mixed content (HTTPS page -> HTTP CouchDB)
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
  
  // Check for mixed content issues
  const mixedContentError = checkMixedContent(cleanUrl);
  if (mixedContentError) {
    throw new Error(mixedContentError);
  }

  // Database naming: shop_{shopId}_{databaseName} (for better isolation)
  const remoteDBName = `shop_${config.shopId}_${localDBName}`;
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
 * Set security document on a CouchDB database
 * This ensures only authorized users can access the database
 */
export async function setDatabaseSecurity(
  localDBName: string,
  config: CouchDBConfig,
  syncUsername: string
): Promise<void> {
  try {
    const cleanUrl = config.url.replace(/\/$/, "");
    const remoteDBName = `shop_${config.shopId}_${localDBName}`;
    const securityUrl = `${cleanUrl}/${remoteDBName}/_security`;

    const securityDoc = {
      admins: {
        names: [], // No admin users - use roles or admin credentials
        roles: [],
      },
      members: {
        names: [syncUsername], // Only sync user can access
        roles: [],
      },
    };

    const response = await fetch(securityUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
      },
      body: JSON.stringify(securityDoc),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If database doesn't exist yet, that's okay - we'll create it first
      if (response.status === 404) {
        return;
      }
      throw new Error(
        `Failed to set security document: ${response.status} ${errorText}`
      );
    }
  } catch (error) {
    console.error(`Error setting security for ${localDBName}:`, error);
    // Don't throw - security document setting is best effort
    // The database will still work, just without explicit security
  }
}

/**
 * Ensure remote database exists (create if it doesn't) and set security
 */
export async function ensureRemoteDatabase(
  localDBName: string,
  config: CouchDBConfig,
  syncUsername?: string
): Promise<void> {
  try {
    // Check for mixed content before attempting connection
    const cleanUrl = config.url.replace(/\/$/, "");
    const mixedContentError = checkMixedContent(cleanUrl);
    if (mixedContentError) {
      throw new Error(mixedContentError);
    }
    
    const remoteDB = await getRemoteDB(localDBName, config);
    // Try to get database info - this will create it if it doesn't exist
    await remoteDB.info();

    // Set security document if syncUsername is provided
    if (syncUsername) {
      await setDatabaseSecurity(localDBName, config, syncUsername);
    }
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
    getEODDB,
  } = await import("./databases");
  const { getUsersDB } = await import("./usersDB");
  const { getSettingsDB } = await import("./settingsDB");

  const dbMap: Record<string, () => Promise<PouchDB.Database>> = {
    products: getProductsDB,
    sales: getSalesDB,
    purchases: getPurchasesDB,
    cash_in_hand: getCashInHandDB,
    eod_cash_records: getEODDB,
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
export function validateShopId(doc: { shopId?: string }, expectedShopId: string): boolean {
  return doc.shopId === expectedShopId;
}
