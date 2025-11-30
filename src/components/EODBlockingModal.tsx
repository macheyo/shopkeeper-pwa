"use client";

import React from "react";
import { Modal, Text, Button, Stack, Alert, Group, Title } from "@mantine/core";
import { IconAlertCircle, IconCash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { TradingDayStatus } from "@/lib/tradingDay";
import { formatDateForDisplay } from "@/lib/tradingDay";

interface EODBlockingModalProps {
  opened: boolean;
  status: TradingDayStatus;
  onClose?: () => void;
}

export default function EODBlockingModal({
  opened,
  status,
  onClose,
}: EODBlockingModalProps) {
  const router = useRouter();

  const handleGoToEOD = () => {
    router.push("/eod");
    if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      centered
      size="lg"
      title={
        <Group>
          <IconAlertCircle size={24} color="red" />
          <Title order={4}>Trading Day Blocked</Title>
        </Group>
      }
    >
      <Stack gap="md">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Previous Day EOD Required"
          color="red"
        >
          <Text size="sm">
            You cannot start a new trading day until you complete the End of Day
            (EOD) cash reconciliation for the previous day.
          </Text>
        </Alert>

        {status.previousDayDate && (
          <Alert color="blue">
            <Text size="sm" fw={500} mb="xs">
              Previous Day: {formatDateForDisplay(status.previousDayDate)}
            </Text>
            <Text size="sm" c="dimmed">
              Please complete the EOD cash reconciliation for this date before
              continuing.
            </Text>
          </Alert>
        )}

        <Text size="sm" c="dimmed">
          The EOD process ensures accurate cash tracking and prevents
          discrepancies. Once you complete the previous day&apos;s EOD,
          you&apos;ll be able to continue with normal operations.
        </Text>

        <Group justify="flex-end" mt="md">
          <Button
            leftSection={<IconCash size={16} />}
            onClick={handleGoToEOD}
            size="md"
          >
            Go to EOD Page
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
