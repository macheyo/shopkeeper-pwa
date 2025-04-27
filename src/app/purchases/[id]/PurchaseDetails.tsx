"use client";

import React, { useState } from "react";
import {
  Title,
  Stack,
  Card,
  Text,
  Group,
  Table,
  Badge,
  Button,
  Accordion,
  ActionIcon,
  Tooltip,
  Modal,
  ScrollArea,
  rem,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconInfoCircle,
  IconReceipt,
  IconTruckDelivery,
  IconNotes,
  IconChartBar,
  IconPrinter,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { PurchaseDoc } from "@/types";
import { formatMoney } from "@/types/money";

interface PurchaseDetailsProps {
  purchase: PurchaseDoc;
}

export default function PurchaseDetails({ purchase }: PurchaseDetailsProps) {
  const router = useRouter();
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Calculate total expected profit
  const totalExpectedProfit = purchase?.items.reduce(
    (acc, item) => ({
      ...item.expectedProfit,
      amount: acc.amount + item.expectedProfit.amount * item.qty,
    }),
    { ...purchase?.items[0]?.expectedProfit, amount: 0 }
  );

  if (!purchase) {
    return (
      <Stack gap="md">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.back()}
        >
          Back
        </Button>
        <Card withBorder p="xl">
          <Stack align="center" gap="md">
            <IconInfoCircle size={32} color="red" />
            <Title order={3}>Purchase Not Found</Title>
            <Text c="dimmed">The requested purchase could not be found.</Text>
          </Stack>
        </Card>
      </Stack>
    );
  }

  const handlePrint = () => {
    window.print();
    setShowPrintModal(false);
  };

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.back()}
        >
          Back
        </Button>
        <Group>
          <Tooltip label="Print Purchase Details">
            <ActionIcon
              variant="light"
              size="lg"
              onClick={() => setShowPrintModal(true)}
            >
              <IconPrinter size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Title */}
      <Group align="center">
        <IconReceipt size={32} />
        <Title order={2}>
          Purchase Run #{purchase.purchaseRunId.split("_")[1]}
        </Title>
      </Group>

      {/* Summary Card */}
      <Card withBorder shadow="sm">
        <Group justify="space-between" wrap="wrap">
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Date
            </Text>
            <Text fw={500}>
              {new Date(purchase.timestamp).toLocaleString()}
            </Text>
          </Stack>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Total Amount
            </Text>
            <Text fw={500}>{formatMoney(purchase.totalAmount)}</Text>
          </Stack>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Expected Profit
            </Text>
            <Text fw={500} c="green">
              {formatMoney(totalExpectedProfit)}
            </Text>
          </Stack>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Status
            </Text>
            <Badge
              size="lg"
              color={
                purchase.status === "synced"
                  ? "green"
                  : purchase.status === "failed"
                  ? "red"
                  : "yellow"
              }
            >
              {purchase.status.charAt(0).toUpperCase() +
                purchase.status.slice(1)}
            </Badge>
          </Stack>
        </Group>
      </Card>

      {/* Details Accordion */}
      <Accordion variant="separated">
        {/* Items Section */}
        <Accordion.Item value="items">
          <Accordion.Control icon={<IconChartBar />}>
            Purchase Items
          </Accordion.Control>
          <Accordion.Panel>
            <ScrollArea>
              <Table withTableBorder striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Cost Price</Table.Th>
                    <Table.Th>Selling Price</Table.Th>
                    <Table.Th>Expected Profit</Table.Th>
                    <Table.Th>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {purchase.items.map((item, index) => (
                    <Table.Tr key={`${item.productId}_${index}`}>
                      <Table.Td>{item.productName}</Table.Td>
                      <Table.Td>{item.qty}</Table.Td>
                      <Table.Td>{formatMoney(item.costPrice)}</Table.Td>
                      <Table.Td>
                        {formatMoney(item.intendedSellingPrice)}
                      </Table.Td>
                      <Table.Td>
                        {formatMoney({
                          ...item.expectedProfit,
                          amount: item.expectedProfit.amount * item.qty,
                        })}
                      </Table.Td>
                      <Table.Td>
                        {formatMoney({
                          ...item.costPrice,
                          amount: item.costPrice.amount * item.qty,
                        })}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td colSpan={5} style={{ textAlign: "right" }}>
                      <Text fw={500}>Total:</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={700}>{formatMoney(purchase.totalAmount)}</Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Supplier Section */}
        {purchase.supplier && (
          <Accordion.Item value="supplier">
            <Accordion.Control icon={<IconTruckDelivery size={rem(20)} />}>
              Supplier Information
            </Accordion.Control>
            <Accordion.Panel>
              <Text>{purchase.supplier}</Text>
            </Accordion.Panel>
          </Accordion.Item>
        )}

        {/* Notes Section */}
        {purchase.notes && (
          <Accordion.Item value="notes">
            <Accordion.Control icon={<IconNotes size={rem(20)} />}>
              Notes
            </Accordion.Control>
            <Accordion.Panel>
              <Text style={{ whiteSpace: "pre-wrap" }}>{purchase.notes}</Text>
            </Accordion.Panel>
          </Accordion.Item>
        )}
      </Accordion>

      {/* Print Modal */}
      <Modal
        opened={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Print Purchase Details"
        size="sm"
      >
        <Stack>
          <Text>Are you sure you want to print these purchase details?</Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setShowPrintModal(false)}>
              Cancel
            </Button>
            <Button onClick={handlePrint}>Print</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
