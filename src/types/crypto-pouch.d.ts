// src/types/crypto-pouch.d.ts
declare module "crypto-pouch" {
  const plugin: PouchDB.Plugin;
  export default plugin;
}

// Augment PouchDB Database interface
declare namespace PouchDB {
  interface Database {
    /**
     * Enables encryption for the database instance.
     * @param password The password to use for encryption.
     * @param options Optional configuration (using unknown since crypto-pouch options are not well-documented).
     */
    crypto(password: string, options?: unknown): void;
  }
}
