"use client";

import React, { useState, useEffect } from "react";
import {
  Title,
  Stack,
  Card,
  Text,
  Group,
  Table,
  Badge,
  Button,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getPurchasesDB } from "@/lib/databases";
import { PurchaseDoc } from "@/types";
import { formatMoney } from "@/types/money";

export default function PurchaseDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [purchase, setPurchase] = useState<PurchaseDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPurchase = async () => {
      try {
        const purchasesDB = await getPurchasesDB();
        const result = await purchasesDB.find({
          selector: {
            purchaseRunId: params.id,
          },
        });

        if (result.docs.length > 0) {
          setPurchase(result.docs[0] as PurchaseDoc);
        }
      } catch (err) {
        console.error("Error fetching purchase:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchase();
  }, [params.id]);

  if (loading) {
    return <Text ta="center">Loading purchase details...</Text>;
  }

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
        <Text ta="center">Purchase not found</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.back()}
        >
          Back
        </Button>
      </Group>

      <Title order={2}>
        Purchase Run #{purchase.purchaseRunId.split("_")[1]}
      </Title>

      <Card withBorder>
        <Stack gap="xs">
          <Group>
            <Text fw={500}>Date:</Text>
            <Text>{new Date(purchase.timestamp).toLocaleString()}</Text>
          </Group>
          <Group>
            <Text fw={500}>Total Amount:</Text>
            <Text>{formatMoney(purchase.totalAmount)}</Text>
          </Group>
          <Group>
            <Text fw={500}>Status:</Text>
            <Badge
              color={
                purchase.status === "synced"
                  ? "green"
                  : purchase.status === "failed"
                  ? "red"
                  : "yellow"
              }
            >
              {purchase.status || "Pending"}
            </Badge>
          </Group>
        </Stack>
      </Card>

      <Card withBorder>
        <Title order={3} mb="md">
          Items
        </Title>
        <div style={{ overflowX: "auto" }}>
          <Table withTableBorder style={{ minWidth: "100%" }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Cost Price</Table.Th>
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
                    {formatMoney({
                      ...item.costPrice,
                      amount: item.costPrice.amount * item.qty,
                    })}
                  </Table.Td>
                </Table.Tr>
              ))}
              <Table.Tr>
                <Table.Td colSpan={3} style={{ textAlign: "right" }}>
                  <Text fw={500}>Total:</Text>
                </Table.Td>
                <Table.Td>
                  <Text fw={700}>{formatMoney(purchase.totalAmount)}</Text>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </div>
      </Card>
    </Stack>
  );
}
