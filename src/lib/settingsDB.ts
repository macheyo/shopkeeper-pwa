import PouchDB from "pouchdb-browser";
import PouchDBFind from "pouchdb-find";
import crypto from "crypto-pouch";

export let settingsDB: PouchDB.Database;

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
  try {
    if (!settingsDB) {
      if (typeof window === "undefined") {
        throw new Error(
          "PouchDB operations are only supported in browser environment."
        );
      }

      PouchDB.plugin(PouchDBFind);
      PouchDB.plugin(crypto);

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
    }
    return settingsDB;
  } catch (err) {
    console.error("Error initializing settings database:", err);
    throw new Error(
      `Failed to initialize settings database: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function getShopSettings(): Promise<ShopSettings | null> {
  try {
    const db = await getSettingsDB();
    const result = await db.find({
      selector: { type: "settings" },
      limit: 1,
    });

    const doc = result.docs[0] as PouchDB.Core.ExistingDocument<
      Omit<ShopSettings, "_id" | "_rev">
    >;
    return doc ? { ...doc, _id: doc._id, _rev: doc._rev } : null;
  } catch (err) {
    console.error("Error fetching shop settings:", err);
    return null;
  }
}

export async function saveShopSettings(
  settings: Omit<ShopSettings, "_id">
): Promise<ShopSettings> {
  try {
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
