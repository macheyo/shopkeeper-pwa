export let productsDB: PouchDB.Database;
export let salesDB: PouchDB.Database;
export let purchasesDB: PouchDB.Database;
export let cashInHandDB: PouchDB.Database;
export let ledgerDB: PouchDB.Database;
export let inventoryLotsDB: PouchDB.Database;
export let eodDB: PouchDB.Database;

export async function getProductsDB(): Promise<PouchDB.Database> {
  try {
    if (!productsDB) {
      if (typeof window === "undefined") {
        throw new Error(
          "PouchDB operations are only supported in browser environment. For server-side operations, consider using a different database or API endpoints."
        );
      }

      // Browser environment
      const PouchDB = (await import("pouchdb-browser")).default;
      const PouchDBFind = await import("pouchdb-find");
      const crypto = await import("crypto-pouch");
      PouchDB.plugin(PouchDBFind.default);
      PouchDB.plugin(crypto.default);

      productsDB = new PouchDB("products");

      const DB_KEY = process.env.NEXT_PUBLIC_DB_KEY || "default-insecure-key";
      if (DB_KEY && DB_KEY !== "default-insecure-key") {
        await productsDB.crypto(DB_KEY);
      }
    }
    return productsDB;
  } catch (err) {
    console.error("Error initializing products database:", err);
    throw new Error(
      `Failed to initialize products database: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function getSalesDB(): Promise<PouchDB.Database> {
  try {
    if (!salesDB) {
      if (typeof window === "undefined") {
        throw new Error(
          "PouchDB operations are only supported in browser environment. For server-side operations, consider using a different database or API endpoints."
        );
      }

      // Browser environment
      const PouchDB = (await import("pouchdb-browser")).default;
      const PouchDBFind = await import("pouchdb-find");
      const crypto = await import("crypto-pouch");
      PouchDB.plugin(PouchDBFind.default);
      PouchDB.plugin(crypto.default);

      salesDB = new PouchDB("sales");

      const DB_KEY = process.env.NEXT_PUBLIC_DB_KEY || "default-insecure-key";
      if (DB_KEY && DB_KEY !== "default-insecure-key") {
        await salesDB.crypto(DB_KEY);
      }

      // Create an index for the timestamp field to enable sorting
      try {
        await salesDB.createIndex({
          index: {
            fields: ["timestamp", "type"],
            name: "sales_timestamp_index",
          },
        });
      } catch (err) {
        console.error("Error creating sales index:", err);
        // Don't throw here as the index might already exist
      }

      // Verify database is accessible
      await salesDB.info();
    }
    return salesDB;
  } catch (err) {
    console.error("Error initializing sales database:", err);
    throw new Error(
      `Failed to initialize sales database: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function getCashInHandDB(): Promise<PouchDB.Database> {
  try {
    if (!cashInHandDB) {
      if (typeof window === "undefined") {
        throw new Error(
          "PouchDB operations are only supported in browser environment. For server-side operations, consider using a different database or API endpoints."
        );
      }

      // Browser environment
      const PouchDB = (await import("pouchdb-browser")).default;
      const PouchDBFind = await import("pouchdb-find");
      const crypto = await import("crypto-pouch");
      PouchDB.plugin(PouchDBFind.default);
      PouchDB.plugin(crypto.default);

      cashInHandDB = new PouchDB("cash_in_hand");

      const DB_KEY = process.env.NEXT_PUBLIC_DB_KEY || "default-insecure-key";
      if (DB_KEY && DB_KEY !== "default-insecure-key") {
        await cashInHandDB.crypto(DB_KEY);
      }

      // Create an index for the timestamp field
      try {
        await cashInHandDB.createIndex({
          index: {
            fields: ["timestamp", "type"],
            name: "cash_in_hand_timestamp_index",
          },
        });
      } catch (err) {
        console.error("Error creating cash in hand index:", err);
        // Don't throw here as the index might already exist
      }

      // Verify database is accessible
      await cashInHandDB.info();
    }
    return cashInHandDB;
  } catch (err) {
    console.error("Error initializing cash in hand database:", err);
    throw new Error(
      `Failed to initialize cash in hand database: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function getLedgerDB(): Promise<PouchDB.Database> {
  try {
    if (!ledgerDB) {
      if (typeof window === "undefined") {
        throw new Error(
          "PouchDB operations are only supported in browser environment. For server-side operations, consider using a different database or API endpoints."
        );
      }

      // Browser environment
      const PouchDB = (await import("pouchdb-browser")).default;
      const PouchDBFind = await import("pouchdb-find");
      const crypto = await import("crypto-pouch");
      PouchDB.plugin(PouchDBFind.default);
      PouchDB.plugin(crypto.default);

      ledgerDB = new PouchDB("ledger");

      const DB_KEY = process.env.NEXT_PUBLIC_DB_KEY || "default-insecure-key";
      if (DB_KEY && DB_KEY !== "default-insecure-key") {
        await ledgerDB.crypto(DB_KEY);
      }

      // Create indexes for timestamp and transaction type
      try {
        await ledgerDB.createIndex({
          index: {
            fields: ["timestamp", "type", "transactionType", "status"],
            name: "ledger_timestamp_index",
          },
        });
      } catch (err) {
        console.error("Error creating ledger index:", err);
        // Don't throw here as the index might already exist
      }

      // Verify database is accessible
      await ledgerDB.info();
    }
    return ledgerDB;
  } catch (err) {
    console.error("Error initializing ledger database:", err);
    throw new Error(
      `Failed to initialize ledger database: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function getPurchasesDB(): Promise<PouchDB.Database> {
  try {
    if (!purchasesDB) {
      if (typeof window === "undefined") {
        throw new Error(
          "PouchDB operations are only supported in browser environment. For server-side operations, consider using a different database or API endpoints."
        );
      }

      // Browser environment
      const PouchDB = (await import("pouchdb-browser")).default;
      const PouchDBFind = await import("pouchdb-find");
      const crypto = await import("crypto-pouch");
      PouchDB.plugin(PouchDBFind.default);
      PouchDB.plugin(crypto.default);

      purchasesDB = new PouchDB("purchases");

      const DB_KEY = process.env.NEXT_PUBLIC_DB_KEY || "default-insecure-key";
      if (DB_KEY && DB_KEY !== "default-insecure-key") {
        await purchasesDB.crypto(DB_KEY);
      }

      // Create indexes for timestamp and purchase run
      try {
        await purchasesDB.createIndex({
          index: {
            fields: ["timestamp", "type", "purchaseRunId"],
            name: "purchases_timestamp_index",
          },
        });
      } catch (err) {
        console.error("Error creating purchases index:", err);
        // Don't throw here as the index might already exist
      }

      // Verify database is accessible
      await purchasesDB.info();
    }
    return purchasesDB;
  } catch (err) {
    console.error("Error initializing purchases database:", err);
    throw new Error(
      `Failed to initialize purchases database: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function getInventoryLotsDB(): Promise<PouchDB.Database> {
  try {
    if (!inventoryLotsDB) {
      if (typeof window === "undefined") {
        throw new Error(
          "PouchDB operations are only supported in browser environment. For server-side operations, consider using a different database or API endpoints."
        );
      }

      // Browser environment
      const PouchDB = (await import("pouchdb-browser")).default;
      const PouchDBFind = await import("pouchdb-find");
      const crypto = await import("crypto-pouch");
      PouchDB.plugin(PouchDBFind.default);
      PouchDB.plugin(crypto.default);

      inventoryLotsDB = new PouchDB("inventory_lots");

      const DB_KEY = process.env.NEXT_PUBLIC_DB_KEY || "default-insecure-key";
      if (DB_KEY && DB_KEY !== "default-insecure-key") {
        await inventoryLotsDB.crypto(DB_KEY);
      }

      // Create indexes for product and purchase run queries
      try {
        // Index for querying by productId with remainingQuantity filter
        await inventoryLotsDB.createIndex({
          index: {
            fields: ["type", "productId", "remainingQuantity"],
            name: "inventory_lots_product_index",
          },
        });
        // Index for querying by purchaseRunId
        await inventoryLotsDB.createIndex({
          index: {
            fields: ["type", "purchaseRunId"],
            name: "inventory_lots_purchase_run_index",
          },
        });
      } catch (err) {
        console.error("Error creating inventory lots index:", err);
        // Don't throw here as the index might already exist
      }

      // Verify database is accessible
      await inventoryLotsDB.info();
    }
    return inventoryLotsDB;
  } catch (err) {
    console.error("Error initializing inventory lots database:", err);
    throw new Error(
      `Failed to initialize inventory lots database: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function getEODDB(): Promise<PouchDB.Database> {
  try {
    if (!eodDB) {
      if (typeof window === "undefined") {
        throw new Error(
          "PouchDB operations are only supported in browser environment. For server-side operations, consider using a different database or API endpoints."
        );
      }

      // Browser environment
      const PouchDB = (await import("pouchdb-browser")).default;
      const PouchDBFind = await import("pouchdb-find");
      const crypto = await import("crypto-pouch");
      PouchDB.plugin(PouchDBFind.default);
      PouchDB.plugin(crypto.default);

      eodDB = new PouchDB("eod_cash_records");

      const DB_KEY = process.env.NEXT_PUBLIC_DB_KEY || "default-insecure-key";
      if (DB_KEY && DB_KEY !== "default-insecure-key") {
        await eodDB.crypto(DB_KEY);
      }

      // Create indexes for date and status queries
      try {
        await eodDB.createIndex({
          index: {
            fields: ["type", "date", "status"],
            name: "eod_date_index",
          },
        });
        await eodDB.createIndex({
          index: {
            fields: ["type", "shopId", "date"],
            name: "eod_shop_date_index",
          },
        });
      } catch (err) {
        console.error("Error creating EOD index:", err);
        // Don't throw here as the index might already exist
      }

      // Verify database is accessible
      await eodDB.info();
    }
    return eodDB;
  } catch (err) {
    console.error("Error initializing EOD database:", err);
    throw new Error(
      `Failed to initialize EOD database: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}
