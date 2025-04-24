export let productsDB: PouchDB.Database;
export let salesDB: PouchDB.Database;

export async function getProductsDB(): Promise<PouchDB.Database> {
  if (!productsDB) {
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
}

export async function getSalesDB(): Promise<PouchDB.Database> {
  try {
    if (!salesDB) {
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
        // Create an index with timestamp as the first field
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
