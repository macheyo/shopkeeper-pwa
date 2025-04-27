"use client";

import React from "react";
import CollapsibleFab from "@/components/CollapsibleFab";
import {
  Title,
  Button,
  Group,
  Stack,
  Card,
  Text,
  Badge,
  ActionIcon,
  Box,
} from "@mantine/core";
import { IconPlus, IconEye } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { formatMoney, Money } from "@/types/money";
import { PurchaseDoc } from "@/types";
import { getPurchasesDB } from "@/lib/databases";
import { useDateFilter } from "@/contexts/DateFilterContext";

export default function PurchasesPage() {
  const router = useRouter();
  const { dateRangeInfo } = useDateFilter();
  const [purchases, setPurchases] = React.useState<PurchaseDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Fetch purchases for the selected date range
  React.useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const purchasesDB = await getPurchasesDB();
        const result = await purchasesDB.find({
          selector: {
            type: "purchase",
            timestamp: {
              $gte: dateRangeInfo.startDate.toISOString(),
              $lte: dateRangeInfo.endDate.toISOString(),
            },
          },
        });
        setPurchases(result.docs as PurchaseDoc[]);
      } catch (err) {
        console.error("Error fetching purchases:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, [dateRangeInfo.startDate, dateRangeInfo.endDate]);

  // Group purchases by purchaseRunId
  const purchaseRuns = purchases.reduce((acc, purchase) => {
    const run = acc.find((r) => r.purchaseRunId === purchase.purchaseRunId);
    if (run) {
      run.purchases.push(purchase);
      run.totalAmount.amount += purchase.totalAmount.amount;
    } else {
      acc.push({
        purchaseRunId: purchase.purchaseRunId,
        timestamp: purchase.timestamp,
        purchases: [purchase],
        totalAmount: { ...purchase.totalAmount },
      });
    }
    return acc;
  }, [] as { purchaseRunId: string; timestamp: string; purchases: PurchaseDoc[]; totalAmount: Money }[]);

  // Sort purchase runs by timestamp (most recent first)
  purchaseRuns.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <>
      <Stack gap="lg">
        <Box mb="xl">
          <Group justify="space-between" align="center">
            <Title order={2}>Purchases</Title>
            <CollapsibleFab
              icon={<IconPlus size={16} />}
              text="New Purchase"
              onClick={() => router.push("/purchases/new")}
              color="teal"
            />
          </Group>
          <Text c="dimmed" mt="xs">
            Record and manage your purchase transactions
          </Text>
        </Box>

        {loading ? (
          <Text ta="center">Loading purchases...</Text>
        ) : purchaseRuns.length === 0 ? (
          <Stack
            align="center"
            py="xl"
            style={{
              animation: "fadeIn 0.5s ease-out",
            }}
          >
            <Text ta="center">
              No purchases found for the selected date range.
            </Text>
            <Group>
              <Button
                variant="light"
                onClick={() => router.push("/products/add")}
                leftSection={<IconPlus size={16} />}
                color="teal"
              >
                Add a Product
              </Button>
              <Button
                onClick={() => router.push("/purchases/new")}
                leftSection={<IconPlus size={16} />}
                color="teal"
              >
                Record a Purchase
              </Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap="md">
            {purchaseRuns.map((run) => (
              <Card
                key={run.purchaseRunId}
                withBorder
                shadow="sm"
                onClick={() => router.push(`/purchases/${run.purchaseRunId}`)}
              >
                <Group justify="space-between" mb="xs">
                  <div>
                    <Text fw={700} size="lg">
                      Purchase Run #{run.purchaseRunId.split("_")[1]}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {new Date(run.timestamp).toLocaleString()}
                    </Text>
                  </div>
                  <ActionIcon
                    variant="light"
                    color="blue"
                    onClick={() =>
                      router.push(`/purchases/${run.purchaseRunId}`)
                    }
                  >
                    <IconEye size={20} />
                  </ActionIcon>
                </Group>

                <Group gap="md" mb="sm">
                  <Badge color="blue">
                    {run.purchases.length} Purchase
                    {run.purchases.length !== 1 ? "s" : ""}
                  </Badge>
                  <Badge color="green">
                    {run.purchases.reduce((acc, p) => acc + p.items.length, 0)}{" "}
                    Items
                  </Badge>
                </Group>

                <Group justify="space-between" mt="md">
                  <Text fw={500}>Total Amount:</Text>
                  <Text fw={700}>{formatMoney(run.totalAmount)}</Text>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </>
  );
}
