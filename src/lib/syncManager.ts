"use client";

import {
  CouchDBConfig,
  getRemoteDB,
  getLocalDB,
  validateShopId,
} from "./couchdb";
import { UserDoc } from "@/types";

/**
 * Sync status for a single database
 */
export interface DatabaseSyncStatus {
  dbName: string;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingChanges: number;
  conflicts: number;
  error: string | null;
  direction?: "push" | "pull" | "idle";
}

/**
 * Overall sync status
 */
export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  databases: Record<string, DatabaseSyncStatus>;
  error: string | null;
}

/**
 * Sync event types
 */
export type SyncEventType =
  | "change"
  | "paused"
  | "active"
  | "error"
  | "complete";

export interface SyncEvent {
  type: SyncEventType;
  dbName: string;
  data?: unknown;
  error?: Error;
  syncedDocumentIds?: string[]; // IDs of documents that were synced
  direction?: "push" | "pull";
}

/**
 * Sync Manager - Handles PouchDB to CouchDB synchronization
 */
export class SyncManager {
  private syncHandles: Map<
    string,
    PouchDB.Replication.Sync<Record<string, never>>
  > = new Map();
  private syncStatus: Map<string, DatabaseSyncStatus> = new Map();
  private eventListeners: Array<(event: SyncEvent) => void> = [];
  private config: CouchDBConfig | null = null;
  private user: UserDoc | null = null;

  /**
   * Initialize sync manager with configuration
   * Tries to get user-specific CouchDB config, falls back to shop-level
   */
  async initialize(user: UserDoc): Promise<void> {
    this.user = user;

    // Try to get user-specific CouchDB config
    const { getCouchDBConfigForUser } = await import("./couchdbAuth");
    const config = await getCouchDBConfigForUser(user);

    if (!config) {
      throw new Error("CouchDB not configured for this shop/user");
    }

    this.config = config;

    // Validate shopId matches
    if (user.shopId !== config.shopId) {
      throw new Error("Shop ID mismatch between user and config");
    }
  }

  // Removed permission checks - sync all data for the shop

  /**
   * Sync all databases
   */
  async syncAll(): Promise<void> {
    if (!this.config || !this.user) {
      throw new Error("SyncManager not initialized. Call initialize() first.");
    }

    // Define databases list first
    const databases = [
      "products",
      "sales",
      "purchases",
      "ledger",
      "inventory_lots",
      "cash_in_hand",
      "eod_cash_records",
      "settings",
      "users",
    ];

    // First, ensure all databases exist on CouchDB
    try {
      const { ensureAllDatabasesExist } = await import("./couchdbSecurity");
      const result = await ensureAllDatabasesExist(
        this.config.shopId,
        this.config
      );

      if (result.failed.length > 0) {
        console.warn(
          `Some databases failed to create: ${result.failed.join(", ")}`
        );
      }

      if (result.created.length > 0) {
        console.log(
          `Ensured ${
            result.created.length
          } databases exist: ${result.created.join(", ")}`
        );
      }
    } catch (err) {
      console.error("Error ensuring databases exist:", err);
      // Continue with sync anyway - databases might be created lazily
    }

    // Check local database contents before syncing
    for (const dbName of databases) {
      try {
        const localDB = await getLocalDB(dbName);
        const allDocs = await localDB.allDocs({ include_docs: false });
        const docCount = allDocs.rows.length;
        console.log(
          `Local ${dbName} database has ${docCount} document(s) to sync`
        );
      } catch (err) {
        console.error(`Error checking local ${dbName} database:`, err);
      }
    }

    // Start syncing all databases in parallel
    console.log(`[SYNC] Starting sync for ${databases.length} databases...`);

    const syncPromises = databases.map(async (dbName) => {
      try {
        console.log(`[SYNC] Attempting to sync database: ${dbName}`);
        await this.syncDatabase(dbName);
        console.log(`[SYNC] ✅ Sync handle created successfully for ${dbName}`);
        return { dbName, success: true };
      } catch (error) {
        console.error(`[SYNC] ❌ Error syncing ${dbName}:`, error);
        console.error(`[SYNC] Error details:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        this.updateStatus(dbName, {
          error: error instanceof Error ? error.message : String(error),
        });
        return { dbName, success: false, error };
      }
    });

    // Wait for all sync attempts to complete (or fail)
    const results = await Promise.allSettled(syncPromises);

    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && !r.value.success)
    ).length;

    console.log(
      `[SYNC] ✅ Sync initiation complete. Successful: ${successful}, Failed: ${failed}, Total: ${databases.length}`
    );
  }

  /**
   * Sync individual database
   */
  async syncDatabase(
    dbName: string
  ): Promise<PouchDB.Replication.Sync<Record<string, never>>> {
    if (!this.config || !this.user) {
      throw new Error("SyncManager not initialized. Call initialize() first.");
    }

    // Check if already syncing
    if (this.syncHandles.has(dbName)) {
      console.log(
        `[SYNC] ${dbName} already has active sync, reusing existing handle`
      );
      return this.syncHandles.get(dbName)!;
    }

    console.log(`[SYNC] Creating new sync for ${dbName}...`);

    // Note: We sync all data for the shop, regardless of user permissions
    // Shop isolation is still enforced via shopId validation

    // Get local and remote databases
    let localDB: PouchDB.Database;
    let remoteDB: PouchDB.Database;

    try {
      localDB = await getLocalDB(dbName);
    } catch (err) {
      console.error(`[SYNC] Failed to get local database ${dbName}:`, err);
      throw new Error(
        `Failed to get local database ${dbName}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // Use shop-specific sync user if available, otherwise fall back to admin credentials
    const syncConfig: CouchDBConfig = this.config.syncUsername
      ? {
          ...this.config,
          username: this.config.syncUsername,
          password: this.config.syncPassword || this.config.password,
        }
      : this.config;

    try {
      remoteDB = await getRemoteDB(dbName, syncConfig);
      console.log(
        `[SYNC] Remote database connection established for ${dbName}`
      );
    } catch (err) {
      console.error(`[SYNC] Failed to get remote database ${dbName}:`, err);
      throw new Error(
        `Failed to get remote database ${dbName}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // Initialize status
    this.updateStatus(dbName, {
      isSyncing: true,
      error: null,
    });

    // Track retry count for this database
    let retryCount = 0;
    const maxRetries = 5; // Stop retrying after 5 failures

    // Create sync - PouchDB sync is bidirectional
    // We'll validate shopId in handleSyncChange instead of using filter
    // Filter functions don't work well with sync, they're for replication
    const sync = localDB
      .sync(remoteDB, {
        live: true, // Continuous sync
        retry: true, // Retry on failure (but we limit retries in error handler)
        back_off_function: (delay) => {
          retryCount++;
          // Stop retrying after max retries
          if (retryCount > maxRetries) {
            console.log(`[SYNC] ${dbName}: Max retries (${maxRetries}) reached, stopping sync`);
            // Cancel the sync by returning a very long delay
            // This effectively stops retries without breaking PouchDB
            return 999999999;
          }
          // Exponential backoff for retries, max 30 seconds
          const newDelay = Math.min(delay * 2, 30000);
          console.log(`[SYNC] ${dbName}: Retry ${retryCount}/${maxRetries}, next attempt in ${newDelay}ms`);
          return newDelay;
        },
        // Don't use filter - validate in handleSyncChange instead
      })
      .on("change", (info) => {
        console.log(`[SYNC] Change event in ${dbName}:`, {
          direction: info.direction,
          change: info.change?.docs?.length || 0,
          docs:
            info.change?.docs?.map((d: { _id?: string }) => d._id || "") || [],
        });
        this.handleSyncChange(dbName, info);
      })
      .on("paused", () => {
        this.updateStatus(dbName, { isSyncing: false });
        this.emitEvent({
          type: "paused",
          dbName,
        });
      })
      .on("active", () => {
        this.updateStatus(dbName, { isSyncing: true });
        this.emitEvent({
          type: "active",
          dbName,
        });
      })
      .on("error", (err) => {
        console.error(`Sync error in ${dbName}:`, err);
        
        // Check if we've exceeded max retries
        if (retryCount > maxRetries) {
          console.log(`[SYNC] ${dbName}: Stopping sync due to persistent errors`);
          // Cancel and remove the sync handle
          this.stopDatabase(dbName);
        }
        
        this.updateStatus(dbName, {
          isSyncing: false,
          error: (err as Error)?.message || String(err),
        });
        this.emitEvent({
          type: "error",
          dbName,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      })
      .on("complete", () => {
        this.updateStatus(dbName, {
          isSyncing: false,
          lastSyncAt: new Date().toISOString(),
        });

        // Post-sync validation: scan for any cross-shop documents
        this.validateShopIsolation(dbName).catch((err) => {
          console.error(`Post-sync validation error for ${dbName}:`, err);
        });

        this.emitEvent({
          type: "complete",
          dbName,
        });
      });

    this.syncHandles.set(dbName, sync);
    return sync;
  }

  /**
   * Handle sync change event
   */
  private handleSyncChange(
    dbName: string,
    info: PouchDB.Replication.SyncResult<Record<string, never>>
  ): void {
    if (!this.config || !this.user) return;

    const direction = info.direction;
    let pendingChanges = 0;
    let conflicts = 0;
    const securityViolations: string[] = [];

    // Validate incoming documents (pull direction)
    if (direction === "pull" && info.change && info.change.docs) {
      for (const doc of info.change.docs) {
        // Skip design documents
        if (doc._id && doc._id.startsWith("_design/")) {
          continue;
        }

        // Validate shopId - but be lenient for documents that might not have shopId yet
        // Only reject if shopId exists and doesn't match
        if (
          doc.shopId &&
          !validateShopId(doc as { shopId?: string }, this.config.shopId)
        ) {
          const violation = `Security: Rejected document from different shop in ${dbName}: ${doc._id}`;
          console.error(violation);
          securityViolations.push(doc._id);

          // Try to remove the document from local database
          this.removeCrossShopDocument(dbName, doc._id).catch((err) => {
            console.error(
              `Failed to remove cross-shop document ${doc._id}:`,
              err
            );
          });
        }
      }
    }

    // Log outgoing documents (push direction) for debugging
    const syncedDocumentIds: string[] = [];
    if (direction === "push" && info.change && info.change.docs) {
      console.log(
        `Pushing ${info.change.docs.length} documents to ${dbName} in CouchDB`
      );
      for (const doc of info.change.docs) {
        if (!doc._id.startsWith("_design/")) {
          console.log(
            `  → Pushing: ${doc._id} (shopId: ${doc.shopId || "none"})`
          );
          syncedDocumentIds.push(doc._id);
        }
      }
    }

    // Count pending changes
    if (info.change && info.change.docs) {
      pendingChanges = info.change.docs.length;
    }

    // Count conflicts and attempt auto-resolution
    if (info.change && info.change.docs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conflictedDocs = (info.change.docs as any[]).filter(
        (doc: { _conflicts?: string[] }) =>
          doc._conflicts && doc._conflicts.length > 0
      );
      conflicts = conflictedDocs.length;

      // Attempt to resolve conflicts automatically
      if (conflictedDocs.length > 0) {
        this.resolveConflicts(dbName, conflictedDocs).catch((err) => {
          console.error(`Error resolving conflicts in ${dbName}:`, err);
        });
      }
    }

    // Update status with security violations info
    const errorMessage =
      securityViolations.length > 0
        ? `Security violations detected: ${securityViolations.length} cross-shop documents removed`
        : null;

    // Update status - clear pending changes after a successful push
    const statusUpdate: Partial<DatabaseSyncStatus> = {
      direction: direction as "push" | "pull" | "idle",
      conflicts,
      error: errorMessage,
    };

    // For push operations, update lastSyncAt and clear pending changes
    if (direction === "push" && syncedDocumentIds.length > 0) {
      statusUpdate.lastSyncAt = new Date().toISOString();
      statusUpdate.pendingChanges = 0; // Cleared after successful push
    } else {
      statusUpdate.pendingChanges = pendingChanges;
    }

    this.updateStatus(dbName, statusUpdate);

    this.emitEvent({
      type: "change",
      dbName,
      data: info,
      syncedDocumentIds:
        syncedDocumentIds.length > 0 ? syncedDocumentIds : undefined,
      direction: direction as "push" | "pull",
    });

    // Log for debugging
    if (syncedDocumentIds.length > 0) {
      console.log(
        `[SYNC] Emitted change event for ${dbName} with ${syncedDocumentIds.length} synced documents:`,
        syncedDocumentIds
      );
    }
  }

  /**
   * Remove a cross-shop document from local database
   */
  private async removeCrossShopDocument(
    dbName: string,
    docId: string
  ): Promise<void> {
    try {
      const localDB = await getLocalDB(dbName);
      const doc = await localDB.get(docId);
      await localDB.remove(doc);
      console.log(`Removed cross-shop document ${docId} from ${dbName}`);
    } catch (err) {
      // Document might not exist or already removed
      const error = err as { status?: number };
      if (error.status !== 404) {
        throw err;
      }
    }
  }

  /**
   * Resolve conflicts automatically using "last write wins" strategy
   * For shop-specific conflicts, prefer local version if it has correct shopId
   */
  private async resolveConflicts(
    dbName: string,
    conflictedDocs: Array<{
      _id?: string;
      _rev?: string;
      _conflicts?: string[];
      [key: string]: unknown;
    }>
  ): Promise<void> {
    if (!this.config) return;

    const localDB = await getLocalDB(dbName);

    for (const doc of conflictedDocs) {
      try {
        if (!doc._id) {
          continue;
        }
        // Get the document with all revisions
        const docWithRevs = await localDB.get(doc._id, {
          revs: true,
          revs_info: true,
        });

        if (!docWithRevs._conflicts || docWithRevs._conflicts.length === 0) {
          continue;
        }

        // Get all conflict revisions
        if (!docWithRevs._rev || !doc._id) {
          continue;
        }
        const allRevs = [docWithRevs._rev, ...(docWithRevs._conflicts || [])];
        const allDocs = await Promise.all(
          allRevs.map((rev) => {
            if (!rev) return null;
            return localDB.get(doc._id!, { rev }).catch(() => null);
          })
        );

        // Filter out nulls and validate shopId
        const validDocs = allDocs.filter((d) => {
          if (!d) return false;
          return validateShopId(d as { shopId?: string }, this.config!.shopId);
        });

        if (validDocs.length === 0) {
          // No valid documents - delete it
          await localDB.remove(docWithRevs);
          continue;
        }

        // Use "last write wins" - prefer document with most recent timestamp
        // If timestamps are equal, prefer the one with correct shopId
        const sortedDocs = validDocs.sort((a, b) => {
          const aDoc = a as {
            updatedAt?: string;
            createdAt?: string;
            timestamp?: string;
          };
          const bDoc = b as {
            updatedAt?: string;
            createdAt?: string;
            timestamp?: string;
          };
          const aTime =
            aDoc.updatedAt || aDoc.createdAt || aDoc.timestamp || "0";
          const bTime =
            bDoc.updatedAt || bDoc.createdAt || bDoc.timestamp || "0";
          return bTime.localeCompare(aTime);
        });

        const winningDoc = sortedDocs[0];

        // Remove conflicts by updating with winning revision
        await localDB.put({
          ...winningDoc,
          _rev: docWithRevs._rev, // Use current revision
        });

        // Delete conflict revisions
        for (const conflictRev of docWithRevs._conflicts) {
          try {
            const conflictDoc = await localDB.get(doc._id, {
              rev: conflictRev,
            });
            await localDB.remove(conflictDoc);
          } catch (err) {
            // Conflict revision might already be deleted
            const error = err as { status?: number };
            if (error.status !== 404) {
              console.error(`Error removing conflict revision:`, err);
            }
          }
        }

        console.log(`Resolved conflict for ${doc._id} in ${dbName}`);
      } catch (err) {
        console.error(`Error resolving conflict for ${doc._id}:`, err);
        // Continue with other conflicts
      }
    }
  }

  /**
   * Update sync status for a database
   */
  private updateStatus(
    dbName: string,
    updates: Partial<DatabaseSyncStatus>
  ): void {
    const current = this.syncStatus.get(dbName) || {
      dbName,
      isSyncing: false,
      lastSyncAt: null,
      pendingChanges: 0,
      conflicts: 0,
      error: null,
    };

    this.syncStatus.set(dbName, {
      ...current,
      ...updates,
    });
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    const databases: Record<string, DatabaseSyncStatus> = {};
    this.syncStatus.forEach((status, dbName) => {
      databases[dbName] = status;
    });

    const isSyncing = Array.from(this.syncStatus.values()).some(
      (s) => s.isSyncing
    );

    const lastSyncAt =
      Array.from(this.syncStatus.values())
        .map((s) => s.lastSyncAt)
        .filter((d): d is string => d !== null)
        .sort()
        .reverse()[0] || null;

    const errors = Array.from(this.syncStatus.values())
      .map((s) => s.error)
      .filter((e): e is string => e !== null);

    return {
      isSyncing,
      lastSyncAt,
      databases,
      error: errors.length > 0 ? errors.join("; ") : null,
    };
  }

  /**
   * Get status for a specific database
   */
  getDatabaseStatus(dbName: string): DatabaseSyncStatus | null {
    return this.syncStatus.get(dbName) || null;
  }

  /**
   * Stop syncing a specific database
   */
  stopDatabase(dbName: string): void {
    const sync = this.syncHandles.get(dbName);
    if (sync) {
      sync.cancel();
      this.syncHandles.delete(dbName);
      this.updateStatus(dbName, {
        isSyncing: false,
      });
    }
  }

  /**
   * Stop all syncs
   */
  stopAll(): void {
    this.syncHandles.forEach((sync) => sync.cancel());
    this.syncHandles.clear();
    this.syncStatus.forEach((status, dbName) => {
      this.updateStatus(dbName, {
        isSyncing: false,
      });
    });
  }

  /**
   * Add event listener
   */
  onEvent(listener: (event: SyncEvent) => void): () => void {
    this.eventListeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Post-sync validation: Scan database for cross-shop documents
   */
  private async validateShopIsolation(dbName: string): Promise<void> {
    if (!this.config) return;

    try {
      const localDB = await getLocalDB(dbName);

      // Get all documents (with pagination for large databases)
      const result = await localDB.allDocs({
        include_docs: true,
        limit: 1000, // Process in batches
      });

      const violations: string[] = [];

      for (const row of result.rows) {
        const doc = row.doc;
        if (!doc) continue;

        // Skip design documents
        if (doc._id && doc._id.startsWith("_design/")) {
          continue;
        }

        // Validate shopId
        if (!validateShopId(doc as { shopId?: string }, this.config.shopId)) {
          violations.push(doc._id);
          // Remove cross-shop document
          await this.removeCrossShopDocument(dbName, doc._id);
        }
      }

      if (violations.length > 0) {
        console.warn(
          `Post-sync validation: Removed ${violations.length} cross-shop documents from ${dbName}`
        );
        this.updateStatus(dbName, {
          error: `Security: ${violations.length} cross-shop documents removed`,
        });
      }
    } catch (err) {
      console.error(`Error validating shop isolation for ${dbName}:`, err);
      // Don't throw - validation is best effort
    }
  }

  /**
   * Emit sync event
   */
  private emitEvent(event: SyncEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in sync event listener:", error);
      }
    });
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

/**
 * Get the global sync manager instance
 */
export function getSyncManager(): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
  }
  return syncManagerInstance;
}
