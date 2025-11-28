"use client";

import React, { useState } from "react";
import { Stack, Alert, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

interface KeyAuthEmbeddedProps {
  onSuccess: (userInfo: EmbeddedUserInfo & { userId: string }) => void;
  onError: (error: string) => void;
}

export default function KeyAuthEmbedded({
  onSuccess,
  onError,
}: KeyAuthEmbeddedProps) {
  // Token-based authentication is no longer supported
  React.useEffect(() => {
    const errorMsg =
      "Token-based key authentication is no longer supported. Please use password or license key authentication.";
    onError(errorMsg);
  }, [onError]);

  return (
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
  );
}
