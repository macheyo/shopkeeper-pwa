"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Title,
  Paper,
  Stack,
  Tabs,
  Text,
  Group,
  Card,
  Table,
  Box,
  Select,
  Button,
} from "@mantine/core";
import {
  IconChartPie3,
  IconCash,
  IconScale,
  IconWallet,
  IconBook,
} from "@tabler/icons-react";
import { getSalesDB, getPurchasesDB } from "@/lib/databases";
import { SaleDoc, PurchaseDoc } from "@/types";
import { formatMoney, createMoney } from "@/types/money";
import { useDateFilter } from "@/contexts/DateFilterContext";
import ProductManager from "@/components/ProductManager";
import AccountsView from "@/components/AccountsView";

export default function ReportsPage() {
  const router = useRouter();
  const { dateRangeInfo } = useDateFilter();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleDoc[]>([]);
  const [purchases, setPurchases] = useState<PurchaseDoc[]>([]);
  const [activeTab, setActiveTab] = useState<string>("pl");

  // Fetch data when date range changes
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
        setSales(salesResult.docs as SaleDoc[]);

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
        setPurchases(purchasesResult.docs as PurchaseDoc[]);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRangeInfo.startDate, dateRangeInfo.endDate]);

  const renderProfitLoss = () => {
    const revenue = sales.reduce(
      (acc, sale) => acc + sale.totalAmount.amount,
      0
    );
    const costOfGoodsSold = sales.reduce(
      (acc, sale) =>
        acc +
        sale.items.reduce(
          (itemAcc, item) => itemAcc + item.costPrice.amount * item.qty,
          0
        ),
      0
    );
    const grossProfit = revenue - costOfGoodsSold;

    return (
      <Stack gap="md">
        <Card withBorder>
          <Title order={4} mb="md">
            Revenue
          </Title>
          <Group justify="space-between">
            <Text>Total Sales</Text>
            <Text fw={500}>{formatMoney(createMoney(revenue))}</Text>
          </Group>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Cost of Goods Sold
          </Title>
          <Group justify="space-between">
            <Text>Total COGS</Text>
            <Text fw={500}>{formatMoney(createMoney(costOfGoodsSold))}</Text>
          </Group>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Profit
          </Title>
          <Group justify="space-between">
            <Text>Gross Profit</Text>
            <Text fw={500} c="green">
              {formatMoney(createMoney(grossProfit))}
            </Text>
          </Group>
          <Group justify="space-between" mt="xs">
            <Text>Net Profit</Text>
            <Text fw={700} c="green">
              {formatMoney(createMoney(grossProfit))}
            </Text>
          </Group>
        </Card>
      </Stack>
    );
  };

  const renderCashFlow = () => {
    const cashFromSales = sales.reduce(
      (acc, sale) => acc + sale.totalAmount.amount,
      0
    );
    const cashForPurchases = purchases.reduce(
      (acc, purchase) => acc + purchase.totalAmount.amount,
      0
    );
    const netOperatingCash = cashFromSales - cashForPurchases;

    return (
      <Stack gap="md">
        <Card withBorder>
          <Title order={4} mb="md">
            Operating Activities
          </Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text>Cash from Sales</Text>
              <Text fw={500} c="green">
                {formatMoney(createMoney(cashFromSales))}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text>Cash for Purchases</Text>
              <Text fw={500} c="red">
                {formatMoney(createMoney(cashForPurchases))}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text>Net Operating Cash</Text>
              <Text fw={700} c={netOperatingCash >= 0 ? "green" : "red"}>
                {formatMoney(createMoney(netOperatingCash))}
              </Text>
            </Group>
          </Stack>
        </Card>
      </Stack>
    );
  };

  const renderBalanceSheet = () => {
    const inventoryValue = purchases.reduce((acc, purchase) => {
      return (
        acc +
        purchase.items.reduce(
          (itemAcc, item) => itemAcc + item.costPrice.amount * item.qty,
          0
        )
      );
    }, 0);

    const cash = sales.reduce((acc, sale) => acc + sale.totalAmount.amount, 0);
    const totalAssets = inventoryValue + cash;

    return (
      <Stack gap="md">
        <Card withBorder>
          <Title order={4} mb="md">
            Assets
          </Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text>Inventory</Text>
              <Text fw={500}>{formatMoney(createMoney(inventoryValue))}</Text>
            </Group>
            <Group justify="space-between">
              <Text>Cash</Text>
              <Text fw={500}>{formatMoney(createMoney(cash))}</Text>
            </Group>
            <Group justify="space-between">
              <Text>Total Assets</Text>
              <Text fw={700}>{formatMoney(createMoney(totalAssets))}</Text>
            </Group>
          </Stack>
        </Card>
      </Stack>
    );
  };

  const renderPurchaseAnalysis = () => {
    const purchaseRuns = purchases.reduce((acc, purchase) => {
      const run = acc.find((r) => r.purchaseRunId === purchase.purchaseRunId);
      if (run) {
        run.purchases.push(purchase);
      } else {
        acc.push({
          purchaseRunId: purchase.purchaseRunId,
          timestamp: purchase.timestamp,
          purchases: [purchase],
        });
      }
      return acc;
    }, [] as { purchaseRunId: string; timestamp: string; purchases: PurchaseDoc[] }[]);

    return (
      <Stack gap="md">
        {purchaseRuns.map((run) => {
          const totalPurchaseAmount = run.purchases.reduce(
            (acc, p) => acc + p.totalAmount.amount,
            0
          );

          return (
            <Card key={run.purchaseRunId} withBorder>
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={700}>
                    Purchase Run #{run.purchaseRunId.split("_")[1]}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {new Date(run.timestamp).toLocaleString()}
                  </Text>
                </div>
              </Group>

              <Table withTableBorder>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>Total Purchase Cost</Table.Td>
                    <Table.Td align="right">
                      {formatMoney(createMoney(totalPurchaseAmount))}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Card>
          );
        })}
      </Stack>
    );
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Financial Reports</Title>

      {loading ? (
        <Text ta="center">Loading reports...</Text>
      ) : (
        <>
          <Box hiddenFrom="sm">
            {/* Mobile view */}
            <Select
              value={activeTab}
              onChange={(value) => setActiveTab(value || "pl")}
              data={[
                { value: "pl", label: "Profit & Loss" },
                { value: "cf", label: "Cash Flow" },
                { value: "bs", label: "Balance Sheet" },
                { value: "pa", label: "Purchase Analysis" },
                { value: "accounts", label: "Accounts" },
                { value: "products", label: "Products" },
                { value: "cash", label: "Cash Tracking" },
              ]}
              size="md"
              mb="md"
            />
            <Paper p="xs" withBorder>
              {activeTab === "pl" && renderProfitLoss()}
              {activeTab === "cf" && renderCashFlow()}
              {activeTab === "bs" && renderBalanceSheet()}
              {activeTab === "pa" && renderPurchaseAnalysis()}
              {activeTab === "accounts" && <AccountsView />}
              {activeTab === "products" && <ProductManager />}
              {activeTab === "cash" && (
                <Button
                  fullWidth
                  size="xl"
                  leftSection={<IconWallet size={24} />}
                  onClick={() => router.push("/cash-tracking")}
                  color="blue"
                  h={60}
                >
                  Open Cash Tracking
                </Button>
              )}
            </Paper>

            {/* Quick navigation buttons */}
            <Group mt="md" grow>
              {activeTab !== "pl" && (
                <Button
                  variant="light"
                  onClick={() => setActiveTab("pl")}
                  leftSection={<IconChartPie3 size={16} />}
                  color="violet"
                >
                  P&L
                </Button>
              )}
              {activeTab !== "cf" && (
                <Button
                  variant="light"
                  onClick={() => setActiveTab("cf")}
                  leftSection={<IconCash size={16} />}
                  color="violet"
                >
                  Cash
                </Button>
              )}
              {activeTab !== "bs" && (
                <Button
                  variant="light"
                  onClick={() => setActiveTab("bs")}
                  leftSection={<IconScale size={16} />}
                  color="violet"
                >
                  Balance
                </Button>
              )}
              {activeTab !== "accounts" && (
                <Button
                  variant="light"
                  onClick={() => setActiveTab("accounts")}
                  leftSection={<IconBook size={16} />}
                  color="violet"
                >
                  Accounts
                </Button>
              )}
            </Group>
          </Box>

          <Box visibleFrom="sm">
            {/* Desktop view */}
            <Tabs
              value={activeTab}
              onChange={(value) => setActiveTab(value || "pl")}
            >
              <Tabs.List grow>
                <Tabs.Tab value="pl">Profit & Loss</Tabs.Tab>
                <Tabs.Tab value="cf">Cash Flow</Tabs.Tab>
                <Tabs.Tab value="bs">Balance Sheet</Tabs.Tab>
                <Tabs.Tab value="pa">Purchase Analysis</Tabs.Tab>
                <Tabs.Tab value="accounts">Accounts</Tabs.Tab>
                <Tabs.Tab value="products">Products</Tabs.Tab>
                <Tabs.Tab value="cash">Cash Tracking</Tabs.Tab>
              </Tabs.List>

              <Paper p="md" mt="md" withBorder>
                <Tabs.Panel value="pl">{renderProfitLoss()}</Tabs.Panel>
                <Tabs.Panel value="cf">{renderCashFlow()}</Tabs.Panel>
                <Tabs.Panel value="bs">{renderBalanceSheet()}</Tabs.Panel>
                <Tabs.Panel value="pa">{renderPurchaseAnalysis()}</Tabs.Panel>
                <Tabs.Panel value="accounts">
                  <AccountsView />
                </Tabs.Panel>
                <Tabs.Panel value="products">
                  <ProductManager />
                </Tabs.Panel>
                <Tabs.Panel value="cash">
                  <Button
                    fullWidth
                    size="xl"
                    leftSection={<IconWallet size={24} />}
                    onClick={() => router.push("/cash-tracking")}
                    color="blue"
                    h={60}
                  >
                    Open Cash Tracking
                  </Button>
                </Tabs.Panel>
              </Paper>
            </Tabs>
          </Box>
        </>
      )}
    </Stack>
  );
}
