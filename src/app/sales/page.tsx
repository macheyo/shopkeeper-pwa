"use client";

import { Title, Button, Group, Text, Paper, Box } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import SalesList from "@/components/SalesList";

export default function SalesPage() {
  const router = useRouter();

  return (
    <>
      <Box mb="xl">
        <Group justify="space-between" align="center">
          <Title order={2}>Sales</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => router.push("/sales/new")}
            color="blue"
          >
            New Sale
          </Button>
        </Group>
        <Text c="dimmed" mt="xs">
          Record and manage your sales transactions
        </Text>
      </Box>

      <Paper shadow="xs" p="md" withBorder>
        <SalesList />
      </Paper>
    </>
  );
}
