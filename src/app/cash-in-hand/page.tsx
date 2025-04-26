"use client";

import React from "react";
import { Box, Title, Button, Group } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { CashInHandManager } from "@/components/CashInHandManager";

export default function CashInHandPage() {
  const router = useRouter();

  return (
    <>
      <Box mb="lg">
        <Group justify="space-between" align="center">
          <Title order={2}>Cash In Hand</Title>
          <Button
            variant="outline"
            leftSection={<IconArrowLeft size={20} />}
            onClick={() => router.push("/reports")}
            size="md"
          >
            Back
          </Button>
        </Group>
      </Box>

      <CashInHandManager />
    </>
  );
}
