"use client";

import React, { useState } from "react";
import {
  Card,
  Stack,
  Button,
  Title,
  Text,
  Alert,
  PasswordInput,
  Group,
} from "@mantine/core";
import {
  IconKey,
  IconCheck,
  IconAlertCircle,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  deriveUserIdFromKeyAndEmail,
  generateRecoveryCodeFromKey,
  validateKeyStrength,
} from "@/lib/keyAuthDeterministic";

export default function KeyAuthSetup() {
  const { currentUser, shop } = useAuth();
  const [key, setKey] = useState("");
  const [confirmKey, setConfirmKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  const handleSetup = async () => {
    if (!currentUser || !shop) {
      setError("User or shop not found");
      return;
    }

    setError(null);
    setSuccess(null);
    setRecoveryCode(null);

    // Validation
    if (key !== confirmKey) {
      setError("Keys do not match");
      return;
    }

    const validation = validateKeyStrength(key);
    if (!validation.valid) {
      setError(validation.errors.join(", "));
      return;
    }

    setLoading(true);

    try {
      // Derive userId from key (this is deterministic)
      const derivedUserId = await deriveUserIdFromKeyAndEmail(
        key,
        shop.shopId,
        currentUser.email || currentUser.phoneNumber || ""
      );

      // Generate recovery code
      const recovery = await generateRecoveryCodeFromKey(
        key,
        currentUser.email || currentUser.phoneNumber || "",
        shop.shopId
      );

      // Update user's userId to match derived one
      // This ensures key verification will work
      const { updateUser } = await import("@/lib/usersDB");
      const updatedUser = {
        ...currentUser,
        userId: derivedUserId, // Update to derived userId
      };
      await updateUser(updatedUser);

      setRecoveryCode(recovery);
      setShowRecovery(true);
      setSuccess(
        "Key authentication set up successfully! Your user ID has been derived from your key."
      );
      setKey("");
      setConfirmKey("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set up key authentication"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser || !shop) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="yellow">
        Please log in to set up key authentication.
      </Alert>
    );
  }

  return (
    <Card withBorder shadow="sm" p="lg">
      <Stack gap="md">
        <Group gap="xs">
          <IconKey size={20} />
          <Title order={3}>Set Up Key Authentication</Title>
        </Group>

        <Alert
          icon={<IconInfoCircle size={16} />}
          color="blue"
          title="How It Works"
        >
          <Text size="sm">
            Your key will be used to derive your user ID. This means:
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              <li>No storage needed - verification is pure mathematics</li>
              <li>Works even if all site data is cleared</li>
              <li>You only need your key + email to login</li>
              <li>Your user ID is derived from your key</li>
            </ul>
          </Text>
        </Alert>

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            title="Error"
            onClose={() => setError(null)}
            withCloseButton
          >
            {error}
          </Alert>
        )}

        {success && !showRecovery && (
          <Alert
            icon={<IconCheck size={16} />}
            color="green"
            title="Success"
            onClose={() => setSuccess(null)}
            withCloseButton
          >
            {success}
          </Alert>
        )}

        {showRecovery && recoveryCode && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="yellow"
            title="Important: Save Your Recovery Code"
          >
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                Recovery Code: <code>{recoveryCode}</code>
              </Text>
              <Text size="sm" c="dimmed">
                Write this down! You can use it to verify your key if needed.
                This code is deterministic from your key - same key always
                generates same code.
              </Text>
              <Button
                variant="light"
                size="xs"
                onClick={() => {
                  navigator.clipboard.writeText(recoveryCode);
                  setSuccess("Recovery code copied to clipboard!");
                }}
              >
                Copy Recovery Code
              </Button>
            </Stack>
          </Alert>
        )}

        <Text size="sm" c="dimmed">
          Choose a secure key. This will be used to derive your user ID. Make
          sure you remember it - there&apos;s no password reset!
        </Text>

        <PasswordInput
          label="Authentication Key"
          placeholder="Enter your key"
          value={key}
          onChange={(e) => setKey(e.currentTarget.value)}
          disabled={loading}
          required
          description="This key will be used to derive your user ID. Choose something memorable but secure."
        />

        <PasswordInput
          label="Confirm Key"
          placeholder="Confirm your key"
          value={confirmKey}
          onChange={(e) => setConfirmKey(e.currentTarget.value)}
          disabled={loading}
          required
        />

        <Button
          onClick={handleSetup}
          loading={loading}
          leftSection={<IconKey size={16} />}
          fullWidth
        >
          Set Up Key Authentication
        </Button>

        <Text size="xs" c="dimmed">
          <strong>Note:</strong> Your user ID will be updated to match the one
          derived from your key. This ensures key verification works even if all
          site data is cleared.
        </Text>
      </Stack>
    </Card>
  );
}



