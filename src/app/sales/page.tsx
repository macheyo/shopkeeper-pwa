"use client";

import { Title, Group, Text, Paper, Box } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import SalesList from "@/components/SalesList";
import CollapsibleFab from "@/components/CollapsibleFab";

export default function SalesPage() {
  const router = useRouter();

  return (
    <>
      <Box mb="xl">
        <Group justify="space-between" align="center">
          <Title order={2}>Sales</Title>
          <CollapsibleFab
            icon={<IconPlus size={16} />}
            text="New Sale"
            onClick={() => router.push("/sales/new")}
            color="blue"
          />
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
