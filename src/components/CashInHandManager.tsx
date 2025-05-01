import React, { useState, useEffect } from "react";
import {
  Money,
  createMoney,
  DEFAULT_EXCHANGE_RATES,
  CurrencyCode,
  CURRENCY_INFO,
  convertMoney,
  formatMoney,
  BASE_CURRENCY,
} from "@/types/money";
import { CashInHand, SaleDoc, PurchaseDoc } from "@/types";
import { getCashInHandDB, getSalesDB, getPurchasesDB } from "@/lib/databases";
import { createCashAdjustmentEntry } from "@/lib/accounting";
import MoneyInput from "./MoneyInput";
import { useDateFilter } from "@/contexts/DateFilterContext";
import {
  Stack,
  Group,
  Text,
  Select,
  Textarea,
  Button,
  Paper,
  Badge,
  Divider,
} from "@mantine/core";

export function CashInHandManager() {
  const { dateRangeInfo } = useDateFilter();
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>("KES");
  const [physicalCash, setPhysicalCash] = useState<Money>(
    createMoney(0, selectedCurrency, DEFAULT_EXCHANGE_RATES[selectedCurrency])
  );
  const [expectedCash, setExpectedCash] = useState<Money>(
    createMoney(0, selectedCurrency, DEFAULT_EXCHANGE_RATES[selectedCurrency])
  );
  const [difference, setDifference] = useState<Money>(
    createMoney(0, selectedCurrency, DEFAULT_EXCHANGE_RATES[selectedCurrency])
  );
  const [openingBalance, setOpeningBalance] = useState<Money>(
    createMoney(0, selectedCurrency, DEFAULT_EXCHANGE_RATES[selectedCurrency])
  );
  const [closingBalance, setClosingBalance] = useState<Money>(
    createMoney(0, selectedCurrency, DEFAULT_EXCHANGE_RATES[selectedCurrency])
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  // Currency options for the select input
  const currencyOptions = Object.values(CURRENCY_INFO).map((currency) => ({
    value: currency.code,
    label: `${currency.flag} ${currency.code} - ${currency.name}`,
  }));

  // Calculate opening and closing balances based on date range
  const calculateBalances = async () => {
    try {
      const cashInHandDB = await getCashInHandDB();

      // Get cash counts within the date range
      const result = await cashInHandDB.find({
        selector: {
          type: "cash_in_hand",
          timestamp: {
            $gte: dateRangeInfo.startDate.toISOString(),
            $lt: dateRangeInfo.endDate.toISOString(),
          },
        },
        sort: [{ timestamp: "asc" }],
      });

      const cashCounts = result.docs as CashInHand[];

      if (cashCounts.length > 0) {
        // First count in period is opening balance
        setOpeningBalance(cashCounts[0].amount);
        // Last count in period is closing balance
        setClosingBalance(cashCounts[cashCounts.length - 1].amount);
      }
    } catch (error) {
      console.error("Error calculating balances:", error);
    }
  };

  useEffect(() => {
    calculateExpectedCash();
    calculateBalances();
  }, [dateRangeInfo]); // Recalculate when date range changes

  useEffect(() => {
    // Calculate difference whenever physical or expected cash changes
    setDifference({
      amount: physicalCash.amount - expectedCash.amount,
      currency: selectedCurrency,
      exchangeRate: DEFAULT_EXCHANGE_RATES[selectedCurrency],
    });
  }, [physicalCash, expectedCash, selectedCurrency]);

  const calculateExpectedCash = async () => {
    try {
      setLoading(true);
      const salesDB = await getSalesDB();
      const purchasesDB = await getPurchasesDB();

      // Get cash sales within date range
      const salesResult = await salesDB.find({
        selector: {
          type: "sale",
          paymentMethod: "cash",
          timestamp: {
            $gte: dateRangeInfo.startDate.toISOString(),
            $lt: dateRangeInfo.endDate.toISOString(),
          },
        },
      });

      // Get cash purchases within date range
      const purchasesResult = await purchasesDB.find({
        selector: {
          type: "purchase",
          paymentMethod: "cash",
          timestamp: {
            $gte: dateRangeInfo.startDate.toISOString(),
            $lt: dateRangeInfo.endDate.toISOString(),
          },
        },
      });

      // Calculate total cash from sales in base currency
      const totalCashSales = (salesResult.docs as SaleDoc[]).reduce(
        (total: number, sale: SaleDoc) => {
          // Convert each sale amount to base currency
          const saleInBase = convertMoney(
            sale.totalAmount,
            BASE_CURRENCY,
            DEFAULT_EXCHANGE_RATES[BASE_CURRENCY]
          );
          return total + saleInBase.amount;
        },
        0
      );

      // Calculate total cash spent on purchases in base currency
      const totalCashPurchases = (purchasesResult.docs as PurchaseDoc[]).reduce(
        (total: number, purchase: PurchaseDoc) => {
          // Convert each purchase amount to base currency
          const purchaseInBase = convertMoney(
            purchase.totalAmount,
            BASE_CURRENCY,
            DEFAULT_EXCHANGE_RATES[BASE_CURRENCY]
          );
          return total + purchaseInBase.amount;
        },
        0
      );

      // Expected cash is sales minus purchases (in base currency)
      const expectedAmountBase = totalCashSales - totalCashPurchases;

      // Convert expected amount to selected currency
      setExpectedCash(
        convertMoney(
          createMoney(
            expectedAmountBase,
            BASE_CURRENCY,
            DEFAULT_EXCHANGE_RATES[BASE_CURRENCY]
          ),
          selectedCurrency,
          DEFAULT_EXCHANGE_RATES[selectedCurrency]
        )
      );
    } catch (error) {
      console.error("Error calculating expected cash:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCashCount = async () => {
    try {
      setLoading(true);
      const cashInHandDB = await getCashInHandDB();

      const cashCount: CashInHand = {
        _id: new Date().toISOString(),
        _rev: "", // Will be populated by PouchDB after first save
        type: "cash_in_hand",
        amount: physicalCash,
        expectedAmount: expectedCash,
        difference: difference,
        timestamp: new Date().toISOString(),
        notes: notes,
        status: "pending",
      };

      // Save the cash count
      await cashInHandDB.put(cashCount);

      // Create ledger entry for the cash adjustment
      await createCashAdjustmentEntry(
        cashCount._id,
        physicalCash,
        expectedCash,
        cashCount.timestamp
      );

      // Reset form
      setNotes("");
      setPhysicalCash(createMoney(0, "KES", DEFAULT_EXCHANGE_RATES.KES));
    } catch (error) {
      console.error("Error saving cash count:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="lg">
      {/* Period Summary */}
      <Paper shadow="sm" p="md" withBorder>
        <Stack gap="xs">
          <Text size="sm" fw={500} c="dimmed">
            {dateRangeInfo.label} Summary
          </Text>
          <Group justify="space-between">
            <Text size="sm">Opening Balance:</Text>
            <Text size="sm" fw={500}>
              {formatMoney(openingBalance)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Closing Balance:</Text>
            <Text size="sm" fw={500}>
              {formatMoney(closingBalance)}
            </Text>
          </Group>
        </Stack>
      </Paper>

      <Divider />

      {/* Currency Selection */}
      <Select
        label="Select Currency"
        value={selectedCurrency}
        onChange={(value) => {
          const newCurrency = value as CurrencyCode;
          setSelectedCurrency(newCurrency);
          // Convert amounts to new currency
          setPhysicalCash(
            convertMoney(
              physicalCash,
              newCurrency,
              DEFAULT_EXCHANGE_RATES[newCurrency]
            )
          );
          setExpectedCash(
            convertMoney(
              expectedCash,
              newCurrency,
              DEFAULT_EXCHANGE_RATES[newCurrency]
            )
          );
        }}
        data={currencyOptions}
      />

      {/* Physical Cash Count */}
      <Paper shadow="sm" p="md" withBorder>
        <Stack gap="md">
          <Text fw={500}>Physical Cash Count</Text>
          <MoneyInput
            value={physicalCash}
            onChange={(value) => {
              const newValue =
                typeof value === "number"
                  ? {
                      amount: value,
                      currency: selectedCurrency,
                      exchangeRate: DEFAULT_EXCHANGE_RATES[selectedCurrency],
                    }
                  : value;
              setPhysicalCash(newValue);
            }}
            currency={selectedCurrency}
          />
        </Stack>
      </Paper>

      {/* Expected Cash */}
      <Paper shadow="sm" p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={500}>Expected Cash</Text>
            <Badge color="blue">Calculated</Badge>
          </Group>
          <Text size="lg" fw={700}>
            {loading ? "Calculating..." : formatMoney(expectedCash)}
          </Text>

          {/* Base Currency Equivalent */}
          {selectedCurrency !== BASE_CURRENCY && (
            <Text size="sm" c="dimmed">
              {formatMoney(
                convertMoney(
                  expectedCash,
                  BASE_CURRENCY,
                  DEFAULT_EXCHANGE_RATES[BASE_CURRENCY]
                )
              )}{" "}
              {BASE_CURRENCY}
            </Text>
          )}
        </Stack>
      </Paper>

      {/* Difference */}
      <Paper shadow="sm" p="md" withBorder>
        <Stack gap="md">
          <Text fw={500}>Difference</Text>
          <Group>
            <Badge
              size="lg"
              color={
                difference.amount === 0
                  ? "green"
                  : difference.amount > 0
                  ? "blue"
                  : "red"
              }
            >
              {loading ? "..." : formatMoney(difference)}
            </Badge>

            {/* Base Currency Equivalent */}
            {selectedCurrency !== BASE_CURRENCY && (
              <Text size="sm" c="dimmed">
                {formatMoney(
                  convertMoney(
                    difference,
                    BASE_CURRENCY,
                    DEFAULT_EXCHANGE_RATES[BASE_CURRENCY]
                  )
                )}{" "}
                {BASE_CURRENCY}
              </Text>
            )}
          </Group>
        </Stack>
      </Paper>

      {/* Notes */}
      <Textarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add any notes about the cash count..."
        minRows={3}
      />

      {/* Save Button */}
      <Button
        onClick={handleSaveCashCount}
        loading={loading}
        fullWidth
        size="md"
      >
        Save Cash Count
      </Button>
    </Stack>
  );
}
