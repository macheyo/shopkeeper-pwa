"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Title,
  Button,
  Group,
  Text,
  Paper,
  Box,
  Stack,
  Card,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { getSalesDB, getPurchasesDB } from "@/lib/databases";
import { SaleDoc, PurchaseDoc } from "@/types";
import { formatMoney, createMoney } from "@/types/money";
import { CashInHandManager } from "@/components/CashInHandManager";

export default function CashTrackingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cashSales, setCashSales] = useState<SaleDoc[]>([]);
  const [cashPurchases, setCashPurchases] = useState<PurchaseDoc[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch cash sales
        const salesDB = await getSalesDB();
        const salesResult = await salesDB.find({
          selector: {
            type: "sale",
            paymentMethod: "cash",
          },
        });
        setCashSales(salesResult.docs as SaleDoc[]);

        // Fetch cash purchases
        const purchasesDB = await getPurchasesDB();
        const purchasesResult = await purchasesDB.find({
          selector: {
            type: "purchase",
            paymentMethod: "cash",
          },
        });
        setCashPurchases(purchasesResult.docs as PurchaseDoc[]);
      } catch (error) {
        console.error("Error fetching cash transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate total cash from sales
  const totalCashSales = cashSales.reduce(
    (total, sale) => total + sale.totalAmount.amount,
    0
  );

  // Calculate total cash spent on purchases
  const totalCashPurchases = cashPurchases.reduce(
    (total, purchase) => total + purchase.totalAmount.amount,
    0
  );

  // Expected cash is sales minus purchases
  const expectedCash = totalCashSales - totalCashPurchases;

  return (
    <>
      <Box mb="lg">
        <Group justify="space-between" align="center">
          <Title order={2}>Cash Tracking</Title>
          <Button
            variant="outline"
            leftSection={<IconArrowLeft size={20} />}
            onClick={() => router.push("/reports")}
            size="md"
          >
            Back
          </Button>
        </Group>
      </Box>

      {loading ? (
        <Text ta="center" size="lg">
          Loading cash transactions...
        </Text>
      ) : (
        <Stack gap="lg">
          {/* Cash Flow Summary */}
          <Paper shadow="md" p="lg" withBorder>
            <Title order={3} mb="lg">
              Cash Flow Summary
            </Title>

            <Stack gap="md">
              <Card withBorder>
                <Group justify="space-between">
                  <Text>Total Cash Sales</Text>
                  <Text fw={500} c="green">
                    {formatMoney(createMoney(totalCashSales))}
                  </Text>
                </Group>
              </Card>

              <Card withBorder>
                <Group justify="space-between">
                  <Text>Total Cash Purchases</Text>
                  <Text fw={500} c="red">
                    {formatMoney(createMoney(totalCashPurchases))}
                  </Text>
                </Group>
              </Card>

              <Card withBorder>
                <Group justify="space-between">
                  <Text>Expected Cash in Hand</Text>
                  <Text fw={700} c={expectedCash >= 0 ? "green" : "red"}>
                    {formatMoney(createMoney(expectedCash))}
                  </Text>
                </Group>
              </Card>
            </Stack>
          </Paper>

          {/* Cash Count Form */}
          <Paper shadow="md" p="lg" withBorder>
            <Title order={3} mb="lg">
              Cash Count
            </Title>
            <CashInHandManager />
          </Paper>
        </Stack>
      )}
    </>
  );
}
