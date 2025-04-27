export let productsDB: PouchDB.Database;
export let salesDB: PouchDB.Database;
export let purchasesDB: PouchDB.Database;
export let cashInHandDB: PouchDB.Database;
export let ledgerDB: PouchDB.Database;

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
