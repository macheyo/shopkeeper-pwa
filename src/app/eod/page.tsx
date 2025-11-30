"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Title,
  Button,
  Group,
  Text,
  Paper,
  Stack,
  Card,
  Alert,
  Badge,
  Divider,
  Textarea,
  Select,
  TextInput,
  SimpleGrid,
} from "@mantine/core";
import { IconArrowLeft, IconCheck, IconAlertCircle } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { Permission, hasPermission } from "@/lib/permissions";
import ProtectedRoute from "@/components/ProtectedRoute";
import MoneyInput from "@/components/MoneyInput";
import { getTodayEODSummary, completeEOD } from "@/lib/eod";
import { getTodayDate, formatDateForDisplay } from "@/lib/tradingDay";
import { VarianceExplanation, VarianceExplanationType } from "@/types/eod";
import { Money, createMoney, formatMoney } from "@/types/money";
import { useMoneyContext } from "@/contexts/MoneyContext";

export default function EODPage() {
  const router = useRouter();
  const { currentUser, shop } = useAuth();
  const { baseCurrency, exchangeRates } = useMoneyContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // EOD Data
  const [date, setDate] = useState(getTodayDate());
  const [openingBalance, setOpeningBalance] = useState<Money | null>(null);
  const [cashSales, setCashSales] = useState<Money | null>(null);
  const [cashPurchases, setCashPurchases] = useState<Money | null>(null);
  const [expectedClosingBalance, setExpectedClosingBalance] =
    useState<Money | null>(null);
  const [actualCashCount, setActualCashCount] = useState<Money>(
    createMoney(0, baseCurrency, exchangeRates[baseCurrency])
  );
  const [variance, setVariance] = useState<Money>(
    createMoney(0, baseCurrency, exchangeRates[baseCurrency])
  );

  // Variance Explanation
  const [showVarianceForm, setShowVarianceForm] = useState(false);
  const [varianceExplanationType, setVarianceExplanationType] = useState<
    VarianceExplanationType | ""
  >("");
  const [varianceDescription, setVarianceDescription] = useState("");
  const [varianceAmount, setVarianceAmount] = useState<Money | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [relatedSaleId, setRelatedSaleId] = useState("");

  // Cash Surrender
  const [cashSurrendered, setCashSurrendered] = useState<Money>(
    createMoney(0, baseCurrency, exchangeRates[baseCurrency])
  );
  const [surrenderMethod, setSurrenderMethod] = useState<
    "bank_deposit" | "owner_collection" | "safe_deposit" | ""
  >("");
  const [surrenderReference, setSurrenderReference] = useState("");
  const [surrenderNotes, setSurrenderNotes] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // Previous Day Status
  const [previousDayStatus, setPreviousDayStatus] = useState<{
    completed: boolean;
    date?: string;
  } | null>(null);

  // Load EOD summary
  useEffect(() => {
    const loadEODSummary = async () => {
      if (!shop) return;

      try {
        setLoading(true);
        setError(null);

        if (!currentUser) return;

        // Check previous day status for this user
        const { isPreviousDayEODCompletedForUser } = await import(
          "@/lib/eodDB"
        );
        const prevStatus = await isPreviousDayEODCompletedForUser(
          currentUser.userId,
          shop.shopId
        );
        setPreviousDayStatus(prevStatus);

        // Load today's summary for this user
        const summary = await getTodayEODSummary(
          currentUser.userId,
          shop.shopId
        );
        setDate(summary.date);
        setOpeningBalance(summary.openingBalance);
        setCashSales(summary.cashSales);
        setCashPurchases(summary.cashPurchases);
        setExpectedClosingBalance(summary.expectedClosingBalance);

        // If EOD already completed, load the record
        if (summary.eodRecord) {
          setActualCashCount(summary.eodRecord.actualCashCount);
          setVariance(summary.eodRecord.variance);
          setCashSurrendered(
            summary.eodRecord.cashSurrendered ||
              createMoney(0, baseCurrency, exchangeRates[baseCurrency])
          );
          setSurrenderMethod(summary.eodRecord.surrenderMethod || "");
          setSurrenderReference(summary.eodRecord.surrenderReference || "");
          setSurrenderNotes(summary.eodRecord.surrenderNotes || "");
          setNotes(summary.eodRecord.notes || "");
        } else {
          // Initialize with expected closing balance
          setActualCashCount(summary.expectedClosingBalance);
        }
      } catch (err) {
        console.error("Error loading EOD summary:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load EOD summary"
        );
      } finally {
        setLoading(false);
      }
    };

    loadEODSummary();
  }, [shop, baseCurrency, exchangeRates, currentUser]);

  // Calculate variance when actual cash count changes
  useEffect(() => {
    if (expectedClosingBalance && actualCashCount) {
      const varianceAmount =
        actualCashCount.amount - expectedClosingBalance.amount;
      setVariance(
        createMoney(varianceAmount, baseCurrency, exchangeRates[baseCurrency])
      );

      // Show variance form if variance is significant
      if (Math.abs(varianceAmount) >= 0.01) {
        setShowVarianceForm(true);
        setVarianceAmount(
          createMoney(
            Math.abs(varianceAmount),
            baseCurrency,
            exchangeRates[baseCurrency]
          )
        );
      } else {
        setShowVarianceForm(false);
      }
    }
  }, [actualCashCount, expectedClosingBalance, baseCurrency, exchangeRates]);

  const handleCompleteEOD = async () => {
    if (!shop || !currentUser) {
      setError("Shop or user information missing");
      return;
    }

    if (!actualCashCount || actualCashCount.amount < 0) {
      setError("Please enter a valid actual cash count");
      return;
    }

    // Validate cash surrender
    if (cashSurrendered.amount > 0) {
      if (!surrenderMethod) {
        setError("Please select a surrender method");
        return;
      }
      if (!surrenderReference.trim()) {
        setError("Please enter a surrender reference number");
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);

      // Build variance explanations if variance exists
      const varianceExplanations: VarianceExplanation[] = [];
      if (
        showVarianceForm &&
        varianceExplanationType &&
        varianceExplanationType !== "unexplained"
      ) {
        // Only require description for explained variances
        if (varianceDescription.trim()) {
          varianceExplanations.push({
            type: varianceExplanationType as VarianceExplanationType,
            description: varianceDescription,
            amount: varianceAmount || variance,
            customerName: customerName || undefined,
            relatedTransactionId: relatedSaleId || undefined,
          });
        }
      }
      // If "unexplained" is selected or no explanation provided, variance will be treated as unexplained

      await completeEOD(
        date,
        actualCashCount,
        currentUser.userId,
        currentUser.name,
        varianceExplanations.length > 0 ? varianceExplanations : undefined,
        cashSurrendered.amount > 0 ? cashSurrendered : undefined,
        surrenderMethod || undefined,
        surrenderReference || undefined,
        surrenderNotes || undefined,
        notes || undefined,
        shop.shopId,
        currentUser.userId
      );

      setSuccess(true);
      // Redirect after a short delay
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      console.error("Error completing EOD:", err);
      setError(err instanceof Error ? err.message : "Failed to complete EOD");
    } finally {
      setSaving(false);
    }
  };

  const varianceExplanationOptions = [
    { value: "change_owed", label: "Change Owed to Customer" },
    { value: "customer_refund", label: "Customer Refund" },
    { value: "expense_paid", label: "Expense Paid (Not Recorded)" },
    { value: "deposit_received", label: "Deposit Received (Not Recorded)" },
    { value: "bank_deposit", label: "Bank Deposit Made" },
    { value: "bank_withdrawal", label: "Bank Withdrawal" },
    { value: "petty_cash_expense", label: "Petty Cash Expense" },
    { value: "counting_error", label: "Counting Error" },
    { value: "other", label: "Other (Explain)" },
    { value: "unexplained", label: "Unexplained (Record as Loss/Gain)" },
  ];

  if (loading) {
    return (
      <ProtectedRoute requireAuth={true}>
        <Paper p="xl">
          <Text>Loading EOD summary...</Text>
        </Paper>
      </ProtectedRoute>
    );
  }

  // Check permission
  if (!currentUser || !hasPermission(currentUser, Permission.COMPLETE_EOD)) {
    return (
      <ProtectedRoute requireAuth={true}>
        <Paper p="md">
          <Alert color="red" title="Access Denied">
            You don&apos;t have permission to access this page.
          </Alert>
        </Paper>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAuth={true}>
      <Paper p="md">
        <Group justify="space-between" mb="lg">
          <Title order={2}>End of Day Cash Reconciliation</Title>
          <Button
            variant="outline"
            leftSection={<IconArrowLeft size={20} />}
            onClick={() => router.push("/")}
          >
            Back
          </Button>
        </Group>

        {/* Previous Day Warning */}
        {previousDayStatus && !previousDayStatus.completed && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Previous Day Not Completed"
            color="red"
            mb="md"
          >
            <Text size="sm">
              The EOD for{" "}
              {previousDayStatus.date &&
                formatDateForDisplay(previousDayStatus.date)}{" "}
              has not been completed. Please complete it first.
            </Text>
          </Alert>
        )}

        {/* Success Message */}
        {success && (
          <Alert
            icon={<IconCheck size={16} />}
            title="EOD Completed Successfully"
            color="green"
            mb="md"
          >
            <Text size="sm">
              End of Day cash reconciliation completed. Redirecting to
              dashboard...
            </Text>
          </Alert>
        )}

        {/* Error Message */}
        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error"
            color="red"
            mb="md"
          >
            <Text size="sm">{error}</Text>
          </Alert>
        )}

        <Stack gap="lg">
          {/* Date Display */}
          <Card withBorder p="md">
            <Text size="sm" c="dimmed" mb="xs">
              Date
            </Text>
            <Text size="lg" fw={600}>
              {formatDateForDisplay(date)}
            </Text>
          </Card>

          {/* Summary Cards */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <Card withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Opening Balance
              </Text>
              <Text size="xl" fw={700} c="blue">
                {openingBalance ? formatMoney(openingBalance) : "Loading..."}
              </Text>
            </Card>

            <Card withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Cash Sales
              </Text>
              <Text size="xl" fw={700} c="green">
                {cashSales ? formatMoney(cashSales) : "Loading..."}
              </Text>
            </Card>

            <Card withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Cash Purchases
              </Text>
              <Text size="xl" fw={700} c="red">
                {cashPurchases ? formatMoney(cashPurchases) : "Loading..."}
              </Text>
            </Card>

            <Card withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Expected Closing
              </Text>
              <Text size="xl" fw={700} c="violet">
                {expectedClosingBalance
                  ? formatMoney(expectedClosingBalance)
                  : "Loading..."}
              </Text>
            </Card>
          </SimpleGrid>

          <Divider />

          {/* Actual Cash Count */}
          <Paper withBorder p="md">
            <Stack gap="md">
              <Text fw={600} size="lg">
                Actual Cash Count
              </Text>
              <MoneyInput
                label="Enter actual physical cash count"
                value={actualCashCount}
                onChange={(value) => {
                  const newValue =
                    typeof value === "number"
                      ? createMoney(
                          value,
                          baseCurrency,
                          exchangeRates[baseCurrency]
                        )
                      : value;
                  setActualCashCount(newValue);
                }}
                currency={baseCurrency}
                variant="light"
              />
            </Stack>
          </Paper>

          {/* Variance Display */}
          {Math.abs(variance.amount) >= 0.01 && (
            <Paper
              withBorder
              p="md"
              style={{
                borderColor:
                  variance.amount < 0
                    ? "var(--mantine-color-red-6)"
                    : "var(--mantine-color-green-6)",
              }}
            >
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600} size="lg">
                    Variance
                  </Text>
                  <Badge
                    color={variance.amount < 0 ? "red" : "green"}
                    size="lg"
                  >
                    {formatMoney(variance)}
                  </Badge>
                </Group>

                {showVarianceForm && (
                  <Stack gap="sm">
                    <Select
                      label="Variance Explanation"
                      placeholder="Select reason for variance"
                      data={varianceExplanationOptions}
                      value={varianceExplanationType}
                      onChange={(value) =>
                        setVarianceExplanationType(
                          (value || "") as VarianceExplanationType | ""
                        )
                      }
                      required
                    />

                    {(varianceExplanationType === "change_owed" ||
                      varianceExplanationType === "customer_refund") && (
                      <>
                        <TextInput
                          label="Customer Name (Optional)"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                        <TextInput
                          label="Related Sale ID (Optional)"
                          value={relatedSaleId}
                          onChange={(e) => setRelatedSaleId(e.target.value)}
                        />
                      </>
                    )}

                    <Textarea
                      label="Description"
                      placeholder="Explain the variance..."
                      value={varianceDescription}
                      onChange={(e) => setVarianceDescription(e.target.value)}
                      required={varianceExplanationType !== "unexplained"}
                      disabled={varianceExplanationType === "unexplained"}
                      minRows={2}
                    />
                    {varianceExplanationType === "unexplained" && (
                      <Text size="xs" c="dimmed">
                        Unexplained variances will be recorded as a loss
                        (shortage) or gain (surplus) in the accounting system.
                      </Text>
                    )}
                  </Stack>
                )}
              </Stack>
            </Paper>
          )}

          {/* Cash Surrender */}
          <Paper withBorder p="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={600} size="lg">
                  Cash Surrender (Optional)
                </Text>
                <Badge color="blue" variant="light">
                  Optional
                </Badge>
              </Group>

              <MoneyInput
                label="Amount to Surrender"
                value={cashSurrendered}
                onChange={(value) => {
                  const newValue =
                    typeof value === "number"
                      ? createMoney(
                          value,
                          baseCurrency,
                          exchangeRates[baseCurrency]
                        )
                      : value;
                  setCashSurrendered(newValue);
                }}
                currency={baseCurrency}
                variant="light"
              />

              {cashSurrendered.amount > 0 && (
                <>
                  <Select
                    label="Surrender Method"
                    placeholder="Select method"
                    data={[
                      { value: "bank_deposit", label: "Bank Deposit" },
                      { value: "owner_collection", label: "Owner Collection" },
                      { value: "safe_deposit", label: "Safe Deposit" },
                    ]}
                    value={surrenderMethod}
                    onChange={(value) =>
                      setSurrenderMethod(
                        (value || "") as
                          | "bank_deposit"
                          | "owner_collection"
                          | "safe_deposit"
                          | ""
                      )
                    }
                    required
                  />

                  <TextInput
                    label="Reference Number"
                    placeholder="Bank reference, receipt number, etc."
                    value={surrenderReference}
                    onChange={(e) => setSurrenderReference(e.target.value)}
                    required
                  />

                  <Textarea
                    label="Notes (Optional)"
                    placeholder="Additional notes about the surrender..."
                    value={surrenderNotes}
                    onChange={(e) => setSurrenderNotes(e.target.value)}
                    minRows={2}
                  />
                </>
              )}
            </Stack>
          </Paper>

          {/* Notes */}
          <Textarea
            label="Additional Notes (Optional)"
            placeholder="Any additional notes about today's EOD..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={3}
          />

          {/* Complete Button */}
          <Button
            size="lg"
            leftSection={<IconCheck size={20} />}
            onClick={handleCompleteEOD}
            loading={saving}
            disabled={!actualCashCount || actualCashCount.amount < 0}
            fullWidth
          >
            Complete EOD
          </Button>
        </Stack>
      </Paper>
    </ProtectedRoute>
  );
}
