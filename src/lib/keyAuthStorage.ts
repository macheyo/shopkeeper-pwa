"use client";

import { getUsersDB } from "./usersDB";

/**
 * Key authentication data stored in PouchDB or localStorage
 */
export interface KeyAuthData {
  _id?: string; // key_auth_{userId} (for PouchDB)
  _rev?: string; // (for PouchDB)
  type?: "key_auth"; // (for PouchDB)
  userId: string;
  shopId: string;
  keyHash: string; // Derived key hash (not the master key!)
  salt: string; // Salt used for key derivation
  createdAt: string;
  updatedAt: string;
}

const LOCALSTORAGE_KEY_PREFIX = "key_auth_";

/**
 * Store key authentication data
 * Stores in BOTH PouchDB (if available) and localStorage (fallback)
 */
export async function storeKeyAuthData(
  userId: string,
  shopId: string,
  keyHash: string,
  salt: string
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Cannot store key auth data on server side");
  }

  const now = new Date().toISOString();

  const keyAuth: KeyAuthData = {
    userId,
    shopId,
    keyHash,
    salt,
    createdAt: now,
    updatedAt: now,
  };

  // Store in localStorage (always works, no dependency)
  const localStorageKey = `${LOCALSTORAGE_KEY_PREFIX}${userId}`;
  try {
    localStorage.setItem(localStorageKey, JSON.stringify(keyAuth));
  } catch (err) {
    console.error("Error storing in localStorage:", err);
    // Continue - localStorage might be full, but we'll try PouchDB
  }

  // Also store in PouchDB if available (for sync/backup)
  try {
    const db = await getUsersDB();
    const pouchDoc: KeyAuthData = {
      _id: `key_auth_${userId}`,
      type: "key_auth",
      ...keyAuth,
    };

    try {
      if (!pouchDoc._id) {
        throw new Error("Document _id is required");
      }
      const existing = await db.get(pouchDoc._id);
      pouchDoc._rev = existing._rev;
      pouchDoc.createdAt = (existing as KeyAuthData).createdAt;
    } catch {
      // Doesn't exist yet
    }

    await db.put(pouchDoc);
  } catch (err) {
    // PouchDB unavailable - that's fine, we have localStorage
    console.warn("PouchDB unavailable, using localStorage only:", err);
  }
}

/**
 * Get key authentication data for a user
 * Tries localStorage first (fast, no dependency), then PouchDB (for sync)
 */
export async function getKeyAuthData(
  userId: string
): Promise<KeyAuthData | null> {
  if (typeof window === "undefined") {
    return null;
  }

  // Try localStorage first (no dependency, instant)
  const localStorageKey = `${LOCALSTORAGE_KEY_PREFIX}${userId}`;
  try {
    const stored = localStorage.getItem(localStorageKey);
    if (stored) {
      const keyAuth = JSON.parse(stored) as KeyAuthData;
      return keyAuth;
    }
  } catch (err) {
    console.warn("Error reading from localStorage:", err);
    // Continue to try PouchDB
  }

  // Fallback to PouchDB (if available)
  try {
    const db = await getUsersDB();
    const doc = await db.get(`key_auth_${userId}`);
    const keyAuth = doc as KeyAuthData;

    // Also sync to localStorage for faster access next time
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(keyAuth));
    } catch {
      // localStorage might be full, that's fine
    }

    return keyAuth;
  } catch (err: unknown) {
    const error = err as { status?: number };
    if (error.status === 404) {
      return null;
    }
    // PouchDB unavailable - that's fine, we tried localStorage first
    console.warn("PouchDB unavailable:", err);
    return null;
  }
}

/**
 * Check if user has key authentication enabled
 */
export async function hasKeyAuth(userId: string): Promise<boolean> {
  const keyAuth = await getKeyAuthData(userId);
  return keyAuth !== null;
}

/**
 * Delete key authentication data
 * Deletes from BOTH localStorage and PouchDB
 */
export async function deleteKeyAuthData(userId: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Cannot delete key auth data on server side");
  }

  // Delete from localStorage
  const localStorageKey = `${LOCALSTORAGE_KEY_PREFIX}${userId}`;
  try {
    localStorage.removeItem(localStorageKey);
  } catch (err) {
    console.warn("Error deleting from localStorage:", err);
  }

  // Delete from PouchDB if available
  try {
    const db = await getUsersDB();
    const doc = await db.get(`key_auth_${userId}`);
    await db.remove(doc);
  } catch (err: unknown) {
    const error = err as { status?: number };
    if (error.status === 404) {
      // Doesn't exist, that's fine
      return;
    }
    // PouchDB unavailable - that's fine, we deleted from localStorage
    console.warn("PouchDB unavailable, deleted from localStorage only:", err);
  }
}
