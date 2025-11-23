"use client"; // Mark as client-only code

// Don't import PouchDB at the top level to avoid server-side issues
export let settingsDB: PouchDB.Database;
let settingsDBPromise: Promise<PouchDB.Database> | null = null;
let pouchDBInitialized = false;
let pouchDBInitPromise: Promise<void> | null = null;

export interface ShopSettings {
  _id: string;
  _rev?: string;
  type: "settings";
  shopName: string;
  businessType: string;
  baseCurrency: string;
  currencies: {
    code: string;
    exchangeRate: number;
  }[];
  accounts: {
    id: string;
    name: string;
    type: "cash" | "mobile_money" | "bank";
    balance: number;
    currency: string;
  }[];
  hasCompletedOnboarding: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getSettingsDB(): Promise<PouchDB.Database> {
  // If database is already initialized, return it
  if (settingsDB) {
    return settingsDB;
  }

  // If initialization is in progress, wait for it
  if (settingsDBPromise) {
    return settingsDBPromise;
  }

  // Start initialization
  settingsDBPromise = (async () => {
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
            if (!(PouchDB as any).__pluginsRegistered) {
              PouchDB.plugin(PouchDBFind.default);
              PouchDB.plugin(crypto.default);
              (PouchDB as any).__pluginsRegistered = true;
            }
            pouchDBInitialized = true;
          })();
          await pouchDBInitPromise;
        }
      }

      // Dynamically import PouchDB (plugins are already registered)
      const PouchDB = (await import("pouchdb-browser")).default;
      settingsDB = new PouchDB("settings");

      const DB_KEY = process.env.NEXT_PUBLIC_DB_KEY || "default-insecure-key";
      if (DB_KEY && DB_KEY !== "default-insecure-key") {
        await settingsDB.crypto(DB_KEY);
      }

      // Create index for type field
      try {
        await settingsDB.createIndex({
          index: {
            fields: ["type"],
            name: "settings_type_index",
          },
        });
      } catch (err) {
        console.error("Error creating settings index:", err);
      }

      // Verify database is accessible
      await settingsDB.info();

      return settingsDB;
    } catch (err) {
      // Reset promise on error so it can be retried
      settingsDBPromise = null;
      console.error("Error initializing settings database:", err);
      throw new Error(
        `Failed to initialize settings database: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  })();

  return settingsDBPromise;
}

export async function getShopSettings(): Promise<ShopSettings | null> {
  try {
    // Only run in browser environment
    if (typeof window === "undefined") {
      return getDefaultSettings();
    }

    const db = await getSettingsDB();
    const result = await db.find({
      selector: { type: "settings" },
      limit: 1,
    });

    const doc = result.docs[0] as PouchDB.Core.ExistingDocument<
      Omit<ShopSettings, "_id" | "_rev">
    >;
    return doc
      ? { ...doc, _id: doc._id, _rev: doc._rev }
      : getDefaultSettings();
  } catch (err) {
    console.error("Error fetching shop settings:", err);
    return getDefaultSettings();
  }
}

// Return default settings if running on server or if error occurs
function getDefaultSettings(): ShopSettings {
  return {
    _id: "shop_settings",
    type: "settings",
    shopName: "Default Shop",
    businessType: "retail",
    baseCurrency: "USD",
    currencies: [
      { code: "USD", exchangeRate: 1 },
      { code: "EUR", exchangeRate: 0.85 },
    ],
    accounts: [],
    hasCompletedOnboarding: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function saveShopSettings(
  settings: Omit<ShopSettings, "_id">
): Promise<ShopSettings> {
  try {
    // Only run in browser environment
    if (typeof window === "undefined") {
      throw new Error("Cannot save settings on server side");
    }

    const db = await getSettingsDB();
    const doc = {
      _id: "shop_settings",
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    try {
      const existing = await db.get("shop_settings");
      (doc as PouchDB.Core.Document<typeof doc>)._rev = existing._rev;
    } catch {
      // Document doesn't exist yet
    }

    const result = await db.put(doc);
    return {
      ...doc,
      _id: result.id,
    } as ShopSettings;
  } catch (err) {
    console.error("Error saving shop settings:", err);
    throw new Error(
      `Failed to save shop settings: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}
