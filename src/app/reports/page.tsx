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
  Progress,
  Badge,
  ScrollArea,
  useMantineTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconChartPie3,
  IconCash,
  IconScale,
  IconWallet,
  IconBook,
} from "@tabler/icons-react";
import { getSalesDB, getPurchasesDB, getLedgerDB } from "@/lib/databases";
import { SaleDoc, PurchaseDoc } from "@/types";
import {
  formatMoney,
  Money,
  CurrencyCode,
  CURRENCY_INFO,
  createMoney,
} from "@/types/money";
import { useMoneyContext } from "@/contexts/MoneyContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import ProductManager from "@/components/ProductManager";
import AccountsView from "@/components/AccountsView";
import { generateTrialBalance } from "@/lib/accounting";
import { TrialBalance, AccountCode, LedgerEntryDoc } from "@/types/accounting";
import { getPurchaseRunProgress } from "@/lib/inventory";

// Component to display purchase run items with progress
function PurchaseRunItemsTable({
  purchases,
  purchaseRunId,
  totalPurchaseAmount,
  convertToReportingCurrency,
  formatMoney,
  reportingCurrency,
  exchangeRates,
}: {
  purchases: PurchaseDoc[];
  purchaseRunId: string;
  totalPurchaseAmount: Money;
  convertToReportingCurrency: (money: Money) => Money;
  formatMoney: (money: Money) => string;
  reportingCurrency: CurrencyCode;
  exchangeRates: Record<CurrencyCode, number>;
}) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [progress, setProgress] = useState<{
    items: Array<{
      productId: string;
      productName: string;
      productCode: string;
      purchased: number;
      sold: number;
      remaining: number;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      setLoading(true);
      try {
        const data = await getPurchaseRunProgress(purchaseRunId);
        setProgress(data);
      } catch (err) {
        console.error("Error fetching purchase run progress:", err);
        // If no lots exist (old purchases), create default progress from purchase items
        const defaultItems = purchases.flatMap((p) =>
          p.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productCode: item.productCode,
            purchased: item.qty,
            sold: 0,
            remaining: item.qty, // Assume all remaining if no lots exist
          }))
        );
        // Group by productId and sum quantities
        const grouped = defaultItems.reduce((acc, item) => {
          const existing = acc.find((i) => i.productId === item.productId);
          if (existing) {
            existing.purchased += item.purchased;
            existing.remaining += item.remaining;
          } else {
            acc.push({ ...item });
          }
          return acc;
        }, [] as typeof defaultItems);
        setProgress({ items: grouped });
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, [purchaseRunId, purchases]);

  const getItemProgress = (productId: string) => {
    if (!progress) return null;
    return progress.items.find((item) => item.productId === productId);
  };

  if (isMobile) {
    // Mobile view: Show items as cards
    return (
      <Stack gap="sm">
        {purchases.flatMap((purchase) =>
          purchase.items.map((item, idx) => {
            const costPrice = convertToReportingCurrency(item.costPrice);
            const sellingPrice = convertToReportingCurrency(
              item.intendedSellingPrice
            );
            const expectedProfit = item.expectedProfit
              ? convertToReportingCurrency(item.expectedProfit)
              : {
                  amount: sellingPrice.amount - costPrice.amount,
                  currency: reportingCurrency,
                  exchangeRate: exchangeRates[reportingCurrency],
                };
            const totalCost = {
              amount: costPrice.amount * item.qty,
              currency: reportingCurrency,
              exchangeRate: exchangeRates[reportingCurrency],
            };
            const itemProgress = getItemProgress(item.productId);

            return (
              <Card key={`${purchase._id}_${idx}`} withBorder p="sm">
                <Stack gap="xs">
                  <div>
                    <Text fw={600} size="sm">
                      {item.productName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {item.productCode}
                    </Text>
                  </div>
                  <Group justify="space-between" gap="xs">
                    <Text size="xs" c="dimmed">
                      Qty:
                    </Text>
                    <Text size="xs" fw={500}>
                      {item.qty}
                    </Text>
                  </Group>
                  {itemProgress && (
                    <>
                      <Group justify="space-between" gap="xs">
                        <Text size="xs" c="dimmed">
                          Sold:
                        </Text>
                        <Text size="xs" c="green" fw={500}>
                          {itemProgress.sold}
                        </Text>
                      </Group>
                      <Group justify="space-between" gap="xs">
                        <Text size="xs" c="dimmed">
                          Remaining:
                        </Text>
                        <Text size="xs" c="blue" fw={500}>
                          {itemProgress.remaining}
                        </Text>
                      </Group>
                    </>
                  )}
                  <Group justify="space-between" gap="xs">
                    <Text size="xs" c="dimmed">
                      Cost:
                    </Text>
                    <Text size="xs">{formatMoney(costPrice)}</Text>
                  </Group>
                  <Group justify="space-between" gap="xs">
                    <Text size="xs" c="dimmed">
                      Selling:
                    </Text>
                    <Text size="xs">{formatMoney(sellingPrice)}</Text>
                  </Group>
                  <Group justify="space-between" gap="xs">
                    <Text size="xs" c="dimmed">
                      Profit:
                    </Text>
                    <Text size="xs" c="green" fw={500}>
                      {formatMoney(expectedProfit)}
                    </Text>
                  </Group>
                  <Group
                    justify="space-between"
                    gap="xs"
                    pt="xs"
                    style={{
                      borderTop: "1px solid var(--mantine-color-gray-3)",
                    }}
                  >
                    <Text size="xs" fw={600}>
                      Total Cost:
                    </Text>
                    <Text size="xs" fw={600}>
                      {formatMoney(totalCost)}
                    </Text>
                  </Group>
                </Stack>
              </Card>
            );
          })
        )}
        <Card
          withBorder
          p="sm"
          style={{ backgroundColor: "var(--mantine-color-gray-0)" }}
        >
          <Group justify="space-between">
            <Text size="sm" fw={700}>
              Total:
            </Text>
            <Text size="sm" fw={700}>
              {formatMoney(totalPurchaseAmount)}
            </Text>
          </Group>
        </Card>
      </Stack>
    );
  }

  return (
    <ScrollArea>
      <Table withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Product</Table.Th>
            <Table.Th>Code</Table.Th>
            <Table.Th align="right">Qty Purchased</Table.Th>
            <Table.Th align="right">Qty Sold</Table.Th>
            <Table.Th align="right">Qty Remaining</Table.Th>
            <Table.Th align="right">Cost Price</Table.Th>
            <Table.Th align="right">Selling Price</Table.Th>
            <Table.Th align="right">Expected Profit</Table.Th>
            <Table.Th align="right">Total Cost</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {purchases.flatMap((purchase) =>
            purchase.items.map((item, idx) => {
              const costPrice = convertToReportingCurrency(item.costPrice);
              const sellingPrice = convertToReportingCurrency(
                item.intendedSellingPrice
              );
              const expectedProfit = item.expectedProfit
                ? convertToReportingCurrency(item.expectedProfit)
                : {
                    amount: sellingPrice.amount - costPrice.amount,
                    currency: reportingCurrency,
                    exchangeRate: exchangeRates[reportingCurrency],
                  };
              const totalCost = {
                amount: costPrice.amount * item.qty,
                currency: reportingCurrency,
                exchangeRate: exchangeRates[reportingCurrency],
              };
              const profitMargin =
                sellingPrice.amount > 0
                  ? (
                      (expectedProfit.amount / sellingPrice.amount) *
                      100
                    ).toFixed(1)
                  : "0.0";

              const itemProgress = getItemProgress(item.productId);

              return (
                <Table.Tr key={`${purchase._id}_${idx}`}>
                  <Table.Td>{item.productName}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {item.productCode}
                    </Text>
                  </Table.Td>
                  <Table.Td align="right">{item.qty}</Table.Td>
                  <Table.Td align="right">
                    {loading ? (
                      <Text size="xs" c="dimmed">
                        Loading...
                      </Text>
                    ) : itemProgress ? (
                      <Text c="green" fw={500}>
                        {itemProgress.sold}
                      </Text>
                    ) : (
                      <Text c="dimmed">0</Text>
                    )}
                  </Table.Td>
                  <Table.Td align="right">
                    {loading ? (
                      <Text size="xs" c="dimmed">
                        Loading...
                      </Text>
                    ) : itemProgress ? (
                      <Text c="blue" fw={500}>
                        {itemProgress.remaining}
                      </Text>
                    ) : (
                      <Text c="blue" fw={500}>
                        {item.qty}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td align="right">{formatMoney(costPrice)}</Table.Td>
                  <Table.Td align="right">{formatMoney(sellingPrice)}</Table.Td>
                  <Table.Td align="right">
                    <Text c="green" fw={500}>
                      {formatMoney(expectedProfit)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      ({profitMargin}%)
                    </Text>
                  </Table.Td>
                  <Table.Td align="right" fw={500}>
                    {formatMoney(totalCost)}
                  </Table.Td>
                </Table.Tr>
              );
            })
          )}
        </Table.Tbody>
        <Table.Tfoot>
          <Table.Tr>
            <Table.Th colSpan={8} align="right">
              Total
            </Table.Th>
            <Table.Th align="right" fw={700}>
              {formatMoney(totalPurchaseAmount)}
            </Table.Th>
          </Table.Tr>
        </Table.Tfoot>
      </Table>
    </ScrollArea>
  );
}

// Component to display purchase run progress
function PurchaseRunProgressCard({
  purchaseRunId,
  formatMoney,
  convertToReportingCurrency,
}: {
  purchaseRunId: string;
  formatMoney: (money: Money) => string;
  convertToReportingCurrency: (money: Money) => Money;
}) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [progress, setProgress] = useState<{
    totalPurchased: number;
    totalSold: number;
    totalRemaining: number;
    progressPercentage: number;
    totalCost: Money;
    totalRevenue: Money;
    totalProfit: Money;
    expectedRevenue: Money;
    expectedProfit: Money;
    roi: number;
    expectedRoi: number;
    purchaseDate: string;
    firstSaleDate: string | null;
    lastSaleDate: string | null;
    daysSincePurchase: number;
    daysToFirstSale: number | null;
    daysToTurnover: number | null;
    averageDaysToSell: number | null;
    turnoverRate: number;
    daysOfInventoryRemaining: number | null;
    sellThroughRate: number;
    items: Array<{
      productId: string;
      productName: string;
      productCode: string;
      purchased: number;
      sold: number;
      remaining: number;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const data = await getPurchaseRunProgress(purchaseRunId);
        setProgress(data);
      } catch (err) {
        console.error("Error fetching purchase run progress:", err);
        setProgress(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, [purchaseRunId]);

  if (loading) {
    return (
      <Box>
        <Text size="sm" c="dimmed">
          Loading progress...
        </Text>
      </Box>
    );
  }

  if (!progress) {
    return null;
  }

  const isComplete = progress.progressPercentage >= 100;
  const progressColor = isComplete
    ? "green"
    : progress.progressPercentage > 50
    ? "blue"
    : "yellow";

  return (
    <Card withBorder p="sm" style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600} size="sm">
            FIFO Progress
          </Text>
          <Badge color={progressColor} variant="light">
            {progress.progressPercentage.toFixed(1)}% Complete
          </Badge>
        </Group>
        <Progress
          value={progress.progressPercentage}
          color={progressColor}
          size="lg"
          radius="xl"
        />
        {isMobile ? (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Purchased
              </Text>
              <Text fw={500} size="xs">
                {progress.totalPurchased} units
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Sold
              </Text>
              <Text fw={500} size="xs" c="green">
                {progress.totalSold} units
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Remaining
              </Text>
              <Text fw={500} size="xs" c="blue">
                {progress.totalRemaining} units
              </Text>
            </Group>
          </Stack>
        ) : (
          <Group gap="md">
            <div>
              <Text size="xs" c="dimmed">
                Purchased
              </Text>
              <Text fw={500} size="sm">
                {progress.totalPurchased} units
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Sold
              </Text>
              <Text fw={500} size="sm" c="green">
                {progress.totalSold} units
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Remaining
              </Text>
              <Text fw={500} size="sm" c="blue">
                {progress.totalRemaining} units
              </Text>
            </div>
          </Group>
        )}
        {progress.items.length > 0 && (
          <Box>
            <Text size="xs" c="dimmed" mb="xs">
              By Product:
            </Text>
            {isMobile ? (
              <Stack gap="xs">
                {progress.items.map((item) => (
                  <Card key={item.productId} withBorder p="xs">
                    <Stack gap={4}>
                      <Text size="xs" fw={600}>
                        {item.productName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {item.productCode}
                      </Text>
                      <Group justify="space-between" gap="xs">
                        <Text size="xs" c="dimmed">
                          Purchased:
                        </Text>
                        <Text size="xs">{item.purchased}</Text>
                      </Group>
                      <Group justify="space-between" gap="xs">
                        <Text size="xs" c="dimmed">
                          Sold:
                        </Text>
                        <Text size="xs" c="green">
                          {item.sold}
                        </Text>
                      </Group>
                      <Group justify="space-between" gap="xs">
                        <Text size="xs" c="dimmed">
                          Remaining:
                        </Text>
                        <Text size="xs" c="blue">
                          {item.remaining}
                        </Text>
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            ) : (
              <ScrollArea>
                <Table withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Product</Table.Th>
                      <Table.Th align="right">Purchased</Table.Th>
                      <Table.Th align="right">Sold</Table.Th>
                      <Table.Th align="right">Remaining</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {progress.items.map((item) => (
                      <Table.Tr key={item.productId}>
                        <Table.Td>
                          <Text size="xs">{item.productName}</Text>
                          <Text size="xs" c="dimmed">
                            {item.productCode}
                          </Text>
                        </Table.Td>
                        <Table.Td align="right">{item.purchased}</Table.Td>
                        <Table.Td align="right" c="green">
                          {item.sold}
                        </Table.Td>
                        <Table.Td align="right" c="blue">
                          {item.remaining}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Box>
        )}

        {/* Financial Metrics */}
        <Box
          pt="sm"
          style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
        >
          <Text size="xs" fw={600} mb="xs" c="dimmed">
            Financial Performance
          </Text>
          {isMobile ? (
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  ROI (Actual)
                </Text>
                <Text
                  size="xs"
                  fw={600}
                  c={progress.roi >= 0 ? "green" : "red"}
                >
                  {progress.roi.toFixed(1)}%
                </Text>
              </Group>
              {progress.expectedRoi !== progress.roi && (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    ROI (Expected)
                  </Text>
                  <Text size="xs" c="dimmed">
                    {progress.expectedRoi.toFixed(1)}%
                  </Text>
                </Group>
              )}
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Total Profit
                </Text>
                <Text size="xs" fw={500} c="green">
                  {formatMoney(
                    convertToReportingCurrency(progress.totalProfit)
                  )}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Total Revenue
                </Text>
                <Text size="xs" fw={500}>
                  {formatMoney(
                    convertToReportingCurrency(progress.totalRevenue)
                  )}
                </Text>
              </Group>
            </Stack>
          ) : (
            <Group gap="md">
              <div>
                <Text size="xs" c="dimmed">
                  ROI (Actual)
                </Text>
                <Text
                  fw={600}
                  size="sm"
                  c={progress.roi >= 0 ? "green" : "red"}
                >
                  {progress.roi.toFixed(1)}%
                </Text>
                {progress.expectedRoi !== progress.roi && (
                  <Text size="xs" c="dimmed">
                    Expected: {progress.expectedRoi.toFixed(1)}%
                  </Text>
                )}
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Total Profit
                </Text>
                <Text fw={500} size="sm" c="green">
                  {formatMoney(
                    convertToReportingCurrency(progress.totalProfit)
                  )}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Total Revenue
                </Text>
                <Text fw={500} size="sm">
                  {formatMoney(
                    convertToReportingCurrency(progress.totalRevenue)
                  )}
                </Text>
              </div>
            </Group>
          )}
        </Box>

        {/* Time Metrics */}
        <Box
          pt="sm"
          style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
        >
          <Text size="xs" fw={600} mb="xs" c="dimmed">
            Turnover Metrics
          </Text>
          {isMobile ? (
            <Stack gap="xs">
              {progress.daysToTurnover !== null && (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Days to Turnover
                  </Text>
                  <Text size="xs" fw={600} c="green">
                    {progress.daysToTurnover} days
                  </Text>
                </Group>
              )}
              {progress.averageDaysToSell !== null && (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Avg Days to Sell
                  </Text>
                  <Text size="xs" fw={500}>
                    {progress.averageDaysToSell.toFixed(1)} days
                  </Text>
                </Group>
              )}
              {progress.daysToFirstSale !== null && (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Days to First Sale
                  </Text>
                  <Text size="xs" fw={500}>
                    {progress.daysToFirstSale} days
                  </Text>
                </Group>
              )}
              {progress.turnoverRate > 0 ? (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Turnover Rate
                  </Text>
                  <Text size="xs" fw={500}>
                    {progress.turnoverRate.toFixed(2)} units/day
                  </Text>
                </Group>
              ) : (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Turnover Rate
                  </Text>
                  <Text size="xs" c="dimmed">
                    No sales yet
                  </Text>
                </Group>
              )}
              {progress.daysOfInventoryRemaining !== null && (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Days of Inventory Left
                  </Text>
                  <Text size="xs" fw={500} c="blue">
                    {progress.daysOfInventoryRemaining} days
                  </Text>
                </Group>
              )}
            </Stack>
          ) : (
            <Group gap="md">
              {progress.daysToTurnover !== null && (
                <div>
                  <Text size="xs" c="dimmed">
                    Days to Turnover
                  </Text>
                  <Text fw={600} size="sm" c="green">
                    {progress.daysToTurnover} days
                  </Text>
                </div>
              )}
              {progress.averageDaysToSell !== null && (
                <div>
                  <Text size="xs" c="dimmed">
                    Avg Days to Sell
                  </Text>
                  <Text fw={500} size="sm">
                    {progress.averageDaysToSell.toFixed(1)} days
                  </Text>
                </div>
              )}
              {progress.daysToFirstSale !== null && (
                <div>
                  <Text size="xs" c="dimmed">
                    Days to First Sale
                  </Text>
                  <Text fw={500} size="sm">
                    {progress.daysToFirstSale} days
                  </Text>
                </div>
              )}
              <div>
                <Text size="xs" c="dimmed">
                  Turnover Rate
                </Text>
                {progress.turnoverRate > 0 ? (
                  <Text fw={500} size="sm">
                    {progress.turnoverRate.toFixed(2)} units/day
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    No sales yet
                  </Text>
                )}
              </div>
              {progress.daysOfInventoryRemaining !== null && (
                <div>
                  <Text size="xs" c="dimmed">
                    Days of Inventory Left
                  </Text>
                  <Text fw={500} size="sm" c="blue">
                    {progress.daysOfInventoryRemaining} days
                  </Text>
                </div>
              )}
            </Group>
          )}
        </Box>
      </Stack>
    </Card>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const { dateRangeInfo } = useDateFilter();
  const { baseCurrency, exchangeRates, availableCurrencies } =
    useMoneyContext();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleDoc[]>([]);
  const [purchases, setPurchases] = useState<PurchaseDoc[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [cashFlowData, setCashFlowData] = useState<{
    openingCashBalance: Money;
    cashFromEquity: Money;
    closingCashBalance: Money;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<string>("pl");
  const [reportingCurrency, setReportingCurrency] =
    useState<CurrencyCode>(baseCurrency);

  // Convert money to reporting currency
  const convertToReportingCurrency = (money: Money): Money => {
    if (money.currency === reportingCurrency) return money;

    // First convert to base currency if not already
    const amountInBase =
      money.currency === baseCurrency
        ? money.amount
        : money.amount / money.exchangeRate;

    // Then convert from base to reporting currency
    const finalAmount = amountInBase * exchangeRates[reportingCurrency];

    return {
      amount: finalAmount,
      currency: reportingCurrency,
      exchangeRate: exchangeRates[reportingCurrency],
    };
  };

  // Sum money values in reporting currency
  const sumMoney = (moneyArray: Money[]): Money => {
    let totalInReportingCurrency = 0;

    moneyArray.forEach((money) => {
      const converted = convertToReportingCurrency(money);
      totalInReportingCurrency += converted.amount;
    });

    return {
      amount: totalInReportingCurrency,
      currency: reportingCurrency,
      exchangeRate: exchangeRates[reportingCurrency],
    };
  };

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

        // Fetch trial balance from ledger
        const balance = await generateTrialBalance(
          dateRangeInfo.startDate.toISOString(),
          dateRangeInfo.endDate.toISOString()
        );
        setTrialBalance(balance);

        // Fetch cash flow data
        const openingTrialBalance = await generateTrialBalance(
          new Date(0).toISOString(),
          dateRangeInfo.startDate.toISOString()
        );
        const openingCashAccount =
          openingTrialBalance.accounts[AccountCode.CASH];
        const openingCashBalance = openingCashAccount
          ? convertToReportingCurrency(openingCashAccount.netBalance)
          : createMoney(0, reportingCurrency, exchangeRates[reportingCurrency]);

        // Get opening balance entries to calculate cash from equity
        const ledgerDB = await getLedgerDB();
        const openingBalanceEntries = await ledgerDB.find({
          selector: {
            type: "ledger_entry",
            transactionType: "opening_balance",
            status: "posted",
          },
        });

        // Sum up cash contributions from opening balance entries
        let totalCashFromEquity = 0;
        (openingBalanceEntries.docs as LedgerEntryDoc[]).forEach((entry) => {
          entry.lines.forEach((line) => {
            if (
              line.accountCode === AccountCode.CASH &&
              line.debit.amount > 0
            ) {
              const converted = convertToReportingCurrency(line.debit);
              totalCashFromEquity += converted.amount;
            }
          });
        });
        const cashFromEquity = {
          amount: totalCashFromEquity,
          currency: reportingCurrency,
          exchangeRate: exchangeRates[reportingCurrency],
        };

        // Get closing cash balance
        const closingCashAccount = balance.accounts[AccountCode.CASH];
        const closingCashBalance = closingCashAccount
          ? convertToReportingCurrency(closingCashAccount.netBalance)
          : openingCashBalance;

        setCashFlowData({
          openingCashBalance,
          cashFromEquity,
          closingCashBalance,
        });
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    dateRangeInfo.startDate,
    dateRangeInfo.endDate,
    reportingCurrency,
    exchangeRates,
  ]);

  const renderProfitLoss = () => {
    // Convert all sales totals to reporting currency and sum
    const revenue = sumMoney(sales.map((sale) => sale.totalAmount));

    // Calculate COGS in reporting currency
    const costOfGoodsSold = sumMoney(
      sales.flatMap((sale) =>
        sale.items.map((item) => ({
          ...item.costPrice,
          amount: item.costPrice.amount * item.qty,
        }))
      )
    );

    // Calculate gross profit in reporting currency
    const grossProfit = {
      amount: revenue.amount - costOfGoodsSold.amount,
      currency: reportingCurrency,
      exchangeRate: exchangeRates[reportingCurrency],
    };

    return (
      <Stack gap="md">
        <Card withBorder>
          <Title order={4} mb="md">
            Revenue
          </Title>
          <Group justify="space-between">
            <Text>Total Sales</Text>
            <Text fw={500}>{formatMoney(revenue)}</Text>
          </Group>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Cost of Goods Sold
          </Title>
          <Group justify="space-between">
            <Text>Total COGS</Text>
            <Text fw={500}>{formatMoney(costOfGoodsSold)}</Text>
          </Group>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Profit
          </Title>
          <Group justify="space-between">
            <Text>Gross Profit</Text>
            <Text fw={500} c="green">
              {formatMoney(grossProfit)}
            </Text>
          </Group>
          <Group justify="space-between" mt="xs">
            <Text>Net Profit</Text>
            <Text fw={700} c="green">
              {formatMoney(grossProfit)}
            </Text>
          </Group>
        </Card>
      </Stack>
    );
  };

  const renderCashFlow = () => {
    if (!cashFlowData) {
      return (
        <Text ta="center" c="dimmed">
          Loading cash flow data...
        </Text>
      );
    }

    const { openingCashBalance, cashFromEquity, closingCashBalance } =
      cashFlowData;

    // Convert all sales amounts to reporting currency and sum
    const cashFromSales = sumMoney(sales.map((sale) => sale.totalAmount));

    // Convert all purchase amounts to reporting currency and sum
    const cashForPurchases = sumMoney(
      purchases.map((purchase) => purchase.totalAmount)
    );

    // Calculate net operating cash in reporting currency
    const netOperatingCash = {
      amount: cashFromSales.amount - cashForPurchases.amount,
      currency: reportingCurrency,
      exchangeRate: exchangeRates[reportingCurrency],
    };

    // Calculate net change in cash
    const netChangeInCash = {
      amount: closingCashBalance.amount - openingCashBalance.amount,
      currency: reportingCurrency,
      exchangeRate: exchangeRates[reportingCurrency],
    };

    return (
      <Stack gap="md">
        <Card withBorder>
          <Title order={4} mb="md">
            Opening Cash Balance
          </Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text>Beginning Cash</Text>
              <Text fw={500}>{formatMoney(openingCashBalance)}</Text>
            </Group>
          </Stack>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Financing Activities
          </Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text>Cash from Owner&apos;s Equity</Text>
              <Text fw={500} c="green">
                {formatMoney(cashFromEquity)}
              </Text>
            </Group>
            <Group
              justify="space-between"
              mt="xs"
              pt="xs"
              style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
            >
              <Text fw={700}>Net Financing Cash</Text>
              <Text fw={700} c="green">
                {formatMoney(cashFromEquity)}
              </Text>
            </Group>
          </Stack>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Operating Activities
          </Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text>Cash from Sales</Text>
              <Text fw={500} c="green">
                {formatMoney(cashFromSales)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text>Cash for Purchases</Text>
              <Text fw={500} c="red">
                {formatMoney(cashForPurchases)}
              </Text>
            </Group>
            <Group
              justify="space-between"
              mt="xs"
              pt="xs"
              style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
            >
              <Text fw={700}>Net Operating Cash</Text>
              <Text fw={700} c={netOperatingCash.amount >= 0 ? "green" : "red"}>
                {formatMoney(netOperatingCash)}
              </Text>
            </Group>
          </Stack>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Cash Flow Summary
          </Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text>Opening Cash Balance</Text>
              <Text fw={500}>{formatMoney(openingCashBalance)}</Text>
            </Group>
            <Group justify="space-between">
              <Text>Cash from Financing</Text>
              <Text fw={500} c="green">
                {formatMoney(cashFromEquity)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text>Cash from Operations</Text>
              <Text fw={500} c={netOperatingCash.amount >= 0 ? "green" : "red"}>
                {formatMoney(netOperatingCash)}
              </Text>
            </Group>
            <Group
              justify="space-between"
              mt="xs"
              pt="xs"
              style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
            >
              <Text fw={700}>Net Change in Cash</Text>
              <Text fw={700} c={netChangeInCash.amount >= 0 ? "green" : "red"}>
                {formatMoney(netChangeInCash)}
              </Text>
            </Group>
            <Group
              justify="space-between"
              mt="xs"
              pt="xs"
              style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
            >
              <Text fw={700}>Closing Cash Balance</Text>
              <Text fw={700}>{formatMoney(closingCashBalance)}</Text>
            </Group>
          </Stack>
        </Card>
      </Stack>
    );
  };

  const renderBalanceSheet = () => {
    if (!trialBalance) {
      return (
        <Text ta="center" c="dimmed">
          No balance sheet data available
        </Text>
      );
    }

    // Group accounts by type and convert to reporting currency
    const assets: Array<{ name: string; balance: Money }> = [];
    const liabilities: Array<{ name: string; balance: Money }> = [];
    const equity: Array<{ name: string; balance: Money }> = [];

    // Calculate Retained Earnings from Revenue and Expenses
    let retainedEarnings = createMoney(
      0,
      reportingCurrency,
      exchangeRates[reportingCurrency]
    );

    // Get revenue accounts (credit balance = revenue)
    const salesRevenueAccount =
      trialBalance.accounts[AccountCode.SALES_REVENUE];
    const revenueAmount = salesRevenueAccount
      ? convertToReportingCurrency({
          ...salesRevenueAccount.netBalance,
          amount: -salesRevenueAccount.netBalance.amount, // Flip sign for credit balance
        }).amount
      : 0;

    // Get expense accounts (debit balance = expenses)
    const cogsAccount = trialBalance.accounts[AccountCode.COST_OF_GOODS_SOLD];
    const cogsAmount = cogsAccount
      ? convertToReportingCurrency(cogsAccount.netBalance).amount
      : 0;

    const operatingExpensesAccount =
      trialBalance.accounts[AccountCode.OPERATING_EXPENSES];
    const operatingExpensesAmount = operatingExpensesAccount
      ? convertToReportingCurrency(operatingExpensesAccount.netBalance).amount
      : 0;

    // Retained Earnings = Revenue - Expenses
    const netIncome = revenueAmount - cogsAmount - operatingExpensesAmount;
    retainedEarnings = {
      amount: netIncome,
      currency: reportingCurrency,
      exchangeRate: exchangeRates[reportingCurrency],
    };

    Object.entries(trialBalance.accounts).forEach(([code, account]) => {
      // Skip revenue and expense accounts - they're used to calculate Retained Earnings
      if (
        code === AccountCode.SALES_REVENUE ||
        code === AccountCode.COST_OF_GOODS_SOLD ||
        code === AccountCode.OPERATING_EXPENSES
      ) {
        return;
      }

      // For Balance Sheet display:
      // - Assets: normal balance is Debit (positive netBalance) - use as-is
      // - Liabilities: normal balance is Credit (negative netBalance) - flip sign
      // - Equity: normal balance is Credit (negative netBalance) - flip sign
      let balanceForDisplay = account.netBalance;

      if (account.type === "liability" || account.type === "equity") {
        // Flip the sign for credit-balance accounts
        balanceForDisplay = {
          ...account.netBalance,
          amount: -account.netBalance.amount,
        };
      }

      const convertedBalance = convertToReportingCurrency(balanceForDisplay);
      const accountData = {
        name: account.name,
        balance: convertedBalance,
      };

      if (account.type === "asset") {
        assets.push(accountData);
      } else if (account.type === "liability") {
        liabilities.push(accountData);
      } else if (account.type === "equity") {
        equity.push(accountData);
      }
    });

    // Add calculated Retained Earnings to equity
    if (retainedEarnings.amount !== 0) {
      equity.push({
        name: "Retained Earnings",
        balance: retainedEarnings,
      });
    }

    // Calculate totals
    const totalAssets = {
      amount: assets.reduce((sum, acc) => sum + acc.balance.amount, 0),
      currency: reportingCurrency,
      exchangeRate: exchangeRates[reportingCurrency],
    };

    const totalLiabilities = {
      amount: liabilities.reduce((sum, acc) => sum + acc.balance.amount, 0),
      currency: reportingCurrency,
      exchangeRate: exchangeRates[reportingCurrency],
    };

    const totalEquity = {
      amount: equity.reduce((sum, acc) => sum + acc.balance.amount, 0),
      currency: reportingCurrency,
      exchangeRate: exchangeRates[reportingCurrency],
    };

    const totalLiabilitiesAndEquity = {
      amount: totalLiabilities.amount + totalEquity.amount,
      currency: reportingCurrency,
      exchangeRate: exchangeRates[reportingCurrency],
    };

    return (
      <Stack gap="md">
        <Card withBorder>
          <Title order={4} mb="md">
            Assets
          </Title>
          <Stack gap="xs">
            {assets.length > 0 ? (
              assets.map((asset) => (
                <Group key={asset.name} justify="space-between">
                  <Text>{asset.name}</Text>
                  <Text fw={500}>{formatMoney(asset.balance)}</Text>
                </Group>
              ))
            ) : (
              <Text size="sm" c="dimmed">
                No assets
              </Text>
            )}
            <Group
              justify="space-between"
              mt="xs"
              pt="xs"
              style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
            >
              <Text fw={700}>Total Assets</Text>
              <Text fw={700}>{formatMoney(totalAssets)}</Text>
            </Group>
          </Stack>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Liabilities
          </Title>
          <Stack gap="xs">
            {liabilities.length > 0 ? (
              liabilities.map((liability) => (
                <Group key={liability.name} justify="space-between">
                  <Text>{liability.name}</Text>
                  <Text fw={500}>{formatMoney(liability.balance)}</Text>
                </Group>
              ))
            ) : (
              <Text size="sm" c="dimmed">
                No liabilities
              </Text>
            )}
            <Group
              justify="space-between"
              mt="xs"
              pt="xs"
              style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
            >
              <Text fw={700}>Total Liabilities</Text>
              <Text fw={700}>{formatMoney(totalLiabilities)}</Text>
            </Group>
          </Stack>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Equity
          </Title>
          <Stack gap="xs">
            {equity.length > 0 ? (
              equity.map((equityItem) => (
                <Group key={equityItem.name} justify="space-between">
                  <Text>{equityItem.name}</Text>
                  <Text fw={500}>{formatMoney(equityItem.balance)}</Text>
                </Group>
              ))
            ) : (
              <Text size="sm" c="dimmed">
                No equity accounts
              </Text>
            )}
            <Group
              justify="space-between"
              mt="xs"
              pt="xs"
              style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
            >
              <Text fw={700}>Total Equity</Text>
              <Text fw={700}>{formatMoney(totalEquity)}</Text>
            </Group>
          </Stack>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Balance Sheet Equation
          </Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text>Total Liabilities + Equity</Text>
              <Text fw={500}>{formatMoney(totalLiabilitiesAndEquity)}</Text>
            </Group>
            <Group justify="space-between">
              <Text>Total Assets</Text>
              <Text fw={500}>{formatMoney(totalAssets)}</Text>
            </Group>
            <Group
              justify="space-between"
              mt="xs"
              pt="xs"
              style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
            >
              <Text fw={700}>
                {Math.abs(
                  totalAssets.amount - totalLiabilitiesAndEquity.amount
                ) < 0.01
                  ? "✓ Balanced"
                  : "⚠ Difference"}
              </Text>
              <Text
                fw={700}
                c={
                  Math.abs(
                    totalAssets.amount - totalLiabilitiesAndEquity.amount
                  ) < 0.01
                    ? "green"
                    : "red"
                }
              >
                {formatMoney({
                  amount: totalAssets.amount - totalLiabilitiesAndEquity.amount,
                  currency: reportingCurrency,
                  exchangeRate: exchangeRates[reportingCurrency],
                })}
              </Text>
            </Group>
          </Stack>
        </Card>
      </Stack>
    );
  };

  const renderPurchaseAnalysis = () => {
    if (purchases.length === 0) {
      return (
        <Text ta="center" c="dimmed">
          No purchases found for the selected period
        </Text>
      );
    }

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

    // Calculate summary statistics
    const totalPurchases = sumMoney(purchases.map((p) => p.totalAmount));
    const totalItems = purchases.reduce(
      (sum, p) =>
        sum + p.items.reduce((itemSum, item) => itemSum + item.qty, 0),
      0
    );
    // Calculate total expected profit: (sellingPrice - costPrice) * qty for each item
    const totalExpectedProfit = sumMoney(
      purchases.flatMap((p) =>
        p.items.map((item) => {
          // expectedProfit is per unit, so multiply by quantity
          const profitPerUnit = item.expectedProfit
            ? convertToReportingCurrency(item.expectedProfit)
            : {
                amount:
                  convertToReportingCurrency(item.intendedSellingPrice).amount -
                  convertToReportingCurrency(item.costPrice).amount,
                currency: reportingCurrency,
                exchangeRate: exchangeRates[reportingCurrency],
              };
          return {
            ...profitPerUnit,
            amount: profitPerUnit.amount * item.qty,
          };
        })
      )
    );
    const averagePurchaseSize =
      purchases.length > 0 ? totalPurchases.amount / purchases.length : 0;

    return (
      <Stack gap="lg">
        {/* Summary Statistics */}
        <Card withBorder p={isMobile ? "sm" : "md"}>
          <Title order={isMobile ? 5 : 4} mb={isMobile ? "sm" : "md"}>
            Summary
          </Title>
          {isMobile ? (
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Total Purchase Runs
                </Text>
                <Text size="sm">{purchaseRuns.length}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Total Purchases
                </Text>
                <Text size="sm">{purchases.length}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Total Purchase Cost
                </Text>
                <Text size="sm" fw={700}>
                  {formatMoney(totalPurchases)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Total Items Purchased
                </Text>
                <Text size="sm">{totalItems} units</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Average Purchase Size
                </Text>
                <Text size="sm">
                  {formatMoney({
                    amount: averagePurchaseSize,
                    currency: reportingCurrency,
                    exchangeRate: exchangeRates[reportingCurrency],
                  })}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Total Expected Profit
                </Text>
                <Text size="sm" fw={700} c="green">
                  {formatMoney(totalExpectedProfit)}
                </Text>
              </Group>
            </Stack>
          ) : (
            <Table withTableBorder>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td fw={500}>Total Purchase Runs</Table.Td>
                  <Table.Td align="right">{purchaseRuns.length}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Total Purchases</Table.Td>
                  <Table.Td align="right">{purchases.length}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Total Purchase Cost</Table.Td>
                  <Table.Td align="right" fw={700}>
                    {formatMoney(totalPurchases)}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Total Items Purchased</Table.Td>
                  <Table.Td align="right">{totalItems} units</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Average Purchase Size</Table.Td>
                  <Table.Td align="right">
                    {formatMoney({
                      amount: averagePurchaseSize,
                      currency: reportingCurrency,
                      exchangeRate: exchangeRates[reportingCurrency],
                    })}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Total Expected Profit</Table.Td>
                  <Table.Td align="right" fw={700} c="green">
                    {formatMoney(totalExpectedProfit)}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          )}
        </Card>

        {/* Detailed Purchase Runs */}
        <Title order={4}>Purchase Runs</Title>
        {purchaseRuns.map((run) => {
          // We'll fetch progress data in a component below
          // Convert all purchase amounts to reporting currency and sum
          const totalPurchaseAmount = sumMoney(
            run.purchases.map((p) => p.totalAmount)
          );

          // Calculate totals for this run
          const runTotalItems = run.purchases.reduce(
            (sum, p) =>
              sum + p.items.reduce((itemSum, item) => itemSum + item.qty, 0),
            0
          );
          // Calculate expected profit for this run: (sellingPrice - costPrice) * qty for each item
          const runExpectedProfit = sumMoney(
            run.purchases.flatMap((p) =>
              p.items.map((item) => {
                // expectedProfit is per unit, so multiply by quantity
                const profitPerUnit = item.expectedProfit
                  ? convertToReportingCurrency(item.expectedProfit)
                  : {
                      amount:
                        convertToReportingCurrency(item.intendedSellingPrice)
                          .amount -
                        convertToReportingCurrency(item.costPrice).amount,
                      currency: reportingCurrency,
                      exchangeRate: exchangeRates[reportingCurrency],
                    };
                return {
                  ...profitPerUnit,
                  amount: profitPerUnit.amount * item.qty,
                };
              })
            )
          );

          // Get supplier and payment method (from first purchase in run)
          const firstPurchase = run.purchases[0];
          // Check both supplier and supplierName fields (for backward compatibility with old purchases)
          const supplier =
            firstPurchase.supplier ||
            (firstPurchase as PurchaseDoc & { supplierName?: string })
              .supplierName ||
            "Not specified";
          const paymentMethod = firstPurchase.paymentMethod;

          return (
            <Card key={run.purchaseRunId} withBorder p={isMobile ? "sm" : "md"}>
              <Stack gap={isMobile ? "sm" : "md"}>
                {/* Header */}
                {isMobile ? (
                  <Stack gap="xs">
                    <div>
                      <Text fw={700} size={isMobile ? "md" : "lg"}>
                        Purchase Run #{run.purchaseRunId.split("_")[1]}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {new Date(run.timestamp).toLocaleString()}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        Total Cost
                      </Text>
                      <Text fw={700} size="md">
                        {formatMoney(totalPurchaseAmount)}
                      </Text>
                    </div>
                  </Stack>
                ) : (
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text fw={700} size="lg">
                        Purchase Run #{run.purchaseRunId.split("_")[1]}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {new Date(run.timestamp).toLocaleString()}
                      </Text>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Text size="sm" c="dimmed">
                        Total Cost
                      </Text>
                      <Text fw={700} size="lg">
                        {formatMoney(totalPurchaseAmount)}
                      </Text>
                    </div>
                  </Group>
                )}

                {/* Purchase Info */}
                {isMobile ? (
                  <Stack gap="xs">
                    <div>
                      <Text size="xs" c="dimmed">
                        Supplier
                      </Text>
                      <Text size="sm" fw={500}>
                        {supplier}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        Payment Method
                      </Text>
                      <Text size="sm" fw={500} tt="capitalize">
                        {paymentMethod.replace("_", " ")}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        Items
                      </Text>
                      <Text size="sm" fw={500}>
                        {runTotalItems} units
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        Expected Profit
                      </Text>
                      <Text size="sm" fw={500} c="green">
                        {formatMoney(runExpectedProfit)}
                      </Text>
                    </div>
                  </Stack>
                ) : (
                  <Group gap="xl">
                    <div>
                      <Text size="sm" c="dimmed">
                        Supplier
                      </Text>
                      <Text fw={500}>{supplier}</Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">
                        Payment Method
                      </Text>
                      <Text fw={500} tt="capitalize">
                        {paymentMethod.replace("_", " ")}
                      </Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">
                        Items
                      </Text>
                      <Text fw={500}>{runTotalItems} units</Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">
                        Expected Profit
                      </Text>
                      <Text fw={500} c="green">
                        {formatMoney(runExpectedProfit)}
                      </Text>
                    </div>
                  </Group>
                )}

                {/* FIFO Progress Tracking */}
                <PurchaseRunProgressCard
                  purchaseRunId={run.purchaseRunId}
                  formatMoney={formatMoney}
                  convertToReportingCurrency={convertToReportingCurrency}
                />

                {/* Items Table */}
                <PurchaseRunItemsTable
                  purchases={run.purchases}
                  purchaseRunId={run.purchaseRunId}
                  totalPurchaseAmount={totalPurchaseAmount}
                  convertToReportingCurrency={convertToReportingCurrency}
                  formatMoney={formatMoney}
                  reportingCurrency={reportingCurrency}
                  exchangeRates={exchangeRates}
                />

                {/* Notes if available */}
                {firstPurchase.notes && (
                  <div>
                    <Text size="sm" c="dimmed" mb="xs">
                      Notes
                    </Text>
                    <Text size="sm">{firstPurchase.notes}</Text>
                  </div>
                )}
              </Stack>
            </Card>
          );
        })}
      </Stack>
    );
  };

  return (
    <Stack gap="lg">
      <Paper
        p="md"
        withBorder
        style={{ backgroundColor: "var(--mantine-color-gray-0)" }}
      >
        <Group justify="space-between" align="center">
          <Title order={2}>Financial Reports</Title>
          <Group gap="xs" align="center">
            <Text size="sm" fw={500}>
              Reporting Currency:
            </Text>
            <Select
              value={reportingCurrency}
              onChange={(value) => setReportingCurrency(value as CurrencyCode)}
              data={availableCurrencies
                .map((code) => CURRENCY_INFO[code])
                .filter((info) => info !== undefined)
                .map((info) => ({
                  value: info.code,
                  label: `${info.flag} ${info.code}`,
                }))}
              size="sm"
              style={{ width: 120 }}
            />
          </Group>
        </Group>
      </Paper>

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
