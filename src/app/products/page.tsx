"use client";

import React from "react";
import { Title, Text, Paper, Box } from "@mantine/core";
import dynamic from "next/dynamic";

const ProductManager = dynamic(() => import("@/components/ProductManager"), {
  ssr: false,
});

export default function ProductsPage() {
  return (
    <>
      <Box mb="xl">
        <Title order={2}>Products</Title>
        <Text c="dimmed" mt="xs">
          View your product catalog and check stock levels
        </Text>
      </Box>

      <Paper shadow="xs" p="md" withBorder>
        <ProductManager />
      </Paper>
    </>
  );
}
