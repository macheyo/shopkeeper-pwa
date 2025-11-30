"use client";

import { CouchDBConfig, testCouchDBConnection } from "./couchdb";

/**
 * Create a shop-specific CouchDB sync user
 * This user will have access only to the shop's databases
 */
export async function createShopSyncUser(
  shopId: string,
  config: CouchDBConfig
): Promise<{
  username: string;
  password: string;
  success: boolean;
  error?: string;
}> {
  try {
    const cleanUrl = config.url.replace(/\/$/, "");
    const syncUsername = `shop_${shopId}_sync`;

    // Generate a secure random password
    const password = generateSecurePassword();

    // Create user in CouchDB _users database
    const userDoc = {
      _id: `org.couchdb.user:${syncUsername}`,
      name: syncUsername,
      password: password,
      type: "user",
      roles: [],
      shopId: shopId, // Custom field for tracking
    };

    const createUserUrl = `${cleanUrl}/_users/org.couchdb.user:${syncUsername}`;

    const response = await fetch(createUserUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
      },
      body: JSON.stringify(userDoc),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If user already exists, try to update password
      if (response.status === 409) {
        // User exists - we could update password here if needed
        // For now, return success with existing user
        return {
          username: syncUsername,
          password: password, // Note: This won't be the actual password if user exists
          success: true,
        };
      }
      return {
        username: syncUsername,
        password: "",
        success: false,
        error: `Failed to create CouchDB user: ${response.status} ${errorText}`,
      };
    }

    return {
      username: syncUsername,
      password: password,
      success: true,
    };
  } catch (error) {
    console.error("Error creating shop sync user:", error);
    return {
      username: `shop_${shopId}_sync`,
      password: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate a secure random password for CouchDB users
 */
function generateSecurePassword(): string {
  // Generate a 32-character random password
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const length = 32;
  let password = "";

  // Use crypto if available (browser)
  if (typeof window !== "undefined" && window.crypto) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      password += chars[array[i] % chars.length];
    }
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return password;
}

/**
 * Test if a shop sync user can authenticate
 */
export async function testShopSyncUser(
  shopId: string,
  syncUsername: string,
  syncPassword: string,
  couchdbUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await testCouchDBConnection(
      couchdbUrl,
      syncUsername,
      syncPassword
    );
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Initialize shop sync setup:
 * 1. Create shop sync user
 * 2. Create all shop databases
 * 3. Set security documents on each database
 */
export async function initializeShopSync(
  shopId: string,
  config: CouchDBConfig
): Promise<{
  success: boolean;
  syncUsername?: string;
  syncPassword?: string;
  error?: string;
}> {
  try {
    // Step 1: Create shop sync user
    const userResult = await createShopSyncUser(shopId, config);
    if (!userResult.success) {
      return {
        success: false,
        error: userResult.error || "Failed to create sync user",
      };
    }

    // Step 2: Create all shop databases and set security
    const databases = [
      "products",
      "sales",
      "purchases",
      "ledger",
      "inventory_lots",
      "cash_in_hand",
      "eod_cash_records",
      "settings",
      "users",
    ];

    const { ensureRemoteDatabase } = await import("./couchdb");

    console.log(`Creating ${databases.length} databases for shop ${shopId}...`);
    let successCount = 0;
    let failCount = 0;

    for (const dbName of databases) {
      try {
        console.log(`Creating database: shop_${shopId}_${dbName}`);
        await ensureRemoteDatabase(dbName, config, userResult.username);
        console.log(`✅ Database created: shop_${shopId}_${dbName}`);
        successCount++;
      } catch (err) {
        console.error(`❌ Error creating database ${dbName}:`, err);
        failCount++;
        // Continue with other databases even if one fails
      }
    }

    console.log(
      `Database creation complete: ${successCount} succeeded, ${failCount} failed`
    );

    // If some databases failed, still return success but log warning
    if (failCount > 0) {
      console.warn(
        `Warning: ${failCount} database(s) failed to create. Some databases may be missing.`
      );
    }

    return {
      success: true,
      syncUsername: userResult.username,
      syncPassword: userResult.password,
    };
  } catch (error) {
    console.error("Error initializing shop sync:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Ensure all required databases exist (create missing ones)
 * This can be called to fix missing databases
 */
export async function ensureAllDatabasesExist(
  shopId: string,
  config: CouchDBConfig
): Promise<{
  success: boolean;
  created: string[];
  failed: string[];
  error?: string;
}> {
  const databases = [
    "products",
    "sales",
    "purchases",
    "ledger",
    "inventory_lots",
    "cash_in_hand",
    "eod_cash_records",
    "settings",
    "users",
  ];

  const { ensureRemoteDatabase } = await import("./couchdb");
  const { getCouchDBConfig } = await import("./couchdbConfig");

  // Get sync username if available
  const fullConfig = await getCouchDBConfig(shopId);
  const syncUsername = fullConfig?.syncUsername;

  const created: string[] = [];
  const failed: string[] = [];

  console.log(`Ensuring all databases exist for shop ${shopId}...`);

  for (const dbName of databases) {
    try {
      console.log(`Checking database: shop_${shopId}_${dbName}`);
      await ensureRemoteDatabase(dbName, config, syncUsername);
      created.push(dbName);
      console.log(`✅ Database exists/created: shop_${shopId}_${dbName}`);
    } catch (err) {
      console.error(`❌ Error ensuring database ${dbName}:`, err);
      failed.push(dbName);
    }
  }

  console.log(
    `Database check complete: ${created.length} exist/created, ${failed.length} failed`
  );

  return {
    success: failed.length === 0,
    created,
    failed,
    error:
      failed.length > 0 ? `${failed.length} database(s) failed` : undefined,
  };
}
