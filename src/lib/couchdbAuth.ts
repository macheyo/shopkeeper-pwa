"use client";

import { UserDoc } from "@/types";
import { CouchDBConfig, testCouchDBConnection } from "./couchdb";
import { getCouchDBConfig } from "./couchdbConfig";

/**
 * CouchDB user credentials stored per user
 */
export interface CouchDBUserCredentials {
  _id: string; // couchdb_user_{userId}
  _rev?: string;
  type: "couchdb_user_credentials";
  userId: string;
  shopId: string;
  couchdbUsername: string; // CouchDB username (usually email or userId)
  couchdbPassword?: string; // Encrypted CouchDB password
  couchdbUrl?: string; // CouchDB URL (can be shop-level or user-specific)
  lastValidatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Store CouchDB user credentials
 */
export async function storeCouchDBUserCredentials(
  userId: string,
  shopId: string,
  couchdbUsername: string,
  couchdbPassword: string,
  couchdbUrl?: string
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Cannot store credentials on server side");
  }

  const { getUsersDB } = await import("./usersDB");
  const db = await getUsersDB();
  const now = new Date().toISOString();

  // Get shop-level CouchDB URL if not provided
  if (!couchdbUrl) {
    const shopConfig = await getCouchDBConfig(shopId);
    if (shopConfig) {
      couchdbUrl = shopConfig.url;
    }
  }

  const credentials: CouchDBUserCredentials = {
    _id: `couchdb_user_${userId}`,
    type: "couchdb_user_credentials",
    userId,
    shopId,
    couchdbUsername,
    couchdbPassword, // In production, encrypt this
    couchdbUrl,
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Check if exists
    try {
      const existing = await db.get(credentials._id);
      credentials._rev = existing._rev;
    } catch {
      // Doesn't exist yet
    }

    await db.put(credentials);
  } catch (err) {
    console.error("Error storing CouchDB user credentials:", err);
    throw new Error("Failed to store CouchDB credentials");
  }
}

/**
 * Get CouchDB user credentials
 */
export async function getCouchDBUserCredentials(
  userId: string
): Promise<CouchDBUserCredentials | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const { getUsersDB } = await import("./usersDB");
    const db = await getUsersDB();
    const doc = await db.get(`couchdb_user_${userId}`);
    return doc as CouchDBUserCredentials;
  } catch (err: any) {
    if (err.status === 404) {
      return null;
    }
    console.error("Error getting CouchDB user credentials:", err);
    return null;
  }
}

/**
 * Validate local user credentials against CouchDB (when online)
 * This is optional - local auth still works offline
 */
export async function validateUserAgainstCouchDB(
  user: UserDoc,
  password: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Get shop-level CouchDB config
    const shopConfig = await getCouchDBConfig(user.shopId);
    if (!shopConfig) {
      // No CouchDB configured - that's fine, use local auth only
      return { valid: true };
    }

    // Get user's CouchDB credentials
    const userCreds = await getCouchDBUserCredentials(user.userId);

    // If user has CouchDB credentials, validate against CouchDB
    if (userCreds && userCreds.couchdbUrl) {
      const result = await testCouchDBConnection(
        userCreds.couchdbUrl,
        userCreds.couchdbUsername,
        password // Use the password from login attempt
      );

      if (result.success) {
        // Update last validated timestamp
        userCreds.lastValidatedAt = new Date().toISOString();
        userCreds.updatedAt = new Date().toISOString();
        const { getUsersDB } = await import("./usersDB");
        const db = await getUsersDB();
        await db.put(userCreds);

        return { valid: true };
      } else {
        return { valid: false, error: result.error };
      }
    }

    // No CouchDB credentials for user - that's fine, use local auth
    return { valid: true };
  } catch (error) {
    // If CouchDB validation fails, fall back to local auth
    console.warn("CouchDB validation failed, using local auth:", error);
    return { valid: true }; // Fail open - allow local auth
  }
}

/**
 * Create CouchDB user when user registers
 * This ensures CouchDB user exists for sync
 */
export async function createCouchDBUser(
  user: UserDoc,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get shop-level CouchDB config
    const shopConfig = await getCouchDBConfig(user.shopId);
    if (!shopConfig) {
      // No CouchDB configured - that's fine, skip creation
      return { success: true };
    }

    // Create CouchDB user
    // CouchDB username format: {shopId}_{userId} or just email
    const couchdbUsername = `${user.shopId}_${user.userId}`;

    // Use shop admin credentials to create user
    const createUserUrl = `${shopConfig.url.replace(
      /\/$/,
      ""
    )}/_users/org.couchdb.user:${couchdbUsername}`;

    const response = await fetch(createUserUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(
          `${shopConfig.username}:${shopConfig.password}`
        )}`,
      },
      body: JSON.stringify({
        _id: `org.couchdb.user:${couchdbUsername}`,
        name: couchdbUsername,
        password: password,
        type: "user",
        roles: [], // User roles in CouchDB
        shopId: user.shopId, // Custom field
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If user already exists, that's fine
      if (response.status === 409) {
        return { success: true };
      }
      return {
        success: false,
        error: `Failed to create CouchDB user: ${response.status} ${errorText}`,
      };
    }

    // Store user's CouchDB credentials locally
    await storeCouchDBUserCredentials(
      user.userId,
      user.shopId,
      couchdbUsername,
      password,
      shopConfig.url
    );

    return { success: true };
  } catch (error) {
    console.error("Error creating CouchDB user:", error);
    // Don't fail registration if CouchDB user creation fails
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get CouchDB config for a specific user (for sync)
 * Falls back to shop-level config if user-specific not available
 */
export async function getCouchDBConfigForUser(
  user: UserDoc
): Promise<CouchDBConfig | null> {
  // Try user-specific credentials first
  const userCreds = await getCouchDBUserCredentials(user.userId);
  if (userCreds && userCreds.couchdbUrl && userCreds.couchdbPassword) {
    return {
      url: userCreds.couchdbUrl,
      username: userCreds.couchdbUsername,
      password: userCreds.couchdbPassword,
      shopId: user.shopId,
    };
  }

  // Fall back to shop-level config
  const shopConfig = await getCouchDBConfig(user.shopId);
  if (shopConfig) {
    // Use shop-level credentials but with user's shopId
    return {
      ...shopConfig,
      shopId: user.shopId,
    };
  }

  return null;
}


