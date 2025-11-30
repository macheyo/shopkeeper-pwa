"use client";

import React from "react";
import { Card, Stack, Text, Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

export default function KeyAuthEmbeddedSetup() {
  return (
    <Card withBorder shadow="sm" p="lg">
      <Stack gap="md">
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          title="Token Authentication Deprecated"
        >
          <Text size="sm">
            Token-based key authentication is no longer supported. Please use
            password or license key authentication instead.
          </Text>
        </Alert>
      </Stack>
    </Card>
  );
}
