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
} from "@mantine/core";
import { IconBrandWhatsapp, IconCloud, IconCheck } from "@tabler/icons-react";
import { getSalesDB, getPurchasesDB } from "@/lib/databases";
import { SaleDoc, PurchaseDoc } from "@/types";
import {
  formatMoney,
  createMoney,
  DEFAULT_EXCHANGE_RATES,
} from "@/types/money";
import { useDateFilter } from "@/contexts/DateFilterContext";

interface SyncItem {
  id: string;
  type: "sale" | "purchase";
  timestamp: string;
  amount: number;
  status: "pending" | "synced" | "failed";
}

export default function SyncPage() {
  const { dateRangeInfo } = useDateFilter();
  const [items, setItems] = useState<SyncItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+254");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [syncMethod, setSyncMethod] = useState<"whatsapp" | "couchdb">(
    "whatsapp"
  );

  // Fetch all sales and purchases within date range
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch sales
        const salesDB = await getSalesDB();
        const salesResult = await salesDB.find({
          selector: {
            type: "sale",
            timestamp: {
              $gte: dateRangeInfo.startDate.toISOString(),
              $lte: dateRangeInfo.endDate.toISOString(),
            },
          },
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
          selector: {
            type: "purchase",
            timestamp: {
              $gte: dateRangeInfo.startDate.toISOString(),
              $lte: dateRangeInfo.endDate.toISOString(),
            },
          },
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
  }, [dateRangeInfo.startDate, dateRangeInfo.endDate]);

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
        // TODO: Implement CouchDB sync
        console.log("Syncing with CouchDB...");
      }

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
    } catch (err) {
      console.error("Error syncing:", err);
      alert("Error syncing data. Please try again.");
    }
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Sync Data</Title>

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
                  style={{ width: 120 }}
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
            disabled={!items.some((item) => item.status === "pending")}
          >
            Sync Pending Items
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
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </Stack>
              </Collapse>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
