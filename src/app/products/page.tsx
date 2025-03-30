"use client";

import React from "react";
import { Title, Button, Group, Text, Paper, Box } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const ProductManager = dynamic(() => import("@/components/ProductManager"), {
  ssr: false,
});

export default function ProductsPage() {
  const router = useRouter();

  return (
    <>
      <Box mb="xl">
        <Group justify="space-between" align="center">
          <Title order={2}>Products</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => router.push("/products/add")}
            color="green"
          >
            Add Product
          </Button>
        </Group>
        <Text c="dimmed" mt="xs">
          Manage your inventory, add new products, and update prices
        </Text>
      </Box>

      <Paper shadow="xs" p="md" withBorder>
        <ProductManager />
      </Paper>
    </>
  );
}
