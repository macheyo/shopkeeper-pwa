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
                      <Text size="sm">Debit:</Text>
                      <Text>{formatMoney(account.debitBalance)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Credit:</Text>
                      <Text>{formatMoney(account.creditBalance)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        Balance:
                      </Text>
                      <Text fw={500}>{formatMoney(account.netBalance)}</Text>
                    </Group>
                  </Stack>
                </Card>
              )
            )}

          {/* Totals card */}
          {trialBalance && (
            <Card withBorder p="sm">
              <Stack gap="xs">
                <Text fw={700}>Trial Balance Totals</Text>
                <Group justify="space-between">
                  <Text size="sm">Total Debits:</Text>
                  <Text>{formatMoney(trialBalance.totalDebits)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Total Credits:</Text>
                  <Text>{formatMoney(trialBalance.totalCredits)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    Net Balance:
                  </Text>
                  <Text fw={500}>
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
          <Title order={4} mb="md">
            Trial Balance
          </Title>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Account</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th align="right">Debit</Table.Th>
                <Table.Th align="right">Credit</Table.Th>
                <Table.Th align="right">Balance</Table.Th>
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
                      <Table.Td
                        style={{ textAlign: "right", fontFamily: "monospace" }}
                      >
                        {formatMoney(account.debitBalance)}
                      </Table.Td>
                      <Table.Td
                        style={{ textAlign: "right", fontFamily: "monospace" }}
                      >
                        {formatMoney(account.creditBalance)}
                      </Table.Td>
                      <Table.Td
                        style={{ textAlign: "right", fontFamily: "monospace" }}
                      >
                        {formatMoney(account.netBalance)}
                      </Table.Td>
                    </Table.Tr>
                  )
                )}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th colSpan={2}>Total</Table.Th>
                <Table.Th align="right">
                  {trialBalance && formatMoney(trialBalance.totalDebits)}
                </Table.Th>
                <Table.Th align="right">
                  {trialBalance && formatMoney(trialBalance.totalCredits)}
                </Table.Th>
                <Table.Th align="right">
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
                  <Box style={{ fontFamily: "monospace" }}>
                    {entry.debit.amount > 0 && (
                      <Group justify="space-between">
                        <Text size="sm">Debit</Text>
                        <Text style={{ textAlign: "right" }}>
                          {formatMoney(entry.debit)}
                        </Text>
                      </Group>
                    )}
                    {entry.credit.amount > 0 && (
                      <Group justify="space-between">
                        <Text size="sm">Credit</Text>
                        <Text style={{ textAlign: "right" }}>
                          {formatMoney(entry.credit)}
                        </Text>
                      </Group>
                    )}
                    <Divider my="xs" />
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        Balance
                      </Text>
                      <Text fw={500} style={{ textAlign: "right" }}>
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
                <Text fw={700}>Account Totals</Text>
                <Group justify="space-between">
                  <Text size="sm">Total Debits:</Text>
                  <Text>{formatMoney(accountHistory.totalDebits)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Total Credits:</Text>
                  <Text>{formatMoney(accountHistory.totalCredits)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    Closing Balance:
                  </Text>
                  <Text fw={500}>
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
              <Title order={4}>{accountHistory.accountName} History</Title>
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
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th align="right">Debit</Table.Th>
                  <Table.Th align="right">Credit</Table.Th>
                  <Table.Th align="right">Balance</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {accountHistory.entries.map((entry, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </Table.Td>
                    <Table.Td>{entry.description}</Table.Td>
                    <Table.Td align="right">
                      {formatMoney(entry.debit)}
                    </Table.Td>
                    <Table.Td align="right">
                      {formatMoney(entry.credit)}
                    </Table.Td>
                    <Table.Td align="right">
                      {formatMoney(entry.balance)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th colSpan={2}>Total</Table.Th>
                  <Table.Th align="right">
                    {formatMoney(accountHistory.totalDebits)}
                  </Table.Th>
                  <Table.Th align="right">
                    {formatMoney(accountHistory.totalCredits)}
                  </Table.Th>
                  <Table.Th align="right">
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
