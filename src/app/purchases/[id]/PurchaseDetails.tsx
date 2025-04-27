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
  Select,
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
import {
  formatMoney,
  CurrencyCode,
  CURRENCY_INFO,
  useMoneyOperations,
} from "@/types/money";

interface PurchaseDetailsProps {
  purchase: PurchaseDoc;
}

export default function PurchaseDetails({ purchase }: PurchaseDetailsProps) {
  const router = useRouter();
  const [showPrintModal, setShowPrintModal] = useState(false);
  // Currency states for different price types
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(
    purchase.totalAmount.currency
  );
  const [costPriceCurrency, setCostPriceCurrency] = useState<CurrencyCode>(
    purchase.totalAmount.currency
  );
  const [sellingPriceCurrency, setSellingPriceCurrency] =
    useState<CurrencyCode>(purchase.totalAmount.currency);

  const { convertMoney, exchangeRates } = useMoneyOperations();

  // Function to convert money to a specific currency
  const convertToDisplayCurrency = (money: typeof purchase.totalAmount) => {
    return convertMoney(money, displayCurrency, exchangeRates[displayCurrency]);
  };

  // Function to display amount with original value
  const displayAmount = (money: typeof purchase.totalAmount) => {
    if (displayCurrency === money.currency) {
      return formatMoney(money);
    }
    const converted = convertToDisplayCurrency(money);
    return (
      <Stack gap={0}>
        <Text>{formatMoney(converted)}</Text>
        <Text size="xs" c="dimmed">
          ({formatMoney(money)})
        </Text>
      </Stack>
    );
  };

  // Function to calculate item total in display currency
  const calculateItemTotal = (item: (typeof purchase.items)[0]) => {
    // Convert cost price to display currency
    const convertedCostPrice = convertToDisplayCurrency({
      ...item.costPrice,
      amount: item.costPrice.amount * item.qty,
    });
    return convertedCostPrice;
  };

  // Function to calculate expected profit in display currency
  const calculateItemProfit = (item: (typeof purchase.items)[0]) => {
    // Convert both prices to display currency first
    const costPriceInDisplay = convertToDisplayCurrency(item.costPrice);
    const sellingPriceInDisplay = convertToDisplayCurrency(
      item.intendedSellingPrice
    );

    // Calculate profit in display currency
    return {
      ...costPriceInDisplay,
      amount:
        (sellingPriceInDisplay.amount - costPriceInDisplay.amount) * item.qty,
    };
  };

  // Calculate totals in display currency
  const totalCost = purchase?.items.reduce(
    (acc, item) => {
      const itemTotal = calculateItemTotal(item);
      return {
        ...itemTotal,
        amount: acc.amount + itemTotal.amount,
      };
    },
    { ...purchase?.items[0]?.costPrice, amount: 0, currency: displayCurrency }
  );

  const totalExpectedProfit = purchase?.items.reduce(
    (acc, item) => {
      const itemProfit = calculateItemProfit(item);
      return {
        ...itemProfit,
        amount: acc.amount + itemProfit.amount,
      };
    },
    {
      ...purchase?.items[0]?.expectedProfit,
      amount: 0,
      currency: displayCurrency,
    }
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
          <Group>
            <Select
              label="Cost Price Currency"
              value={costPriceCurrency}
              onChange={(value) =>
                value && setCostPriceCurrency(value as CurrencyCode)
              }
              data={Object.values(CURRENCY_INFO).map((currency) => ({
                value: currency.code,
                label: `${currency.flag} ${currency.code} - ${currency.name}`,
              }))}
              searchable
              maxDropdownHeight={400}
            />
            <Select
              label="Selling Price Currency"
              value={sellingPriceCurrency}
              onChange={(value) =>
                value && setSellingPriceCurrency(value as CurrencyCode)
              }
              data={Object.values(CURRENCY_INFO).map((currency) => ({
                value: currency.code,
                label: `${currency.flag} ${currency.code} - ${currency.name}`,
              }))}
              searchable
              maxDropdownHeight={400}
            />
            <Select
              label="Display Currency"
              value={displayCurrency}
              onChange={(value) =>
                value && setDisplayCurrency(value as CurrencyCode)
              }
              data={Object.values(CURRENCY_INFO).map((currency) => ({
                value: currency.code,
                label: `${currency.flag} ${currency.code} - ${currency.name}`,
              }))}
              searchable
              maxDropdownHeight={400}
            />
          </Group>
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
            <Text fw={500}>{displayAmount(totalCost)}</Text>
          </Stack>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Expected Profit
            </Text>
            <Text fw={500} c="green">
              {displayAmount(totalExpectedProfit)}
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
              <Stack gap="md" hiddenFrom="sm">
                {purchase.items.map((item, index) => (
                  <Card
                    key={`${item.productId}_${index}`}
                    withBorder
                    shadow="sm"
                    p="md"
                  >
                    <Group justify="space-between">
                      <Text fw={500}>{item.productName}</Text>
                      <Badge variant="light">Qty: {item.qty}</Badge>
                    </Group>
                    <Stack gap="xs" mt="sm">
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Cost Price
                        </Text>
                        <Text>
                          {displayAmount({
                            ...item.costPrice,
                            currency: costPriceCurrency,
                          })}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Selling Price
                        </Text>
                        <Text>
                          {displayAmount({
                            ...item.intendedSellingPrice,
                            currency: sellingPriceCurrency,
                          })}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Expected Profit
                        </Text>
                        <Text c="green">
                          {displayAmount(calculateItemProfit(item))}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Total
                        </Text>
                        <Text fw={500}>
                          {displayAmount(calculateItemTotal(item))}
                        </Text>
                      </Group>
                    </Stack>
                  </Card>
                ))}
                <Card withBorder p="md" bg="var(--mantine-color-gray-0)">
                  <Group justify="space-between">
                    <Text fw={500}>Total Purchase</Text>
                    <Text fw={700}>{displayAmount(totalCost)}</Text>
                  </Group>
                </Card>
              </Stack>
              <Table withTableBorder striped highlightOnHover visibleFrom="sm">
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
                      <Table.Td>
                        {displayAmount({
                          ...item.costPrice,
                          currency: costPriceCurrency,
                        })}
                      </Table.Td>
                      <Table.Td>
                        {displayAmount({
                          ...item.intendedSellingPrice,
                          currency: sellingPriceCurrency,
                        })}
                      </Table.Td>
                      <Table.Td>
                        {displayAmount(calculateItemProfit(item))}
                      </Table.Td>
                      <Table.Td>
                        {displayAmount(calculateItemTotal(item))}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td colSpan={5} style={{ textAlign: "right" }}>
                      <Text fw={500}>Total:</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={700}>{displayAmount(totalCost)}</Text>
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
