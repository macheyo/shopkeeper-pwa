"use client";

import React, { useState, useEffect } from "react";
import {
  Title,
  Paper,
  Stack,
  Tabs,
  Text,
  Group,
  Card,
  Table,
  Badge,
  Box,
  Select,
  Button,
} from "@mantine/core";
import { IconChartPie3, IconCash, IconScale } from "@tabler/icons-react";
import { getSalesDB, getPurchasesDB } from "@/lib/databases";
import {
  SaleDoc,
  PurchaseDoc,
  ProfitLossStatement,
  CashFlowStatement,
  BalanceSheet,
  PurchaseRunAnalysis,
} from "@/types";
import { formatMoney, createMoney } from "@/types/money";
import { useDateFilter } from "@/contexts/DateFilterContext";
import ProductManager from "@/components/ProductManager";

export default function ReportsPage() {
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

  // Calculate Profit/Loss Statement
  const calculateProfitLoss = (): ProfitLossStatement => {
    const revenue = sales.reduce(
      (acc, sale) => acc + sale.totalAmount.amount,
      0
    );
    const costOfGoodsSold = sales.reduce(
      (acc, sale) => acc + sale.totalCost.amount,
      0
    );
    const grossProfit = revenue - costOfGoodsSold;

    return {
      startDate: dateRangeInfo.startDate.toISOString(),
      endDate: dateRangeInfo.endDate.toISOString(),
      revenue: createMoney(revenue),
      costOfGoodsSold: createMoney(costOfGoodsSold),
      grossProfit: createMoney(grossProfit),
      expenses: {}, // Add expense tracking in future
      netProfit: createMoney(grossProfit), // Same as gross profit until we track expenses
    };
  };

  // Calculate Cash Flow Statement
  const calculateCashFlow = (): CashFlowStatement => {
    const cashFromSales = sales.reduce(
      (acc, sale) => acc + sale.totalAmount.amount,
      0
    );
    const cashForPurchases = purchases.reduce(
      (acc, purchase) => acc + purchase.totalAmount.amount,
      0
    );
    const netOperatingCash = cashFromSales - cashForPurchases;

    return {
      startDate: dateRangeInfo.startDate.toISOString(),
      endDate: dateRangeInfo.endDate.toISOString(),
      operatingActivities: {
        cashFromSales: createMoney(cashFromSales),
        cashForPurchases: createMoney(cashForPurchases),
        cashForExpenses: createMoney(0), // Add expense tracking in future
        netOperatingCash: createMoney(netOperatingCash),
      },
      netCashFlow: createMoney(netOperatingCash),
      openingBalance: createMoney(0), // Add balance tracking in future
      closingBalance: createMoney(netOperatingCash), // Simplified for now
    };
  };

  // Calculate Balance Sheet
  const calculateBalanceSheet = (): BalanceSheet => {
    // Calculate inventory value based on purchase prices
    const inventoryValue = purchases.reduce((acc, purchase) => {
      return (
        acc +
        purchase.items.reduce(
          (itemAcc, item) => itemAcc + item.costPrice.amount * item.qty,
          0
        )
      );
    }, 0);

    // For now, we'll assume all sales are cash sales
    const cash = sales.reduce((acc, sale) => acc + sale.totalAmount.amount, 0);

    const totalAssets = inventoryValue + cash;

    return {
      startDate: dateRangeInfo.startDate.toISOString(),
      endDate: dateRangeInfo.endDate.toISOString(),
      assets: {
        inventory: createMoney(inventoryValue),
        cash: createMoney(cash),
        accountsReceivable: createMoney(0), // Add credit sales tracking in future
        totalAssets: createMoney(totalAssets),
      },
      liabilities: {
        accountsPayable: createMoney(0), // Add credit purchases tracking in future
        totalLiabilities: createMoney(0),
      },
      equity: {
        ownersEquity: createMoney(0), // Add equity tracking in future
        retainedEarnings: createMoney(totalAssets), // Simplified for now
        totalEquity: createMoney(totalAssets),
      },
    };
  };

  // Calculate Purchase Run Analysis
  const calculatePurchaseRunAnalysis = (): PurchaseRunAnalysis[] => {
    // Group purchases by purchaseRunId
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

    // Calculate metrics for each purchase run
    return purchaseRuns.map((run) => {
      const totalPurchaseAmount = run.purchases.reduce(
        (acc, p) => acc + p.totalAmount.amount,
        0
      );

      // Find sales of items from this purchase run
      const relatedSales = sales.filter((sale) =>
        sale.items.some((item) =>
          run.purchases.some((p) =>
            p.items.some((pi) => pi.productId === item.productId)
          )
        )
      );

      const itemsSold = relatedSales.reduce(
        (acc, sale) =>
          acc +
          sale.items.reduce(
            (itemAcc, item) =>
              run.purchases.some((p) =>
                p.items.some((pi) => pi.productId === item.productId)
              )
                ? itemAcc + item.qty
                : itemAcc,
            0
          ),
        0
      );

      const itemsPurchased = run.purchases.reduce(
        (acc, p) =>
          acc + p.items.reduce((itemAcc, item) => itemAcc + item.qty, 0),
        0
      );

      const revenue = relatedSales.reduce(
        (acc, sale) =>
          acc +
          sale.items.reduce(
            (itemAcc, item) =>
              run.purchases.some((p) =>
                p.items.some((pi) => pi.productId === item.productId)
              )
                ? itemAcc + item.total.amount
                : itemAcc,
            0
          ),
        0
      );

      const profit = revenue - totalPurchaseAmount;
      const profitMargin = (profit / revenue) * 100;
      const roi = (profit / totalPurchaseAmount) * 100;

      // Track time-to-sell for each item
      const itemsWithTimeToSell = relatedSales.flatMap((sale) =>
        sale.items
          .filter((item) =>
            run.purchases.some((p) =>
              p.items.some((pi) => pi.productId === item.productId)
            )
          )
          .map((item) => {
            const saleDate = new Date(sale.timestamp);
            const purchaseDate = new Date(item.purchaseDate);
            const daysToSell = Math.round(
              (saleDate.getTime() - purchaseDate.getTime()) /
                (1000 * 60 * 60 * 24)
            );

            return {
              productId: item.productId,
              productName: item.productName,
              purchaseDate: item.purchaseDate,
              saleDate: sale.timestamp,
              daysToSell,
            };
          })
      );

      // Calculate average time to sell
      const averageTimeToSell =
        itemsWithTimeToSell.length > 0
          ? Math.round(
              itemsWithTimeToSell.reduce(
                (acc, item) => acc + item.daysToSell,
                0
              ) / itemsWithTimeToSell.length
            )
          : 0;

      return {
        purchaseRunId: run.purchaseRunId,
        timestamp: run.timestamp,
        totalPurchaseAmount: createMoney(totalPurchaseAmount),
        itemsSold,
        itemsRemaining: itemsPurchased - itemsSold,
        revenue: createMoney(revenue),
        profit: createMoney(profit),
        profitMargin: Math.round(profitMargin * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        averageTimeToSell,
        itemsWithTimeToSell,
      };
    });
  };

  const profitLoss = calculateProfitLoss();
  const cashFlow = calculateCashFlow();
  const balanceSheet = calculateBalanceSheet();
  const purchaseAnalysis = calculatePurchaseRunAnalysis();

  const renderProfitLoss = () => (
    <Stack gap="md">
      <Card withBorder>
        <Title order={4} mb="md">
          Revenue
        </Title>
        <Group justify="space-between">
          <Text>Total Sales</Text>
          <Text fw={500}>{formatMoney(profitLoss.revenue)}</Text>
        </Group>
      </Card>

      <Card withBorder>
        <Title order={4} mb="md">
          Cost of Goods Sold
        </Title>
        <Group justify="space-between">
          <Text>Total COGS</Text>
          <Text fw={500}>{formatMoney(profitLoss.costOfGoodsSold)}</Text>
        </Group>
      </Card>

      <Card withBorder>
        <Title order={4} mb="md">
          Profit
        </Title>
        <Group justify="space-between">
          <Text>Gross Profit</Text>
          <Text fw={500} c="green">
            {formatMoney(profitLoss.grossProfit)}
          </Text>
        </Group>
        <Group justify="space-between" mt="xs">
          <Text>Net Profit</Text>
          <Text fw={700} c="green">
            {formatMoney(profitLoss.netProfit)}
          </Text>
        </Group>
      </Card>
    </Stack>
  );

  const renderCashFlow = () => (
    <Stack gap="md">
      <Card withBorder>
        <Title order={4} mb="md">
          Operating Activities
        </Title>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text>Cash from Sales</Text>
            <Text fw={500} c="green">
              {formatMoney(cashFlow.operatingActivities.cashFromSales)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text>Cash for Purchases</Text>
            <Text fw={500} c="red">
              {formatMoney(cashFlow.operatingActivities.cashForPurchases)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text>Net Operating Cash</Text>
            <Text
              fw={700}
              c={
                cashFlow.operatingActivities.netOperatingCash.amount >= 0
                  ? "green"
                  : "red"
              }
            >
              {formatMoney(cashFlow.operatingActivities.netOperatingCash)}
            </Text>
          </Group>
        </Stack>
      </Card>

      <Card withBorder>
        <Title order={4} mb="md">
          Cash Position
        </Title>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text>Opening Balance</Text>
            <Text fw={500}>{formatMoney(cashFlow.openingBalance)}</Text>
          </Group>
          <Group justify="space-between">
            <Text>Net Cash Flow</Text>
            <Text
              fw={500}
              c={cashFlow.netCashFlow.amount >= 0 ? "green" : "red"}
            >
              {formatMoney(cashFlow.netCashFlow)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text>Closing Balance</Text>
            <Text
              fw={700}
              c={cashFlow.closingBalance.amount >= 0 ? "green" : "red"}
            >
              {formatMoney(cashFlow.closingBalance)}
            </Text>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );

  const renderBalanceSheet = () => (
    <Stack gap="md">
      <Card withBorder>
        <Title order={4} mb="md">
          Assets
        </Title>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text>Inventory</Text>
            <Text fw={500}>{formatMoney(balanceSheet.assets.inventory)}</Text>
          </Group>
          <Group justify="space-between">
            <Text>Cash</Text>
            <Text fw={500}>{formatMoney(balanceSheet.assets.cash)}</Text>
          </Group>
          <Group justify="space-between">
            <Text>Total Assets</Text>
            <Text fw={700}>{formatMoney(balanceSheet.assets.totalAssets)}</Text>
          </Group>
        </Stack>
      </Card>

      <Card withBorder>
        <Title order={4} mb="md">
          Liabilities & Equity
        </Title>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text>Total Liabilities</Text>
            <Text fw={500}>
              {formatMoney(balanceSheet.liabilities.totalLiabilities)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text>Total Equity</Text>
            <Text fw={700}>{formatMoney(balanceSheet.equity.totalEquity)}</Text>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );

  const renderPurchaseAnalysis = () => (
    <Stack gap="md">
      {purchaseAnalysis.map((run) => (
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
            <Badge
              color={run.profit.amount >= 0 ? "green" : "red"}
              size="lg"
              variant="light"
            >
              ROI: {run.roi}%
            </Badge>
          </Group>

          <div style={{ overflowX: "auto" }}>
            <Table withTableBorder style={{ minWidth: "100%" }}>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>Total Purchase Cost</Table.Td>
                  <Table.Td align="right">
                    {formatMoney(run.totalPurchaseAmount)}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Items Sold</Table.Td>
                  <Table.Td align="right">{run.itemsSold}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Items Remaining</Table.Td>
                  <Table.Td align="right">{run.itemsRemaining}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Revenue</Table.Td>
                  <Table.Td align="right">{formatMoney(run.revenue)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Profit</Table.Td>
                  <Table.Td
                    align="right"
                    c={run.profit.amount >= 0 ? "green" : "red"}
                  >
                    {formatMoney(run.profit)}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Profit Margin</Table.Td>
                  <Table.Td
                    align="right"
                    c={run.profitMargin >= 0 ? "green" : "red"}
                  >
                    {run.profitMargin}%
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Average Time to Sell</Table.Td>
                  <Table.Td align="right">
                    {run.averageTimeToSell} days
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </div>

          {run.itemsWithTimeToSell.length > 0 && (
            <>
              <Title order={5} mt="lg" mb="sm">
                Item Sales Timeline
              </Title>
              <div style={{ overflowX: "auto" }}>
                <Table withTableBorder style={{ minWidth: "100%" }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Product</Table.Th>
                      <Table.Th>Purchase Date</Table.Th>
                      <Table.Th>Sale Date</Table.Th>
                      <Table.Th>Days to Sell</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {run.itemsWithTimeToSell.map((item, idx) => (
                      <Table.Tr key={`${item.productId}_${idx}`}>
                        <Table.Td>{item.productName}</Table.Td>
                        <Table.Td>
                          {new Date(item.purchaseDate).toLocaleDateString()}
                        </Table.Td>
                        <Table.Td>
                          {new Date(item.saleDate).toLocaleDateString()}
                        </Table.Td>
                        <Table.Td align="right">{item.daysToSell}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            </>
          )}
        </Card>
      ))}
    </Stack>
  );

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
                { value: "products", label: "Products" },
              ]}
              size="md"
              mb="md"
            />
            <Paper p="xs" withBorder>
              {activeTab === "pl" && renderProfitLoss()}
              {activeTab === "cf" && renderCashFlow()}
              {activeTab === "bs" && renderBalanceSheet()}
              {activeTab === "pa" && renderPurchaseAnalysis()}
              {activeTab === "products" && <ProductManager />}
            </Paper>

            {/* Quick navigation buttons */}
            <Group mt="md" grow>
              {activeTab !== "pl" && (
                <Button
                  variant="light"
                  onClick={() => setActiveTab("pl")}
                  leftSection={<IconChartPie3 size={16} />}
                >
                  P&L
                </Button>
              )}
              {activeTab !== "cf" && (
                <Button
                  variant="light"
                  onClick={() => setActiveTab("cf")}
                  leftSection={<IconCash size={16} />}
                >
                  Cash
                </Button>
              )}
              {activeTab !== "bs" && (
                <Button
                  variant="light"
                  onClick={() => setActiveTab("bs")}
                  leftSection={<IconScale size={16} />}
                >
                  Balance
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
                <Tabs.Tab value="products">Products</Tabs.Tab>
              </Tabs.List>

              <Paper p="md" mt="md" withBorder>
                <Tabs.Panel value="pl">{renderProfitLoss()}</Tabs.Panel>
                <Tabs.Panel value="cf">{renderCashFlow()}</Tabs.Panel>
                <Tabs.Panel value="bs">{renderBalanceSheet()}</Tabs.Panel>
                <Tabs.Panel value="pa">{renderPurchaseAnalysis()}</Tabs.Panel>
                <Tabs.Panel value="products">
                  <ProductManager />
                </Tabs.Panel>
              </Paper>
            </Tabs>
          </Box>
        </>
      )}
    </Stack>
  );
}
