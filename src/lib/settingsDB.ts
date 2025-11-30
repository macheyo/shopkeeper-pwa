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
  shopId?: string; // Shop identifier for multi-user support
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

export async function getShopSettings(
  shopId?: string
): Promise<ShopSettings | null> {
  try {
    // Only run in browser environment
    if (typeof window === "undefined") {
      return getDefaultSettings();
    }

    const db = await getSettingsDB();

    // Build selector with shopId filter if provided
    const selector: { type: string; shopId?: string } = { type: "settings" };
    if (shopId) {
      selector.shopId = shopId;
    }

    const result = await db.find({
      selector,
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
  settings: Partial<ShopSettings> & { shopId?: string }
): Promise<ShopSettings> {
  try {
    // Only run in browser environment
    if (typeof window === "undefined") {
      throw new Error("Cannot save settings on server side");
    }

    const db = await getSettingsDB();

    // Use shopId in _id if provided, otherwise use default
    const docId = settings.shopId
      ? `shop_settings_${settings.shopId}`
      : "shop_settings";

    // Retry logic for handling conflicts
    let retries = 3;
    let lastError: Error | null = null;

    while (retries > 0) {
      try {
        // Always get the latest version of the document
        let existing: PouchDB.Core.ExistingDocument<ShopSettings> | null = null;
        try {
          existing = await db.get(docId);
        } catch {
          // Document doesn't exist yet, that's fine
        }

        // Extract only the data fields (exclude _id and _rev from input)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, _rev, ...settingsData } = settings as ShopSettings & {
          _id?: string;
          _rev?: string;
        };

        // Merge existing settings with new settings
        const mergedSettings: ShopSettings = {
          ...(existing || getDefaultSettings()),
          ...settingsData,
          _id: docId,
          _rev: existing?._rev, // Always use the latest _rev from the database
          updatedAt: new Date().toISOString(),
        };

        // Ensure required fields are present
        if (!mergedSettings.type) {
          mergedSettings.type = "settings";
        }
        if (!mergedSettings.createdAt && !existing) {
          mergedSettings.createdAt = new Date().toISOString();
        }

        const result = await db.put(mergedSettings);

        // Return the saved document
        const saved = await db.get(result.id);
        return saved as ShopSettings;
      } catch (err: unknown) {
        lastError = err as Error | null;
        // If it's a conflict error and we have retries left, try again
        if ((err as { status?: number })?.status === 409 && retries > 1) {
          retries--;
          // Wait a bit before retrying (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * (4 - retries))
          );
          continue;
        }
        // If it's not a conflict or we're out of retries, throw
        throw err;
      }
    }

    // If we exhausted retries, throw the last error
    throw lastError || new Error("Failed to save shop settings after retries");
  } catch (err) {
    console.error("Error saving shop settings:", err);
    throw new Error(
      `Failed to save shop settings: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}
