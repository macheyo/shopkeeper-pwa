"use client";

import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { UserDoc } from "@/types";
import { getUserByEmail, createUser, getUserById, updateUser } from "./usersDB";

// Password hashing
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Session management
const SESSION_KEY = "shopkeeper_session";
const SESSION_EXPIRY_DAYS = 30;

export interface SessionData {
  userId: string;
  email: string;
  shopId: string;
  role: UserDoc["role"];
  expiresAt: string;
  licenseKey?: string; // License key tied to this device
}

export function createSession(user: UserDoc, licenseKey?: string): SessionData {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  const session: SessionData = {
    userId: user.userId,
    email: user.email,
    shopId: user.shopId,
    role: user.role,
    expiresAt: expiresAt.toISOString(),
    ...(licenseKey && { licenseKey }),
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return session;
}

/**
 * Update session with license key
 */
export function updateSessionLicense(licenseKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const session = getSession();
    if (session) {
      session.licenseKey = licenseKey;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch (err) {
    console.error("Error updating session license:", err);
  }
}

export function getSession(): SessionData | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const sessionJson = localStorage.getItem(SESSION_KEY);
    if (!sessionJson) {
      return null;
    }

    const session: SessionData = JSON.parse(sessionJson);

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      clearSession();
      return null;
    }

    return session;
  } catch (err) {
    console.error("Error reading session:", err);
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}

// User credentials storage (encrypted in PouchDB)
export interface UserCredentials {
  _id: string; // credentials_{userId}
  _rev?: string;
  type: "credentials";
  userId: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

// Store credentials in usersDB
export async function storeCredentials(
  userId: string,
  email: string,
  password: string
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Cannot store credentials on server side");
  }

  const { getUsersDB } = await import("./usersDB");
  const db = await getUsersDB();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const credentials: UserCredentials = {
    _id: `credentials_${userId}`,
    type: "credentials",
    userId,
    email: email.toLowerCase(),
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Check if credentials already exist
    try {
      const existing = await db.get(credentials._id);
      credentials._rev = existing._rev;
    } catch {
      // Doesn't exist yet, that's fine
    }

    await db.put(credentials);
  } catch (err) {
    console.error("Error storing credentials:", err);
    throw new Error("Failed to store credentials");
  }
}

// Verify credentials
export async function verifyCredentials(
  email: string,
  password: string
): Promise<UserDoc | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const { getUsersDB } = await import("./usersDB");
  const db = await getUsersDB();

  try {
    // Find credentials by email
    const result = await db.find({
      selector: {
        type: "credentials",
        email: email.toLowerCase(),
      },
      limit: 1,
    });

    if (result.docs.length === 0) {
      return null;
    }

    const credentials = result.docs[0] as UserCredentials;
    const isValid = await verifyPassword(password, credentials.passwordHash);

    if (!isValid) {
      return null;
    }

    // Get user document
    const user = await getUserById(credentials.userId);
    if (!user || user.status !== "active") {
      return null;
    }

    // OPTIONAL: Validate against CouchDB if online (non-blocking)
    // This is optional - local auth works offline
    if (navigator.onLine) {
      try {
        const { validateUserAgainstCouchDB } = await import("./couchdbAuth");
        const couchdbValidation = await validateUserAgainstCouchDB(
          user,
          password
        );
        if (!couchdbValidation.valid) {
          console.warn(
            "CouchDB validation failed, but allowing local auth:",
            couchdbValidation.error
          );
          // Still allow login - fail open for offline-first
        }
      } catch (err) {
        // CouchDB validation failed - that's fine, use local auth
        console.warn("CouchDB validation error (non-critical):", err);
      }
    }

    // Update last login
    if (user) {
      user.lastLoginAt = new Date().toISOString();
      await updateUser(user);
    }

    return user;
  } catch (err) {
    console.error("Error verifying credentials:", err);
    return null;
  }
}

// Generate unique IDs
export function generateUserId(): string {
  return uuidv4();
}

export function generateShopId(): string {
  return uuidv4();
}

export function generateInviteId(): string {
  return uuidv4();
}

export function generateInviteToken(): string {
  return uuidv4() + "-" + uuidv4();
}
