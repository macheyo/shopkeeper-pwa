"use client";

import React from "react";
import {
  Stack,
  Group,
  Text,
  Paper,
  Badge,
  Divider,
  Title,
} from "@mantine/core";
import { EODCashRecord } from "@/types/eod";
import { formatMoney } from "@/types/money";
import { formatDateForDisplay } from "@/lib/tradingDay";

interface EODDetailsViewProps {
  eodRecord: EODCashRecord;
}

export default function EODDetailsView({ eodRecord }: EODDetailsViewProps) {
  const getVarianceColor = (variance: number, varianceType: string) => {
    if (Math.abs(variance) < 0.01) return "green";
    if (varianceType.includes("explained")) return "blue";
    if (variance < 0) return "red";
    return "orange";
  };

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Title order={4}>EOD Details</Title>
        <Badge
          color={
            eodRecord.status === "verified"
              ? "green"
              : eodRecord.status === "completed"
              ? "blue"
              : "yellow"
          }
        >
          {eodRecord.status}
        </Badge>
      </Group>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {formatDateForDisplay(eodRecord.date)}
        </Text>
        {eodRecord.userName && (
          <Badge variant="light" size="sm">
            User: {eodRecord.userName}
          </Badge>
        )}
      </Group>

      <Divider />

      {/* Summary */}
      <Paper withBorder p="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Opening Balance:
            </Text>
            <Text fw={600}>{formatMoney(eodRecord.openingBalance)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Cash Sales:
            </Text>
            <Text fw={600} c="green">
              {formatMoney(eodRecord.cashSales)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Cash Purchases:
            </Text>
            <Text fw={600} c="red">
              {formatMoney(eodRecord.cashPurchases)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Expected Closing:
            </Text>
            <Text fw={600}>
              {formatMoney(eodRecord.expectedClosingBalance)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Actual Cash Count:
            </Text>
            <Text fw={700} size="lg">
              {formatMoney(eodRecord.actualCashCount)}
            </Text>
          </Group>
          <Divider />
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Variance:
            </Text>
            <Badge
              color={getVarianceColor(
                eodRecord.variance.amount,
                eodRecord.varianceType
              )}
              size="lg"
            >
              {formatMoney(eodRecord.variance)}
            </Badge>
          </Group>
        </Stack>
      </Paper>

      {/* Variance Explanations */}
      {eodRecord.varianceExplanation &&
        eodRecord.varianceExplanation.length > 0 && (
          <Paper withBorder p="md">
            <Text fw={600} mb="sm">
              Variance Explanations
            </Text>
            <Stack gap="xs">
              {eodRecord.varianceExplanation.map((explanation, index) => (
                <Paper key={index} p="xs" withBorder>
                  <Group justify="space-between" mb="xs">
                    <Badge variant="light">{explanation.type}</Badge>
                    <Text size="sm" fw={600}>
                      {formatMoney(explanation.amount)}
                    </Text>
                  </Group>
                  <Text size="sm">{explanation.description}</Text>
                  {explanation.customerName && (
                    <Text size="xs" c="dimmed">
                      Customer: {explanation.customerName}
                    </Text>
                  )}
                </Paper>
              ))}
            </Stack>
          </Paper>
        )}

      {/* Cash Surrender */}
      {eodRecord.cashSurrendered && eodRecord.cashSurrendered.amount > 0 && (
        <Paper withBorder p="md">
          <Text fw={600} mb="sm">
            Cash Surrender
          </Text>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Amount:
              </Text>
              <Text fw={600}>{formatMoney(eodRecord.cashSurrendered)}</Text>
            </Group>
            {eodRecord.surrenderMethod && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Method:
                </Text>
                <Badge variant="light">
                  {eodRecord.surrenderMethod.replace("_", " ")}
                </Badge>
              </Group>
            )}
            {eodRecord.surrenderReference && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Reference:
                </Text>
                <Text size="sm">{eodRecord.surrenderReference}</Text>
              </Group>
            )}
            {eodRecord.surrenderNotes && (
              <Text size="sm" c="dimmed">
                Notes: {eodRecord.surrenderNotes}
              </Text>
            )}
          </Stack>
        </Paper>
      )}

      {/* Notes */}
      {eodRecord.notes && (
        <Paper withBorder p="md">
          <Text fw={600} mb="xs">
            Notes
          </Text>
          <Text size="sm">{eodRecord.notes}</Text>
        </Paper>
      )}

      {/* Metadata */}
      <Paper withBorder p="xs">
        <Stack gap="xs">
          <Text size="xs" c="dimmed">
            Completed by: {eodRecord.completedBy}
          </Text>
          <Text size="xs" c="dimmed">
            Completed at: {new Date(eodRecord.completedAt).toLocaleString()}
          </Text>
          {eodRecord.verifiedBy && (
            <>
              <Text size="xs" c="dimmed">
                Verified by: {eodRecord.verifiedBy}
              </Text>
              <Text size="xs" c="dimmed">
                Verified at:{" "}
                {eodRecord.verifiedAt
                  ? new Date(eodRecord.verifiedAt).toLocaleString()
                  : "N/A"}
              </Text>
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
