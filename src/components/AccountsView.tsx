"use client";

import React, { useState, useEffect } from "react";
import {
  Title,
  Stack,
  Card,
  Table,
  Text,
  Group,
  Badge,
  Box,
  Drawer,
  Divider,
} from "@mantine/core";
import { generateTrialBalance, getAccountHistory } from "@/lib/accounting";
import {
  AccountCode,
  AccountType,
  TrialBalance,
  AccountHistory,
} from "@/types/accounting";
import { formatMoney, createMoney, BASE_CURRENCY, Money } from "@/types/money";
import { useDateFilter } from "@/contexts/DateFilterContext";

// Style constants for consistent display
const moneyTextStyle = {
  fontFamily: "monospace",
  textAlign: "right" as const,
};

const labelTextStyle = {
  textAlign: "left" as const,
};

const titleTextStyle = {
  textAlign: "left" as const,
  fontWeight: 500,
};

export default function AccountsView() {
  const { dateRangeInfo } = useDateFilter();
  const [loading, setLoading] = useState(true);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountCode | null>(
    null
  );
  const [accountHistory, setAccountHistory] = useState<AccountHistory | null>(
    null
  );

  // Fetch trial balance when date range changes
  useEffect(() => {
    const fetchTrialBalance = async () => {
      setLoading(true);
      try {
        const balance = await generateTrialBalance(
          dateRangeInfo.startDate.toISOString(),
          dateRangeInfo.endDate.toISOString()
        );
        setTrialBalance(balance);
      } catch (err) {
        console.error("Error fetching trial balance:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrialBalance();
  }, [dateRangeInfo.startDate, dateRangeInfo.endDate]);

  // Fetch account history when account selection changes
  useEffect(() => {
    const fetchAccountHistory = async () => {
      if (!selectedAccount) {
        setAccountHistory(null);
        return;
      }

      try {
        const history = await getAccountHistory(
          selectedAccount,
          dateRangeInfo.startDate.toISOString(),
          dateRangeInfo.endDate.toISOString()
        );
        setAccountHistory(history);
      } catch (err) {
        console.error("Error fetching account history:", err);
      }
    };

    fetchAccountHistory();
  }, [selectedAccount, dateRangeInfo.startDate, dateRangeInfo.endDate]);

  const getAccountTypeColor = (type: AccountType): string => {
    const colors: Record<AccountType, string> = {
      asset: "blue",
      liability: "red",
      equity: "green",
      revenue: "teal",
      expense: "orange",
      contra: "grape",
    };
    return colors[type];
  };

  // Helper components for consistent styling
  const MoneyText = ({ value }: { value: Money }) => (
    <Text style={moneyTextStyle}>{formatMoney(value)}</Text>
  );

  const LabelText = ({ children }: { children: React.ReactNode }) => (
    <Text size="sm" style={labelTextStyle}>
      {children}
    </Text>
  );

  const TitleText = ({ children }: { children: React.ReactNode }) => (
    <Text fw={500} style={titleTextStyle}>
      {children}
    </Text>
  );

  if (loading) {
    return <Text ta="center">Loading accounts...</Text>;
  }

  return (
    <Stack gap="lg">
      {/* Mobile view */}
      <Box hiddenFrom="sm">
        <Stack gap="md">
          {trialBalance &&
            Object.entries(trialBalance.accounts).map(
              ([code, account]: [
                string,
                {
                  name: string;
                  type: AccountType;
                  debitBalance: Money;
                  creditBalance: Money;
                  netBalance: Money;
                }
              ]) => (
                <Card
                  key={code}
                  withBorder
                  p="sm"
                  onClick={() => setSelectedAccount(code as AccountCode)}
                  style={{ cursor: "pointer" }}
                >
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text fw={700}>{account.name}</Text>
                      <Badge color={getAccountTypeColor(account.type)}>
                        {account.type}
                      </Badge>
                    </Group>
                    <Group justify="space-between">
                      <LabelText>Debit:</LabelText>
                      <MoneyText value={account.debitBalance} />
                    </Group>
                    <Group justify="space-between">
                      <LabelText>Credit:</LabelText>
                      <MoneyText value={account.creditBalance} />
                    </Group>
                    <Group justify="space-between">
                      <TitleText>Balance:</TitleText>
                      <Text fw={500} style={moneyTextStyle}>
                        {formatMoney(account.netBalance)}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              )
            )}

          {/* Totals card */}
          {trialBalance && (
            <Card withBorder p="sm">
              <Stack gap="xs">
                <Text fw={700} style={titleTextStyle}>
                  Trial Balance Totals
                </Text>
                <Group justify="space-between">
                  <LabelText>Total Debits:</LabelText>
                  <MoneyText value={trialBalance.totalDebits} />
                </Group>
                <Group justify="space-between">
                  <LabelText>Total Credits:</LabelText>
                  <MoneyText value={trialBalance.totalCredits} />
                </Group>
                <Group justify="space-between">
                  <TitleText>Net Balance:</TitleText>
                  <Text fw={500} style={moneyTextStyle}>
                    {formatMoney(
                      createMoney(
                        trialBalance.totalDebits.amount -
                          trialBalance.totalCredits.amount,
                        BASE_CURRENCY
                      )
                    )}
                  </Text>
                </Group>
              </Stack>
            </Card>
          )}
        </Stack>
      </Box>

      {/* Desktop view */}
      <Box visibleFrom="sm">
        <Card withBorder>
          <Title order={4} mb="md" style={titleTextStyle}>
            Trial Balance
          </Title>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={labelTextStyle}>Account</Table.Th>
                <Table.Th style={labelTextStyle}>Type</Table.Th>
                <Table.Th style={moneyTextStyle}>Debit</Table.Th>
                <Table.Th style={moneyTextStyle}>Credit</Table.Th>
                <Table.Th style={moneyTextStyle}>Balance</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {trialBalance &&
                Object.entries(trialBalance.accounts).map(
                  ([code, account]: [
                    string,
                    {
                      name: string;
                      type: AccountType;
                      debitBalance: Money;
                      creditBalance: Money;
                      netBalance: Money;
                    }
                  ]) => (
                    <Table.Tr
                      key={code}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedAccount(code as AccountCode)}
                    >
                      <Table.Td>{account.name}</Table.Td>
                      <Table.Td>
                        <Badge color={getAccountTypeColor(account.type)}>
                          {account.type}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={moneyTextStyle}>
                        {formatMoney(account.debitBalance)}
                      </Table.Td>
                      <Table.Td style={moneyTextStyle}>
                        {formatMoney(account.creditBalance)}
                      </Table.Td>
                      <Table.Td style={moneyTextStyle}>
                        {formatMoney(account.netBalance)}
                      </Table.Td>
                    </Table.Tr>
                  )
                )}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th colSpan={2} style={titleTextStyle}>
                  Total
                </Table.Th>
                <Table.Th style={moneyTextStyle}>
                  {trialBalance && formatMoney(trialBalance.totalDebits)}
                </Table.Th>
                <Table.Th style={moneyTextStyle}>
                  {trialBalance && formatMoney(trialBalance.totalCredits)}
                </Table.Th>
                <Table.Th style={moneyTextStyle}>
                  {trialBalance &&
                    formatMoney(
                      createMoney(
                        trialBalance.totalDebits.amount -
                          trialBalance.totalCredits.amount,
                        BASE_CURRENCY
                      )
                    )}
                </Table.Th>
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </Card>
      </Box>

      {/* Account history drawer for mobile */}
      <Drawer
        opened={!!selectedAccount && !!accountHistory}
        onClose={() => setSelectedAccount(null)}
        title={
          accountHistory && (
            <Group gap="xs">
              <Text fw={700}>{accountHistory.accountName}</Text>
              <Badge color={getAccountTypeColor(accountHistory.accountType)}>
                {accountHistory.accountType}
              </Badge>
            </Group>
          )
        }
        position="bottom"
        size="90%"
      >
        {accountHistory && (
          <Stack gap="md">
            {/* Journal entries */}
            {accountHistory.entries.map((entry, index) => (
              <Card key={index} withBorder p="sm">
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </Text>
                  <Text fw={500}>{entry.description}</Text>
                  <Text size="sm" c="dimmed">
                    {entry.transactionType === "sale" && "Sale transaction"}
                    {entry.transactionType === "purchase" &&
                      "Purchase transaction"}
                    {entry.transactionType === "cash_adjustment" &&
                      "Cash count adjustment"}
                  </Text>
                  <Box>
                    {entry.debit.amount > 0 && (
                      <Group justify="space-between">
                        <LabelText>Debit</LabelText>
                        <MoneyText value={entry.debit} />
                      </Group>
                    )}
                    {entry.credit.amount > 0 && (
                      <Group justify="space-between">
                        <LabelText>Credit</LabelText>
                        <MoneyText value={entry.credit} />
                      </Group>
                    )}
                    <Divider my="xs" />
                    <Group justify="space-between">
                      <TitleText>Balance</TitleText>
                      <Text fw={500} style={moneyTextStyle}>
                        {formatMoney(entry.balance)}
                      </Text>
                    </Group>
                  </Box>
                </Stack>
              </Card>
            ))}

            {/* Account totals */}
            <Card withBorder p="sm">
              <Stack gap="xs">
                <Text fw={700} style={titleTextStyle}>
                  Account Totals
                </Text>
                <Group justify="space-between">
                  <LabelText>Total Debits:</LabelText>
                  <MoneyText value={accountHistory.totalDebits} />
                </Group>
                <Group justify="space-between">
                  <LabelText>Total Credits:</LabelText>
                  <MoneyText value={accountHistory.totalCredits} />
                </Group>
                <Group justify="space-between">
                  <TitleText>Closing Balance:</TitleText>
                  <Text fw={500} style={moneyTextStyle}>
                    {formatMoney(accountHistory.closingBalance)}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Stack>
        )}
      </Drawer>

      {/* Desktop account history */}
      {accountHistory && (
        <Box visibleFrom="sm">
          <Card withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4} style={titleTextStyle}>
                {accountHistory.accountName} History
              </Title>
              <Badge
                color={getAccountTypeColor(accountHistory.accountType)}
                size="lg"
              >
                {accountHistory.accountType}
              </Badge>
            </Group>

            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={labelTextStyle}>Date</Table.Th>
                  <Table.Th style={labelTextStyle}>Description</Table.Th>
                  <Table.Th style={moneyTextStyle}>Debit</Table.Th>
                  <Table.Th style={moneyTextStyle}>Credit</Table.Th>
                  <Table.Th style={moneyTextStyle}>Balance</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {accountHistory.entries.map((entry, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </Table.Td>
                    <Table.Td>{entry.description}</Table.Td>
                    <Table.Td style={moneyTextStyle}>
                      {formatMoney(entry.debit)}
                    </Table.Td>
                    <Table.Td style={moneyTextStyle}>
                      {formatMoney(entry.credit)}
                    </Table.Td>
                    <Table.Td style={moneyTextStyle}>
                      {formatMoney(entry.balance)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th colSpan={2} style={titleTextStyle}>
                    Total
                  </Table.Th>
                  <Table.Th style={moneyTextStyle}>
                    {formatMoney(accountHistory.totalDebits)}
                  </Table.Th>
                  <Table.Th style={moneyTextStyle}>
                    {formatMoney(accountHistory.totalCredits)}
                  </Table.Th>
                  <Table.Th style={moneyTextStyle}>
                    {formatMoney(accountHistory.closingBalance)}
                  </Table.Th>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </Card>
        </Box>
      )}
    </Stack>
  );
}
