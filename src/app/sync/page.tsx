"use client";

import React, { useState, useEffect } from "react";
import {
  Title,
  Stack,
  Card,
  Text,
  Group,
  Button,
  Badge,
  TextInput,
  ActionIcon,
  SegmentedControl,
  Center,
  Box,
  Select,
  Collapse,
  Alert,
  Tabs,
} from "@mantine/core";
import {
  IconBrandWhatsapp,
  IconCloud,
  IconCheck,
  IconX,
  IconRefresh,
  IconSettings,
  IconAlertCircle,
} from "@tabler/icons-react";
import { getSalesDB, getPurchasesDB } from "@/lib/databases";
import { SaleDoc, PurchaseDoc } from "@/types";
import {
  formatMoney,
  createMoney,
  DEFAULT_EXCHANGE_RATES,
} from "@/types/money";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useAuth } from "@/contexts/AuthContext";
import { addShopIdFilter } from "@/lib/queryHelpers";
import { getSyncManager, SyncEvent, SyncStatus } from "@/lib/syncManager";
import {
  isCouchDBSyncEnabled,
  hasFirstSyncCompleted,
  markFirstSyncCompleted,
} from "@/lib/couchdbConfig";
import CouchDBConfigComponent from "@/components/CouchDBConfig";

interface SyncItem {
  id: string;
  type: "sale" | "purchase";
  timestamp: string;
  amount: number;
  status: "pending" | "synced" | "failed";
}

export default function SyncPage() {
  const { shop, currentUser } = useAuth();
  const { dateRangeInfo } = useDateFilter();
  const [items, setItems] = useState<SyncItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+254");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  // Default to CouchDB if enabled, otherwise WhatsApp
  const [syncMethod, setSyncMethod] = useState<"whatsapp" | "couchdb">(
    "couchdb"
  );

  // CouchDB sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [couchdbEnabled, setCouchdbEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Check if documents exist in CouchDB and mark them as synced
  const checkSyncStatusForTransactions = async (
    transactions: Array<{ id: string; type: "sale" | "purchase" }>
  ): Promise<void> => {
    if (!couchdbEnabled || !shop || !currentUser) return;

    try {
      const { getRemoteDB } = await import("@/lib/couchdb");
      const { getCouchDBConfigForUser } = await import("@/lib/couchdbAuth");
      const config = await getCouchDBConfigForUser(currentUser);

      if (!config) return;

      const salesDB = await getSalesDB();
      const purchasesDB = await getPurchasesDB();

      // Get remote databases
      const remoteSalesDB = await getRemoteDB("sales", config);
      const remotePurchasesDB = await getRemoteDB("purchases", config);

      // Check each transaction
      for (const transaction of transactions) {
        try {
          if (transaction.type === "sale") {
            // Check if sale exists in CouchDB
            try {
              await remoteSalesDB.get(transaction.id);
              // Document exists in CouchDB, mark as synced
              const sale = await salesDB.get(transaction.id).catch(() => null) as SaleDoc | null;
              if (sale && sale.status !== "synced") {
                await salesDB.put({ ...sale, status: "synced" });
                console.log(
                  `[SYNC] Marked existing sale ${transaction.id} as synced`
                );
              }
            } catch (err: unknown) {
              // Document doesn't exist in CouchDB (404), leave as pending
              const error = err as { status?: number };
              if (error.status !== 404) {
                console.error(
                  `Error checking sale ${transaction.id} in CouchDB:`,
                  err
                );
              }
            }
          } else {
            // Check if purchase exists in CouchDB
            try {
              await remotePurchasesDB.get(transaction.id);
              // Document exists in CouchDB, mark as synced
              const purchase = await purchasesDB
                .get(transaction.id)
                .catch(() => null) as PurchaseDoc | null;
              if (purchase && purchase.status !== "synced") {
                await purchasesDB.put({ ...purchase, status: "synced" });
                console.log(
                  `[SYNC] Marked existing purchase ${transaction.id} as synced`
                );
              }
            } catch (err: unknown) {
              // Document doesn't exist in CouchDB (404), leave as pending
              const error = err as { status?: number };
              if (error.status !== 404) {
                console.error(
                  `Error checking purchase ${transaction.id} in CouchDB:`,
                  err
                );
              }
            }
          }
        } catch (err) {
          console.error(
            `Error checking sync status for ${transaction.id}:`,
            err
          );
        }
      }
    } catch (err) {
      console.error("Error checking sync status for transactions:", err);
    }
  };

  // Fetch all sales and purchases within date range
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch sales
        const salesDB = await getSalesDB();
        const salesResult = await salesDB.find({
          selector: addShopIdFilter(
            {
              type: "sale",
              timestamp: {
                $gte: dateRangeInfo.startDate.toISOString(),
                $lte: dateRangeInfo.endDate.toISOString(),
              },
            },
            shop?.shopId
          ),
        });
        const sales = (salesResult.docs as SaleDoc[]).map((sale) => ({
          id: sale._id,
          type: "sale" as const,
          timestamp: sale.timestamp,
          amount: sale.totalAmount.amount,
          status: sale.status || "pending",
        }));

        // Fetch purchases
        const purchasesDB = await getPurchasesDB();
        const purchasesResult = await purchasesDB.find({
          selector: addShopIdFilter(
            {
              type: "purchase",
              timestamp: {
                $gte: dateRangeInfo.startDate.toISOString(),
                $lte: dateRangeInfo.endDate.toISOString(),
              },
            },
            shop?.shopId
          ),
        });
        const purchases = (purchasesResult.docs as PurchaseDoc[]).map(
          (purchase) => ({
            id: purchase._id,
            type: "purchase" as const,
            timestamp: purchase.timestamp,
            amount: purchase.totalAmount.amount,
            status: purchase.status || "pending",
          })
        );

        // Combine and sort by timestamp (most recent first)
        const allItems = [...sales, ...purchases].sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setItems(allItems);

        // Check which transactions are already synced to CouchDB
        if (couchdbEnabled && allItems.length > 0) {
          await checkSyncStatusForTransactions(allItems);

          // Re-fetch to get updated statuses
          const updatedSalesResult = await salesDB.find({
            selector: addShopIdFilter(
              {
                type: "sale",
                timestamp: {
                  $gte: dateRangeInfo.startDate.toISOString(),
                  $lte: dateRangeInfo.endDate.toISOString(),
                },
              },
              shop?.shopId
            ),
          });
          const updatedSales = (updatedSalesResult.docs as SaleDoc[]).map(
            (sale) => ({
              id: sale._id,
              type: "sale" as const,
              timestamp: sale.timestamp,
              amount: sale.totalAmount.amount,
              status: sale.status || "pending",
            })
          );

          const updatedPurchasesResult = await purchasesDB.find({
            selector: addShopIdFilter(
              {
                type: "purchase",
                timestamp: {
                  $gte: dateRangeInfo.startDate.toISOString(),
                  $lte: dateRangeInfo.endDate.toISOString(),
                },
              },
              shop?.shopId
            ),
          });
          const updatedPurchases = (
            updatedPurchasesResult.docs as PurchaseDoc[]
          ).map((purchase) => ({
            id: purchase._id,
            type: "purchase" as const,
            timestamp: purchase.timestamp,
            amount: purchase.totalAmount.amount,
            status: purchase.status || "pending",
          }));

          const updatedItems = [...updatedSales, ...updatedPurchases].sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

          setItems(updatedItems);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRangeInfo.startDate, dateRangeInfo.endDate, shop, couchdbEnabled, checkSyncStatusForTransactions]);

  // Check if CouchDB is enabled and set default sync method
  useEffect(() => {
    const checkCouchDB = async () => {
      if (!shop) return;
      const enabled = await isCouchDBSyncEnabled(shop.shopId);
      setCouchdbEnabled(enabled);
      // If CouchDB is enabled, default to CouchDB sync method to show sync status
      if (enabled) {
        setSyncMethod("couchdb");
      }
    };
    checkCouchDB();
  }, [shop]);

  // Setup sync status listener
  useEffect(() => {
    if (!couchdbEnabled || !shop || !currentUser) return;

    const syncManager = getSyncManager();

    // Update status periodically
    const updateStatus = () => {
      const status = syncManager.getStatus();
      setSyncStatus(status);
    };

    // Initial status
    updateStatus();
    const interval = setInterval(updateStatus, 2000);

    // Listen to sync events and update transaction status
    const unsubscribe = syncManager.onEvent((event: SyncEvent) => {
      updateStatus();
      if (event.type === "error" && event.error) {
        setSyncError(event.error.message);
      }

      // When documents are pushed to CouchDB, mark them as synced
      if (
        event.type === "change" &&
        event.direction === "push" &&
        event.syncedDocumentIds
      ) {
        const updateTransactionStatus = async () => {
          try {
            const salesDB = await getSalesDB();
            const purchasesDB = await getPurchasesDB();

            for (const docId of event.syncedDocumentIds || []) {
              // Try to update sale
              try {
                const sale = await salesDB.get(docId).catch(() => null) as SaleDoc | null;
                if (sale && sale.status !== "synced") {
                  await salesDB.put({ ...sale, status: "synced" });
                  console.log(`[SYNC] Marked sale ${docId} as synced`);
                }
              } catch {
                // Not a sale, try purchase
                try {
                  const purchase = await purchasesDB
                    .get(docId)
                    .catch(() => null) as PurchaseDoc | null;
                  if (purchase && purchase.status !== "synced") {
                    await purchasesDB.put({ ...purchase, status: "synced" });
                    console.log(`[SYNC] Marked purchase ${docId} as synced`);
                  }
                } catch {
                  // Not a sale or purchase, skip
                }
              }
            }

            // Refresh the items list
            const fetchData = async () => {
              const salesDB = await getSalesDB();
              const salesResult = await salesDB.find({
                selector: addShopIdFilter(
                  {
                    type: "sale",
                    timestamp: {
                      $gte: dateRangeInfo.startDate.toISOString(),
                      $lte: dateRangeInfo.endDate.toISOString(),
                    },
                  },
                  shop?.shopId
                ),
              });
              const sales = (salesResult.docs as SaleDoc[]).map((sale) => ({
                id: sale._id,
                type: "sale" as const,
                timestamp: sale.timestamp,
                amount: sale.totalAmount.amount,
                status: sale.status || "pending",
              }));

              const purchasesDB = await getPurchasesDB();
              const purchasesResult = await purchasesDB.find({
                selector: addShopIdFilter(
                  {
                    type: "purchase",
                    timestamp: {
                      $gte: dateRangeInfo.startDate.toISOString(),
                      $lte: dateRangeInfo.endDate.toISOString(),
                    },
                  },
                  shop?.shopId
                ),
              });
              const purchases = (purchasesResult.docs as PurchaseDoc[]).map(
                (purchase) => ({
                  id: purchase._id,
                  type: "purchase" as const,
                  timestamp: purchase.timestamp,
                  amount: purchase.totalAmount.amount,
                  status: purchase.status || "pending",
                })
              );

              const allItems = [...sales, ...purchases].sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime()
              );
              setItems(allItems);
            };

            fetchData();
          } catch (err) {
            console.error("Error updating transaction status:", err);
          }
        };

        updateTransactionStatus();
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [
    couchdbEnabled,
    shop,
    currentUser,
    dateRangeInfo.startDate,
    dateRangeInfo.endDate,
  ]);

  // Initialize sync manager and start auto-sync when CouchDB is enabled
  useEffect(() => {
    const initSync = async () => {
      if (!couchdbEnabled || !shop || !currentUser) return;

      try {
        const syncManager = getSyncManager();
        await syncManager.initialize(currentUser);

        // Check if first sync has been completed
        const firstSyncDone = await hasFirstSyncCompleted(shop.shopId);

        // Auto-start sync if first sync hasn't been done yet
        if (!firstSyncDone) {
          console.log(
            "First sync - starting automatic sync for all databases..."
          );
          await syncManager.syncAll();

          // Mark first sync as completed after a short delay (to allow sync to start)
          setTimeout(async () => {
            await markFirstSyncCompleted(shop.shopId);
            console.log("First sync completed and marked");
          }, 5000); // 5 seconds should be enough for sync to initialize
        } else {
          // For subsequent loads, just initialize - sync is live/continuous
          // The sync handles from previous sessions will resume automatically
          console.log("Sync manager initialized - existing syncs will resume");
        }
      } catch (error) {
        console.error("Error initializing sync:", error);
        setSyncError("Failed to initialize sync");
      }
    };

    initSync();
  }, [couchdbEnabled, shop, currentUser]);

  // Handle CouchDB sync
  const handleCouchDBSync = async (selectedItems: SyncItem[]) => {
    if (!shop || !currentUser) {
      setSyncError("Shop or user not found");
      return;
    }

    setSyncing(true);
    setSyncError(null);

    try {
      const syncManager = getSyncManager();
      await syncManager.initialize(currentUser);

      // Start syncing relevant databases
      if (selectedItems.some((item) => item.type === "sale")) {
        await syncManager.syncDatabase("sales");
      }
      if (selectedItems.some((item) => item.type === "purchase")) {
        await syncManager.syncDatabase("purchases");
      }

      // Wait a bit for sync to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mark items as synced
      const salesDB = await getSalesDB();
      const purchasesDB = await getPurchasesDB();

      for (const item of selectedItems) {
        try {
          if (item.type === "sale") {
            const sale = await salesDB.get(item.id) as SaleDoc;
            await salesDB.put({ ...sale, status: "synced" });
          } else {
            const purchase = await purchasesDB.get(item.id) as PurchaseDoc;
            await purchasesDB.put({ ...purchase, status: "synced" });
          }
        } catch (err) {
          console.error(`Error marking ${item.id} as synced:`, err);
        }
      }

      // Refresh items list
      const fetchData = async () => {
        const salesDB = await getSalesDB();
        const salesResult = await salesDB.find({
          selector: addShopIdFilter(
            {
              type: "sale",
              timestamp: {
                $gte: dateRangeInfo.startDate.toISOString(),
                $lte: dateRangeInfo.endDate.toISOString(),
              },
            },
            shop?.shopId
          ),
        });
        const sales = (salesResult.docs as SaleDoc[]).map((sale) => ({
          id: sale._id,
          type: "sale" as const,
          timestamp: sale.timestamp,
          amount: sale.totalAmount.amount,
          status: sale.status || "pending",
        }));

        const purchasesDB = await getPurchasesDB();
        const purchasesResult = await purchasesDB.find({
          selector: addShopIdFilter(
            {
              type: "purchase",
              timestamp: {
                $gte: dateRangeInfo.startDate.toISOString(),
                $lte: dateRangeInfo.endDate.toISOString(),
              },
            },
            shop?.shopId
          ),
        });
        const purchases = (purchasesResult.docs as PurchaseDoc[]).map(
          (purchase) => ({
            id: purchase._id,
            type: "purchase" as const,
            timestamp: purchase.timestamp,
            amount: purchase.totalAmount.amount,
            status: purchase.status || "pending",
          })
        );

        const allItems = [...sales, ...purchases].sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setItems(allItems);
      };

      await fetchData();
    } catch (err) {
      console.error("Error syncing with CouchDB:", err);
      setSyncError(
        err instanceof Error ? err.message : "Failed to sync with CouchDB"
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async (selectedItems: SyncItem[]) => {
    if (syncMethod === "whatsapp" && (!whatsappNumber || !countryCode)) {
      alert("Please enter a WhatsApp number and select a country code");
      return;
    }

    try {
      // TODO: Implement actual sync logic
      if (syncMethod === "whatsapp") {
        // Format detailed message for WhatsApp
        const message =
          `*Business Summary*\n\n` +
          selectedItems
            .map((item) => {
              const date = new Date(item.timestamp);
              const formattedDate = date.toLocaleDateString();
              const formattedTime = date.toLocaleTimeString();
              const amount = formatMoney(
                createMoney(item.amount, "KES", DEFAULT_EXCHANGE_RATES.KES)
              );

              return (
                `*${item.type === "sale" ? "Sale" : "Purchase"}*\n` +
                `📅 Date: ${formattedDate}\n` +
                `⏰ Time: ${formattedTime}\n` +
                `💰 Amount: ${amount}\n` +
                `🆔 ID: ${item.id}\n`
              );
            })
            .join("\n");

        // Open WhatsApp with pre-filled message
        const fullNumber = `${countryCode}${whatsappNumber.replace(/^0+/, "")}`;
        window.open(
          `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`,
          "_blank"
        );
      } else {
        // CouchDB sync
        await handleCouchDBSync(selectedItems);
      }

      // For WhatsApp, mark items as synced immediately
      if (syncMethod === "whatsapp") {
        // Mark items as synced
        const updatedItems = items.map((item) =>
          selectedItems.some((selected) => selected.id === item.id)
            ? { ...item, status: "synced" as const }
            : item
        );
        setItems(updatedItems);

        // Update sync status in database
        const salesDB = await getSalesDB();
        const purchasesDB = await getPurchasesDB();

        for (const item of selectedItems) {
          if (item.type === "sale") {
            const sale = await salesDB.get(item.id) as SaleDoc;
            await salesDB.put({ ...sale, status: "synced" });
          } else {
            const purchase = await purchasesDB.get(item.id) as PurchaseDoc;
            await purchasesDB.put({ ...purchase, status: "synced" });
          }
        }
      }
      // For CouchDB, marking is handled in handleCouchDBSync
    } catch (err) {
      console.error("Error syncing:", err);
      alert("Error syncing data. Please try again.");
    }
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Sync Data</Title>

      <Tabs defaultValue="sync" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="sync" leftSection={<IconCloud size={16} />}>
            Sync
          </Tabs.Tab>
          <Tabs.Tab value="config" leftSection={<IconSettings size={16} />}>
            Configuration
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="sync" pt="md">
          {!couchdbEnabled && syncMethod === "couchdb" && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="yellow"
              title="CouchDB Not Configured"
              mb="md"
            >
              Please configure CouchDB sync in the Configuration tab before
              syncing.
            </Alert>
          )}

          {syncError && (
            <Alert
              icon={<IconX size={16} />}
              color="red"
              title="Sync Error"
              onClose={() => setSyncError(null)}
              withCloseButton
              mb="md"
            >
              {syncError}
            </Alert>
          )}

          {syncStatus && syncMethod === "couchdb" && (
            <Card withBorder mb="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={500}>Sync Status</Text>
                  <Badge
                    color={
                      syncStatus.isSyncing
                        ? "blue"
                        : syncStatus.error
                        ? "red"
                        : "green"
                    }
                    leftSection={
                      syncStatus.isSyncing ? (
                        <IconRefresh
                          size={12}
                          style={{ animation: "spin 1s linear infinite" }}
                        />
                      ) : syncStatus.error ? (
                        <IconX size={12} />
                      ) : (
                        <IconCheck size={12} />
                      )
                    }
                  >
                    {syncStatus.isSyncing
                      ? "Syncing..."
                      : syncStatus.error
                      ? "Error"
                      : "Connected"}
                  </Badge>
                </Group>
                {syncStatus.lastSyncAt && (
                  <Text size="sm" c="dimmed">
                    Last sync:{" "}
                    {new Date(syncStatus.lastSyncAt).toLocaleString()}
                  </Text>
                )}
                {syncStatus.error && (
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="red"
                  >
                    {syncStatus.error}
                  </Alert>
                )}
                {Object.keys(syncStatus.databases).length > 0 && (
                  <Stack gap="xs" mt="xs">
                    <Text size="sm" fw={500}>
                      Database Status:
                    </Text>
                    {Object.entries(syncStatus.databases).map(
                      ([dbName, dbStatus]) => (
                        <Group
                          key={dbName}
                          justify="space-between"
                          wrap="nowrap"
                        >
                          <Text size="sm" style={{ minWidth: 120 }}>
                            {dbName}
                          </Text>
                          <Group gap="xs" wrap="nowrap">
                            {dbStatus.isSyncing ? (
                              <Badge size="xs" color="blue" variant="light">
                                <IconRefresh
                                  size={10}
                                  style={{
                                    animation: "spin 1s linear infinite",
                                  }}
                                />{" "}
                                Syncing
                              </Badge>
                            ) : dbStatus.lastSyncAt ? (
                              <Badge size="xs" color="green" variant="light">
                                <IconCheck size={10} /> Synced
                              </Badge>
                            ) : (
                              <Badge size="xs" color="gray" variant="light">
                                Idle
                              </Badge>
                            )}
                            {dbStatus.pendingChanges > 0 && (
                              <Badge size="xs" color="yellow" variant="light">
                                {dbStatus.pendingChanges} pending
                              </Badge>
                            )}
                            {dbStatus.conflicts > 0 && (
                              <Badge size="xs" color="red" variant="light">
                                {dbStatus.conflicts} conflicts
                              </Badge>
                            )}
                            {dbStatus.error && (
                              <Badge size="xs" color="red" variant="light">
                                Error
                              </Badge>
                            )}
                          </Group>
                        </Group>
                      )
                    )}
                  </Stack>
                )}
              </Stack>
            </Card>
          )}

          <Card withBorder>
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <SegmentedControl
                  value={syncMethod}
                  onChange={(value) =>
                    setSyncMethod(value as "whatsapp" | "couchdb")
                  }
                  data={[
                    {
                      value: "whatsapp",
                      label: (
                        <Center>
                          <IconBrandWhatsapp size={20} />
                          <Box ml={10}>WhatsApp</Box>
                        </Center>
                      ),
                    },
                    {
                      value: "couchdb",
                      label: (
                        <Center>
                          <IconCloud size={20} />
                          <Box ml={10}>Cloud</Box>
                        </Center>
                      ),
                    },
                  ]}
                  size="lg"
                />
                {syncMethod === "whatsapp" && (
                  <Group wrap="nowrap">
                    <Select
                      value={countryCode}
                      onChange={(value) => setCountryCode(value || "+254")}
                      data={[
                        { value: "+254", label: "🇰🇪" },
                        { value: "+255", label: "🇹🇿" },
                        { value: "+256", label: "🇺🇬" },
                        { value: "+250", label: "🇷🇼" },
                        { value: "+251", label: "🇪🇹" },
                        { value: "+252", label: "🇸🇴" },
                        { value: "+257", label: "🇧🇮" },
                      ]}
                      style={{ width: 80 }}
                    />
                    <TextInput
                      placeholder="WhatsApp number"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      rightSection={
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={() => setWhatsappNumber("")}
                        >
                          <IconBrandWhatsapp size={16} />
                        </ActionIcon>
                      }
                      style={{ minWidth: 150 }}
                    />
                  </Group>
                )}
              </Group>

              <Button
                onClick={() =>
                  handleSync(items.filter((item) => item.status === "pending"))
                }
                leftSection={
                  syncMethod === "whatsapp" ? (
                    <IconBrandWhatsapp size={20} />
                  ) : (
                    <IconCloud size={20} />
                  )
                }
                disabled={
                  !items.some((item) => item.status === "pending") ||
                  (syncMethod === "couchdb" && (!couchdbEnabled || syncing))
                }
                loading={syncing}
              >
                {syncing
                  ? "Syncing..."
                  : syncMethod === "couchdb"
                  ? "Sync with CouchDB"
                  : "Sync Pending Items"}
              </Button>
            </Stack>
          </Card>

          {loading ? (
            <Text ta="center">Loading data...</Text>
          ) : (
            <Stack gap="md">
              {items.map((item) => (
                <Card
                  key={item.id}
                  withBorder
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setExpandedItem(expandedItem === item.id ? null : item.id)
                  }
                >
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ minWidth: 0 }}>
                      <Group gap="xs">
                        <Text fw={500}>
                          {item.type === "sale" ? "Sale" : "Purchase"}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {new Date(item.timestamp).toLocaleString()}
                        </Text>
                      </Group>
                      <Text>
                        {formatMoney(
                          createMoney(
                            item.amount,
                            "KES",
                            DEFAULT_EXCHANGE_RATES.KES
                          )
                        )}
                      </Text>
                    </div>
                    <Group wrap="nowrap">
                      <Badge
                        color={
                          item.status === "synced"
                            ? "green"
                            : item.status === "failed"
                            ? "red"
                            : "yellow"
                        }
                        leftSection={
                          item.status === "synced" && <IconCheck size={14} />
                        }
                      >
                        {item.status === "synced"
                          ? "Synced"
                          : item.status === "failed"
                          ? "Failed"
                          : "Pending"}
                      </Badge>
                      {item.status !== "synced" && (
                        <Button
                          variant="light"
                          size="xs"
                          onClick={() => handleSync([item])}
                          leftSection={
                            syncMethod === "whatsapp" ? (
                              <IconBrandWhatsapp size={16} />
                            ) : (
                              <IconCloud size={16} />
                            )
                          }
                        >
                          Sync
                        </Button>
                      )}
                    </Group>
                  </Group>
                  <Collapse in={expandedItem === item.id}>
                    <Stack mt="md" gap="xs">
                      <Text size="sm">
                        <Text span fw={500}>
                          Transaction ID:
                        </Text>{" "}
                        {item.id}
                      </Text>
                      <Text size="sm">
                        <Text span fw={500}>
                          Type:
                        </Text>{" "}
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </Text>
                      <Text size="sm">
                        <Text span fw={500}>
                          Date:
                        </Text>{" "}
                        {new Date(item.timestamp).toLocaleDateString()}
                      </Text>
                      <Text size="sm">
                        <Text span fw={500}>
                          Time:
                        </Text>{" "}
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </Text>
                      <Text size="sm">
                        <Text span fw={500}>
                          Amount:
                        </Text>{" "}
                        {formatMoney(
                          createMoney(
                            item.amount,
                            "KES",
                            DEFAULT_EXCHANGE_RATES.KES
                          )
                        )}
                      </Text>
                      <Text size="sm">
                        <Text span fw={500}>
                          Status:
                        </Text>{" "}
                        {item.status.charAt(0).toUpperCase() +
                          item.status.slice(1)}
                      </Text>
                    </Stack>
                  </Collapse>
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="config" pt="md">
          <CouchDBConfigComponent />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
