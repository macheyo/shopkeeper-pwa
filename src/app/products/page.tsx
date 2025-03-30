"use client";

import React from "react";
import { Title, Group, Text, Paper, Box } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import CollapsibleFab from "@/components/CollapsibleFab";

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
          <CollapsibleFab
            icon={<IconPlus size={16} />}
            text="Add Product"
            onClick={() => router.push("/products/add")}
            color="green"
          />
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
