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
import {
  TrialBalance,
  AccountType,
  AccountCode,
  LedgerEntryDoc,
} from "@/types/accounting";
import { convertMoneyWithRates } from "@/types/money";

export default function ReportsPage() {
  const router = useRouter();
  const { dateRangeInfo } = useDateFilter();
  const { baseCurrency, exchangeRates } = useMoneyContext();
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
        <Card withBorder p="md">
          <Title order={4} mb="md">
            Summary
          </Title>
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
        </Card>

        {/* Detailed Purchase Runs */}
        <Title order={4}>Purchase Runs</Title>
        {purchaseRuns.map((run) => {
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
            (firstPurchase as any).supplierName ||
            "Not specified";
          const paymentMethod = firstPurchase.paymentMethod;

          return (
            <Card key={run.purchaseRunId} withBorder p="md">
              <Stack gap="md">
                {/* Header */}
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

                {/* Purchase Info */}
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

                {/* Items Table */}
                <Table withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Product</Table.Th>
                      <Table.Th>Code</Table.Th>
                      <Table.Th align="right">Qty</Table.Th>
                      <Table.Th align="right">Cost Price</Table.Th>
                      <Table.Th align="right">Selling Price</Table.Th>
                      <Table.Th align="right">Expected Profit</Table.Th>
                      <Table.Th align="right">Total Cost</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {run.purchases.flatMap((purchase) =>
                      purchase.items.map((item, idx) => {
                        const costPrice = convertToReportingCurrency(
                          item.costPrice
                        );
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
                              {formatMoney(costPrice)}
                            </Table.Td>
                            <Table.Td align="right">
                              {formatMoney(sellingPrice)}
                            </Table.Td>
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
                      <Table.Th colSpan={6} align="right">
                        Total
                      </Table.Th>
                      <Table.Th align="right" fw={700}>
                        {formatMoney(totalPurchaseAmount)}
                      </Table.Th>
                    </Table.Tr>
                  </Table.Tfoot>
                </Table>

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
      <Group justify="space-between" align="center">
        <Title order={2}>Financial Reports</Title>
        <Select
          label="Reporting Currency"
          value={reportingCurrency}
          onChange={(value) => setReportingCurrency(value as CurrencyCode)}
          data={Object.values(CURRENCY_INFO).map((info) => ({
            value: info.code,
            label: `${info.flag} ${info.code}`,
          }))}
          size="sm"
          style={{ width: 120 }}
        />
      </Group>

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
