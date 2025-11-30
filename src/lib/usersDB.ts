"use client";

import { UserDoc, InvitationDoc, ShopDoc } from "@/types";

// Don't import PouchDB at the top level to avoid server-side issues
export let usersDB: PouchDB.Database;
let usersDBPromise: Promise<PouchDB.Database> | null = null;
let pouchDBInitialized = false;
let pouchDBInitPromise: Promise<void> | null = null;

export async function getUsersDB(): Promise<PouchDB.Database> {
  // If database is already initialized, return it
  if (usersDB) {
    return usersDB;
  }

  // If initialization is in progress, wait for it
  if (usersDBPromise) {
    return usersDBPromise;
  }

  // Start initialization
  usersDBPromise = (async () => {
    try {
      // This is a browser-only module
      if (typeof window === "undefined") {
        throw new Error(
          "PouchDB operations are only supported in browser environment."
        );
      }

      // Initialize PouchDB plugins only once (shared across all databases)
      if (!pouchDBInitialized) {
        if (pouchDBInitPromise) {
          await pouchDBInitPromise;
        } else {
          pouchDBInitPromise = (async () => {
            const PouchDB = (await import("pouchdb-browser")).default;
            const PouchDBFind = await import("pouchdb-find");
            const crypto = await import("crypto-pouch");

            // Only register plugins if not already registered
            if (
              !(PouchDB as { __pluginsRegistered?: boolean })
                .__pluginsRegistered
            ) {
              PouchDB.plugin(PouchDBFind.default);
              PouchDB.plugin(crypto.default);
              (
                PouchDB as { __pluginsRegistered?: boolean }
              ).__pluginsRegistered = true;
            }
            pouchDBInitialized = true;
          })();
          await pouchDBInitPromise;
        }
      }

      // Dynamically import PouchDB (plugins are already registered)
      const PouchDB = (await import("pouchdb-browser")).default;
      usersDB = new PouchDB("users");

      const DB_KEY = process.env.NEXT_PUBLIC_DB_KEY || "default-insecure-key";
      if (DB_KEY && DB_KEY !== "default-insecure-key") {
        await usersDB.crypto(DB_KEY);
      }

      // Create indexes for efficient querying
      try {
        await usersDB.createIndex({
          index: {
            fields: ["type", "shopId"],
            name: "users_type_shop_index",
          },
        });
        await usersDB.createIndex({
          index: {
            fields: ["type", "email"],
            name: "users_type_email_index",
          },
        });
        await usersDB.createIndex({
          index: {
            fields: ["type", "phoneNumber"],
            name: "users_type_phone_index",
          },
        });
        await usersDB.createIndex({
          index: {
            fields: ["type", "userId"],
            name: "users_type_userId_index",
          },
        });
      } catch (err) {
        console.error("Error creating users indexes:", err);
      }

      // Verify database is accessible
      await usersDB.info();

      return usersDB;
    } catch (err) {
      // Reset promise on error so it can be retried
      usersDBPromise = null;
      console.error("Error initializing users database:", err);
      throw new Error(
        `Failed to initialize users database: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  })();

  return usersDBPromise;
}

/**
 * Get user by userId
 */
export async function getUserById(userId: string): Promise<UserDoc | null> {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const db = await getUsersDB();
    const result = await db.find({
      selector: {
        type: "user",
        userId: userId,
      },
      limit: 1,
    });

    return result.docs.length > 0 ? (result.docs[0] as UserDoc) : null;
  } catch (err) {
    console.error("Error fetching user:", err);
    return null;
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<UserDoc | null> {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const db = await getUsersDB();
    const result = await db.find({
      selector: {
        type: "user",
        email: email.toLowerCase(),
      },
      limit: 1,
    });

    return result.docs.length > 0 ? (result.docs[0] as UserDoc) : null;
  } catch (err) {
    console.error("Error fetching user by email:", err);
    return null;
  }
}

/**
 * Get user by phone number
 */
export async function getUserByPhoneNumber(
  phoneNumber: string
): Promise<UserDoc | null> {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const db = await getUsersDB();
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    const result = await db.find({
      selector: {
        type: "user",
        phoneNumber: normalizedPhone,
      },
      limit: 1,
    });

    return result.docs.length > 0 ? (result.docs[0] as UserDoc) : null;
  } catch (err) {
    console.error("Error fetching user by phone number:", err);
    return null;
  }
}

/**
 * Get all users for a shop
 */
export async function getShopUsers(shopId: string): Promise<UserDoc[]> {
  try {
    if (typeof window === "undefined") {
      return [];
    }

    const db = await getUsersDB();
    const result = await db.find({
      selector: {
        type: "user",
        shopId: shopId,
      },
    });

    return result.docs as UserDoc[];
  } catch (err) {
    console.error("Error fetching shop users:", err);
    return [];
  }
}

/**
 * Create a new user
 */
export async function createUser(
  user: Omit<UserDoc, "_id" | "_rev" | "createdAt" | "updatedAt">
): Promise<UserDoc> {
  try {
    if (typeof window === "undefined") {
      throw new Error("Cannot create user on server side");
    }

    const db = await getUsersDB();
    const now = new Date().toISOString();

    const userDoc: UserDoc = {
      ...user,
      _id: `user_${user.userId}`,
      type: "user",
      phoneNumber: user.phoneNumber?.replace(/[\s\-\(\)]/g, "") || "",
      email: user.email?.toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.put(userDoc);
    return {
      ...userDoc,
      _id: result.id,
      _rev: result.rev,
    };
  } catch (err) {
    console.error("Error creating user:", err);
    throw new Error(
      `Failed to create user: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Update user
 */
export async function updateUser(user: UserDoc): Promise<UserDoc> {
  try {
    if (typeof window === "undefined") {
      throw new Error("Cannot update user on server side");
    }

    const db = await getUsersDB();
    const updatedUser: UserDoc = {
      ...user,
      email: user.email?.toLowerCase(),
      updatedAt: new Date().toISOString(),
    };

    const result = await db.put(updatedUser);
    return {
      ...updatedUser,
      _rev: result.rev,
    };
  } catch (err) {
    console.error("Error updating user:", err);
    throw new Error(
      `Failed to update user: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(
  token: string
): Promise<InvitationDoc | null> {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const db = await getUsersDB();
    const result = await db.find({
      selector: {
        type: "invitation",
        token: token,
      },
      limit: 1,
    });

    return result.docs.length > 0 ? (result.docs[0] as InvitationDoc) : null;
  } catch (err) {
    console.error("Error fetching invitation:", err);
    return null;
  }
}

/**
 * Create invitation
 */
export async function createInvitation(
  invitation: Omit<InvitationDoc, "_id" | "_rev" | "createdAt">
): Promise<InvitationDoc> {
  try {
    if (typeof window === "undefined") {
      throw new Error("Cannot create invitation on server side");
    }

    const db = await getUsersDB();
    const invitationDoc: InvitationDoc = {
      ...invitation,
      _id: `invitation_${invitation.inviteId}`,
      type: "invitation",
      phoneNumber: invitation.phoneNumber.replace(/[\s\-\(\)]/g, ""), // Normalize phone number
      email: invitation.email?.toLowerCase(), // Optional, for backwards compatibility
      createdAt: new Date().toISOString(),
    };

    const result = await db.put(invitationDoc);
    return {
      ...invitationDoc,
      _id: result.id,
      _rev: result.rev,
    };
  } catch (err) {
    console.error("Error creating invitation:", err);
    throw new Error(
      `Failed to create invitation: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Update invitation
 */
export async function updateInvitation(
  invitation: InvitationDoc
): Promise<InvitationDoc> {
  try {
    if (typeof window === "undefined") {
      throw new Error("Cannot update invitation on server side");
    }

    const db = await getUsersDB();
    const result = await db.put(invitation);
    return {
      ...invitation,
      _rev: result.rev,
    };
  } catch (err) {
    console.error("Error updating invitation:", err);
    throw new Error(
      `Failed to update invitation: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Get shop by shopId
 */
export async function getShopById(shopId: string): Promise<ShopDoc | null> {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const db = await getUsersDB();
    const result = await db.find({
      selector: {
        type: "shop",
        shopId: shopId,
      },
      limit: 1,
    });

    return result.docs.length > 0 ? (result.docs[0] as ShopDoc) : null;
  } catch (err) {
    console.error("Error fetching shop:", err);
    return null;
  }
}

/**
 * Create shop
 */
export async function createShop(
  shop: Omit<ShopDoc, "_id" | "_rev" | "createdAt" | "updatedAt">
): Promise<ShopDoc> {
  try {
    if (typeof window === "undefined") {
      throw new Error("Cannot create shop on server side");
    }

    const db = await getUsersDB();
    const now = new Date().toISOString();

    const shopDoc: ShopDoc = {
      ...shop,
      _id: `shop_${shop.shopId}`,
      type: "shop",
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.put(shopDoc);
    return {
      ...shopDoc,
      _id: result.id,
      _rev: result.rev,
    };
  } catch (err) {
    console.error("Error creating shop:", err);
    throw new Error(
      `Failed to create shop: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Update shop
 */
export async function updateShop(shop: ShopDoc): Promise<ShopDoc> {
  try {
    if (typeof window === "undefined") {
      throw new Error("Cannot update shop on server side");
    }

    const db = await getUsersDB();
    const updatedShop: ShopDoc = {
      ...shop,
      updatedAt: new Date().toISOString(),
    };

    const result = await db.put(updatedShop);
    return {
      ...updatedShop,
      _rev: result.rev,
    };
  } catch (err) {
    console.error("Error updating shop:", err);
    throw new Error(
      `Failed to update shop: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}
