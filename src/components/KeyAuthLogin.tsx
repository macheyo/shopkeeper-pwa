"use client";

import React, { useState } from "react";
import { TextInput, Button, Stack, Alert, Text, Group } from "@mantine/core";
import {
  IconKey,
  IconFingerprint,
  IconAlertCircle,
  IconCheck,
} from "@tabler/icons-react";
import {
  authenticateWithKey,
  authenticateWithKeyAndBiometric,
} from "@/lib/keyAuth";
import { getKeyAuthData } from "@/lib/keyAuthStorage";
import { authenticateWithBiometric } from "@/lib/webauthn";
import { getUserById } from "@/lib/usersDB";

interface KeyAuthLoginProps {
  userId: string;
  shopId: string;
  onSuccess: (user: any) => void;
  onError: (error: string) => void;
}

export default function KeyAuthLogin({
  userId,
  shopId,
  onSuccess,
  onError,
}: KeyAuthLoginProps) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresBiometric, setRequiresBiometric] = useState(false);
  const [keyValidated, setKeyValidated] = useState(false);

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Get stored key auth data
      const keyAuthData = await getKeyAuthData(userId);
      if (!keyAuthData) {
        throw new Error("Key authentication not set up for this user");
      }

      // Verify key mathematically
      const result = await authenticateWithKeyAndBiometric(
        userId,
        shopId,
        key,
        keyAuthData.keyHash,
        keyAuthData.salt
      );

      if (!result.valid) {
        throw new Error(result.error || "Invalid key");
      }

      // Key is valid
      setKeyValidated(true);

      // Check if biometric is required
      if (result.requiresBiometric) {
        setRequiresBiometric(true);
        setLoading(false);
        // Biometric prompt will be handled separately
      } else {
        // Key alone is sufficient, get user and complete login
        const user = await getUserById(userId);
        if (!user) {
          throw new Error("User not found");
        }
        onSuccess(user);
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Authentication failed";
      setError(errorMsg);
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    setLoading(true);
    setError(null);

    try {
      // Authenticate with biometric
      const result = await authenticateWithBiometric(userId);
      if (!result.success || !result.user) {
        throw new Error(result.error || "Biometric authentication failed");
      }

      // Success - user authenticated with key + biometric
      onSuccess(result.user);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Biometric authentication failed";
      setError(errorMsg);
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (requiresBiometric && keyValidated) {
    return (
      <Stack gap="md">
        <Alert
          icon={<IconCheck size={16} />}
          color="green"
          title="Key Verified"
        >
          Your key is correct. Please complete authentication with biometric.
        </Alert>

        <Button
          fullWidth
          size="lg"
          leftSection={<IconFingerprint size={20} />}
          onClick={handleBiometric}
          loading={loading}
        >
          Authenticate with Biometric
        </Button>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
            {error}
          </Alert>
        )}
      </Stack>
    );
  }

  return (
    <form onSubmit={handleKeySubmit}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Enter your authentication key. If your device supports biometrics,
          you&apos;ll be prompted after entering the key.
        </Text>

        <TextInput
          label="Authentication Key"
          placeholder="Enter your key"
          type="password"
          value={key}
          onChange={(e) => setKey(e.currentTarget.value)}
          required
          disabled={loading}
          leftSection={<IconKey size={16} />}
          autoComplete="off"
        />

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
            {error}
          </Alert>
        )}

        <Button
          type="submit"
          fullWidth
          size="md"
          leftSection={<IconKey size={16} />}
          loading={loading}
        >
          Authenticate with Key
        </Button>
      </Stack>
    </form>
  );
}


