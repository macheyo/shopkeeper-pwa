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
  data?: any;
  error?: Error;
}

/**
 * Sync Manager - Handles PouchDB to CouchDB synchronization
 */
export class SyncManager {
  private syncHandles: Map<string, PouchDB.Replication.Sync<{}>> = new Map();
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

    const databases = [
      "products",
      "sales",
      "purchases",
      "ledger",
      "inventory_lots",
      "cash_in_hand",
      "settings",
      "users",
    ];

    for (const dbName of databases) {
      try {
        await this.syncDatabase(dbName);
      } catch (error) {
        console.error(`Error syncing ${dbName}:`, error);
        this.updateStatus(dbName, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Sync individual database
   */
  async syncDatabase(dbName: string): Promise<PouchDB.Replication.Sync<{}>> {
    if (!this.config || !this.user) {
      throw new Error("SyncManager not initialized. Call initialize() first.");
    }

    // Check if already syncing
    if (this.syncHandles.has(dbName)) {
      return this.syncHandles.get(dbName)!;
    }

    // Note: We sync all data for the shop, regardless of user permissions
    // Shop isolation is still enforced via shopId validation

    // Get local and remote databases
    const localDB = await getLocalDB(dbName);
    const remoteDB = await getRemoteDB(dbName, this.config);

    // Initialize status
    this.updateStatus(dbName, {
      isSyncing: true,
      error: null,
    });

    // Create sync with filter to only sync documents for this shop
    const sync = localDB
      .sync(remoteDB, {
        live: true, // Continuous sync
        retry: true, // Retry on failure
        // Filter function to only sync documents belonging to this shop
        filter: (doc: any) => {
          // Always allow design documents
          if (doc._id && doc._id.startsWith("_design/")) {
            return true;
          }
          // Validate shopId for all other documents
          return validateShopId(doc, this.config!.shopId);
        },
      })
      .on("change", (info) => {
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
        this.updateStatus(dbName, {
          isSyncing: false,
          error: err.message || String(err),
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
    info: PouchDB.Replication.SyncResult<{}>
  ): void {
    if (!this.config || !this.user) return;

    const direction = info.direction;
    let pendingChanges = 0;
    let conflicts = 0;

    // Validate incoming documents (pull direction)
    if (direction === "pull" && info.change && info.change.docs) {
      for (const doc of info.change.docs) {
        // Skip design documents
        if (doc._id && doc._id.startsWith("_design/")) {
          continue;
        }

        // Validate shopId
        if (!validateShopId(doc, this.config.shopId)) {
          console.error(
            `Security: Rejected document from different shop in ${dbName}:`,
            doc._id
          );
          // Note: PouchDB will still sync it, but we log the security issue
          // In production, you might want to delete such documents
        }
      }
    }

    // Count pending changes
    if (info.change && info.change.docs) {
      pendingChanges = info.change.docs.length;
    }

    // Count conflicts
    if (info.change && info.change.docs) {
      conflicts = info.change.docs.filter(
        (doc: any) => doc._conflicts && doc._conflicts.length > 0
      ).length;
    }

    this.updateStatus(dbName, {
      direction: direction as "push" | "pull" | "idle",
      pendingChanges,
      conflicts,
    });

    this.emitEvent({
      type: "change",
      dbName,
      data: info,
    });
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
