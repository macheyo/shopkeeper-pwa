// src/types/pouchdb.d.ts
declare module "pouchdb-adapter-crypto";

// Add basic types for PouchDB info if not fully covered by @types
declare namespace PouchDB {
  interface DatabaseInfo {
    db_name: string;
    doc_count: number;
    update_seq: number | string; // Type can vary
    // Add other relevant properties if needed
  }
}
