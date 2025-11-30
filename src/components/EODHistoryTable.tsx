"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  Text,
  Badge,
  Group,
  Stack,
  Paper,
  Button,
  Modal,
  ScrollArea,
} from "@mantine/core";
import { IconEye, IconCalendar } from "@tabler/icons-react";
import { getEODRecords } from "@/lib/eodDB";
import { EODCashRecord } from "@/types/eod";
import { formatMoney } from "@/types/money";
import { formatDateForDisplay } from "@/lib/tradingDay";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useAuth } from "@/contexts/AuthContext";
import EODDetailsView from "./EODDetailsView";

export default function EODHistoryTable() {
  const { dateRangeInfo } = useDateFilter();
  const { shop, currentUser } = useAuth();
  const [eodRecords, setEodRecords] = useState<EODCashRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<EODCashRecord | null>(
    null
  );
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [filterByUser, setFilterByUser] = useState<boolean>(false);

  useEffect(() => {
    const loadEODRecords = async () => {
      if (!shop) return;

      try {
        setLoading(true);
        // For managers/owners, show all users. For employees, show only their own
        const userId =
          currentUser?.role === "employee" ? currentUser.userId : undefined;
        const records = await getEODRecords(
          dateRangeInfo.startDate.toISOString(),
          dateRangeInfo.endDate.toISOString(),
          shop.shopId,
          userId
        );
        setEodRecords(records);
      } catch (error) {
        console.error("Error loading EOD records:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEODRecords();
  }, [dateRangeInfo, shop, currentUser]);

  const getVarianceColor = (variance: number, varianceType: string) => {
    if (Math.abs(variance) < 0.01) return "green";
    if (varianceType.includes("explained")) return "blue";
    if (variance < 0) return "red";
    return "orange";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "green";
      case "completed":
        return "blue";
      case "pending":
        return "yellow";
      default:
        return "gray";
    }
  };

  if (loading) {
    return (
      <Paper p="md">
        <Text>Loading EOD history...</Text>
      </Paper>
    );
  }

  if (eodRecords.length === 0) {
    return (
      <Paper p="md">
        <Stack align="center" gap="md">
          <IconCalendar size={48} color="gray" />
          <Text c="dimmed">No EOD records found for the selected period</Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <>
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600} size="lg">
              EOD History
            </Text>
            <Badge color="blue" variant="light">
              {eodRecords.length} records
            </Badge>
          </Group>

          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  {currentUser?.role !== "employee" && (
                    <Table.Th>User</Table.Th>
                  )}
                  <Table.Th>Opening</Table.Th>
                  <Table.Th>Sales</Table.Th>
                  <Table.Th>Purchases</Table.Th>
                  <Table.Th>Expected</Table.Th>
                  <Table.Th>Actual</Table.Th>
                  <Table.Th>Variance</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {eodRecords.map((record) => (
                  <Table.Tr key={record._id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {formatDateForDisplay(record.date)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {formatMoney(record.openingBalance)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="green">
                        {formatMoney(record.cashSales)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="red">
                        {formatMoney(record.cashPurchases)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {formatMoney(record.expectedClosingBalance)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {formatMoney(record.actualCashCount)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={getVarianceColor(
                          record.variance.amount,
                          record.varianceType
                        )}
                        variant="light"
                      >
                        {formatMoney(record.variance)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={getStatusColor(record.status)}
                        variant="light"
                      >
                        {record.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconEye size={14} />}
                        onClick={() => {
                          setSelectedRecord(record);
                          setDetailsModalOpen(true);
                        }}
                      >
                        View
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Paper>

      {/* Details Modal */}
      <Modal
        opened={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedRecord(null);
        }}
        title="EOD Details"
        size="lg"
      >
        {selectedRecord && <EODDetailsView eodRecord={selectedRecord} />}
      </Modal>
    </>
  );
}
