import { Modal, Text, Badge, Button, Table } from "@mantine/core";
import { formatMoney, createMoney, CurrencyCode } from "@/types/money";
import { getTargetsForDateRange, SalesTarget } from "@/lib/salesTargets";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useState, useEffect, useCallback } from "react";

interface SalesTargetHistoryModalProps {
  opened: boolean;
  onClose: () => void;
}

export function SalesTargetHistoryModal({
  opened,
  onClose,
}: SalesTargetHistoryModalProps) {
  const { dateRangeInfo } = useDateFilter();
  const [targetHistory, setTargetHistory] = useState<SalesTarget[]>([]);

  const fetchTargetHistory = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      // Get sales for the selected date range
      const startDate = dateRangeInfo.startDate;
      const endDate = dateRangeInfo.endDate;

      const targets = getTargetsForDateRange(startDate, endDate);
      setTargetHistory(targets);
    } catch (error) {
      console.error("Error fetching target history:", error);
    }
  }, [dateRangeInfo]);

  useEffect(() => {
    fetchTargetHistory();
  }, [fetchTargetHistory]);

  const renderTargetHistory = () => {
    if (targetHistory.length === 0) {
      return (
        <Text ta="center" py="xl" c="dimmed">
          No previous targets found
        </Text>
      );
    }

    return (
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Target</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {targetHistory.map((target, index) => (
            <Table.Tr key={index}>
              <Table.Td>{new Date(target.date).toLocaleDateString()}</Table.Td>
              <Table.Td>
                {formatMoney(
                  createMoney(target.amount, target.currency as CurrencyCode)
                )}
              </Table.Td>
              <Table.Td>
                {target.achieved ? (
                  <Badge color="green" leftSection={<IconCheck size={14} />}>
                    Achieved
                  </Badge>
                ) : (
                  <Badge color="red" leftSection={<IconX size={14} />}>
                    Not Achieved
                  </Badge>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Sales Target History"
      size="lg"
    >
      {renderTargetHistory()}
      <Button fullWidth mt="md" onClick={onClose}>
        Close
      </Button>
    </Modal>
  );
}
