"use client";

import React, { useState } from "react";
import {
  TextInput,
  Button,
  Stack,
  Alert,
  Text,
  PasswordInput,
  Group,
  Badge,
} from "@mantine/core";
import {
  IconKey,
  IconFingerprint,
  IconAlertCircle,
  IconCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import {
  verifyKeyZeroLookup,
  verifyKeyWithShortId,
} from "@/lib/keyAuthZeroLookup";
import { authenticateWithBiometric } from "@/lib/webauthn";
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  hasBiometricCredentials,
} from "@/lib/webauthn";

interface KeyAuthLoginZeroLookupProps {
  onSuccess: (user: { userId: string; email?: string; shopId: string; [key: string]: unknown }) => void;
  onError: (error: string) => void;
}

export default function KeyAuthLoginZeroLookup({
  onSuccess,
  onError,
}: KeyAuthLoginZeroLookupProps) {
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [shopId, setShopId] = useState("");
  const [userId, setUserId] = useState("");
  const [useShortId, setUseShortId] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresBiometric, setRequiresBiometric] = useState(false);
  const [keyValidated, setKeyValidated] = useState(false);
  const [validatedUser, setValidatedUser] = useState<{
    userId: string;
    email: string;
    shopId: string;
  } | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);

  // Check biometric support
  React.useEffect(() => {
    const checkBiometric = async () => {
      if (isWebAuthnSupported()) {
        const available = await isPlatformAuthenticatorAvailable();
        setBiometricSupported(available);
      }
    };
    checkBiometric();
  }, []);

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email.trim()) {
        throw new Error("Email is required");
      }

      if (!shopId.trim()) {
        throw new Error("Shop ID is required");
      }

      if (!userId.trim() && !useShortId) {
        throw new Error("User ID is required (or use short ID)");
      }

      let result;

      if (useShortId) {
        // Verify using short ID (first 8 chars)
        result = await verifyKeyWithShortId(key, email, shopId, userId);
      } else {
        // Verify using full userId
        result = await verifyKeyZeroLookup(key, email, shopId, userId);
      }

      if (!result.valid) {
        throw new Error(result.error || "Invalid key");
      }

      // Key is valid!
      const user = {
        userId: result.userId!,
        email: email.toLowerCase(),
        shopId,
      };

      setKeyValidated(true);
      setValidatedUser(user);

      // Check if biometric is required
      if (biometricSupported && result.userId) {
        const hasBiometric = await hasBiometricCredentials(result.userId);
        if (hasBiometric) {
          setRequiresBiometric(true);
          setLoading(false);
          return;
        }
      }

      // No biometric required, complete login
      onSuccess(user);
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
    if (!validatedUser) return;

    setLoading(true);
    setError(null);

    try {
      const result = await authenticateWithBiometric(validatedUser.userId);
      if (!result.success || !result.user) {
        throw new Error(result.error || "Biometric authentication failed");
      }

      // Success - user authenticated with key + biometric
      onSuccess(validatedUser as unknown as { userId: string; shopId: string; [key: string]: unknown });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Biometric authentication failed";
      setError(errorMsg);
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (requiresBiometric && keyValidated && validatedUser) {
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
        <Alert
          icon={<IconInfoCircle size={16} />}
          color="blue"
          title="Zero-Lookup Authentication"
        >
          <Text size="sm">
            Provide your key, email, shop ID, and user ID. No database lookup
            needed - pure mathematical verification!
          </Text>
        </Alert>

        <TextInput
          label="Email"
          placeholder="your@email.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
          disabled={loading}
        />

        <TextInput
          label="Shop ID"
          placeholder="Your shop ID"
          value={shopId}
          onChange={(e) => setShopId(e.currentTarget.value)}
          required
          disabled={loading}
          description="You set this during registration"
        />

        <Group>
          <TextInput
            label={useShortId ? "Short User ID (8 chars)" : "User ID"}
            placeholder={useShortId ? "a7f3b9c2" : "Full user ID"}
            value={userId}
            onChange={(e) => setUserId(e.currentTarget.value)}
            required
            disabled={loading}
            style={{ flex: 1 }}
            description={
              useShortId
                ? "First 8 characters of your user ID (easier to remember)"
                : "Your full user ID from registration"
            }
          />
          <Button
            variant="light"
            onClick={() => setUseShortId(!useShortId)}
            style={{ marginTop: "auto" }}
          >
            {useShortId ? "Use Full ID" : "Use Short ID"}
          </Button>
        </Group>

        <PasswordInput
          label="Authentication Key"
          placeholder="Enter your key"
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

        <Text size="xs" c="dimmed">
          <strong>How it works:</strong> Your user ID is derived from your key +
          email + shop ID. If the key is correct, it will generate the same user
          ID you provide. <strong>No database lookup needed!</strong>
        </Text>

        <Badge color="green" variant="light" fullWidth>
          ✓ Zero Lookups - Pure Mathematics
        </Badge>
      </Stack>
    </form>
  );
}


