"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Progress,
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
import { getCouchDBConfig, isCouchDBSyncEnabled } from "@/lib/couchdbConfig";
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
  const [syncMethod, setSyncMethod] = useState<"whatsapp" | "couchdb">(
    "whatsapp"
  );

  // CouchDB sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [couchdbEnabled, setCouchdbEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

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
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRangeInfo.startDate, dateRangeInfo.endDate, shop]);

  // Check if CouchDB is enabled
  useEffect(() => {
    const checkCouchDB = async () => {
      if (!shop) return;
      const enabled = await isCouchDBSyncEnabled(shop.shopId);
      setCouchdbEnabled(enabled);
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

    // Listen to sync events
    const unsubscribe = syncManager.onEvent((event: SyncEvent) => {
      updateStatus();
      if (event.type === "error" && event.error) {
        setSyncError(event.error.message);
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [couchdbEnabled, shop, currentUser]);

  // Initialize sync manager when CouchDB is enabled
  useEffect(() => {
    const initSync = async () => {
      if (!couchdbEnabled || !shop || !currentUser) return;

      try {
        const syncManager = getSyncManager();
        await syncManager.initialize(currentUser);
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
            const sale = await salesDB.get(item.id);
            await salesDB.put({ ...sale, status: "synced" });
          } else {
            const purchase = await purchasesDB.get(item.id);
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
            const sale = await salesDB.get(item.id);
            await salesDB.put({ ...sale, status: "synced" });
          } else {
            const purchase = await purchasesDB.get(item.id);
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
                    color={syncStatus.isSyncing ? "blue" : "green"}
                    leftSection={
                      syncStatus.isSyncing ? (
                        <IconRefresh
                          size={12}
                          style={{ animation: "spin 1s linear infinite" }}
                        />
                      ) : (
                        <IconCheck size={12} />
                      )
                    }
                  >
                    {syncStatus.isSyncing ? "Syncing..." : "Idle"}
                  </Badge>
                </Group>
                {syncStatus.lastSyncAt && (
                  <Text size="sm" c="dimmed">
                    Last sync:{" "}
                    {new Date(syncStatus.lastSyncAt).toLocaleString()}
                  </Text>
                )}
                {syncStatus.error && (
                  <Text size="sm" c="red">
                    Error: {syncStatus.error}
                  </Text>
                )}
                {Object.keys(syncStatus.databases).length > 0 && (
                  <Stack gap="xs" mt="xs">
                    {Object.entries(syncStatus.databases).map(
                      ([dbName, dbStatus]) => (
                        <Group key={dbName} justify="space-between">
                          <Text size="sm">{dbName}</Text>
                          <Group gap="xs">
                            {dbStatus.isSyncing && (
                              <Badge size="xs" color="blue">
                                Syncing
                              </Badge>
                            )}
                            {dbStatus.pendingChanges > 0 && (
                              <Badge size="xs" color="yellow">
                                {dbStatus.pendingChanges} pending
                              </Badge>
                            )}
                            {dbStatus.conflicts > 0 && (
                              <Badge size="xs" color="red">
                                {dbStatus.conflicts} conflicts
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
