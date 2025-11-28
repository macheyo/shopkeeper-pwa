"use client";

import React, { useState } from "react";
import {
  TextInput,
  Button,
  Stack,
  Alert,
  Text,
  PasswordInput,
} from "@mantine/core";
import {
  IconKey,
  IconFingerprint,
  IconAlertCircle,
  IconCheck,
} from "@tabler/icons-react";
import {
  deriveUserIdFromKeyAndEmail,
  verifyKeyDeterministic,
  authenticateKeyAfterDataClear,
} from "@/lib/keyAuthDeterministic";
import { getUserByEmail } from "@/lib/usersDB";
import { authenticateWithBiometric } from "@/lib/webauthn";
import { isWebAuthnSupported, isPlatformAuthenticatorAvailable } from "@/lib/webauthn";

interface KeyAuthLoginDeterministicProps {
  onSuccess: (user: any) => void;
  onError: (error: string) => void;
  shopId?: string; // Optional - user can provide if data cleared
}

export default function KeyAuthLoginDeterministic({
  onSuccess,
  onError,
  shopId,
}: KeyAuthLoginDeterministicProps) {
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [providedShopId, setProvidedShopId] = useState(shopId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresBiometric, setRequiresBiometric] = useState(false);
  const [keyValidated, setKeyValidated] = useState(false);
  const [validatedUserId, setValidatedUserId] = useState<string | null>(null);
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

      if (!providedShopId.trim()) {
        throw new Error("Shop ID is required (or shop name to derive it)");
      }

      // Look up user by email (works even if local data cleared - from CouchDB)
      const user = await getUserByEmail(email.toLowerCase());

      if (!user) {
        throw new Error("User not found. Please check your email.");
      }

      // Verify key deterministically
      const result = await verifyKeyDeterministic(
        key,
        email.toLowerCase(),
        providedShopId || user.shopId,
        user.userId
      );

      if (!result.valid) {
        throw new Error(result.error || "Invalid key");
      }

      // Key is valid!
      setKeyValidated(true);
      setValidatedUserId(result.userId || user.userId);

      // Check if biometric is required
      if (biometricSupported && user.userId) {
        // Check if user has biometric credentials
        const { hasBiometricCredentials } = await import("@/lib/webauthn");
        const hasBiometric = await hasBiometricCredentials(user.userId);

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
    if (!validatedUserId) return;

    setLoading(true);
    setError(null);

    try {
      // Authenticate with biometric
      const result = await authenticateWithBiometric(validatedUserId);
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
          Enter your key and email. Your user ID will be derived from these -
          no storage needed! Works even if all site data is cleared.
        </Text>

        <TextInput
          label="Email"
          placeholder="your@email.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
          disabled={loading}
        />

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

        {!shopId && (
          <TextInput
            label="Shop ID (Optional)"
            placeholder="Leave empty if you remember it"
            value={providedShopId}
            onChange={(e) => setProvidedShopId(e.currentTarget.value)}
            disabled={loading}
            description="If you don't remember, we'll look it up from your email"
          />
        )}

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
          <strong>How it works:</strong> Your user ID is derived from your key
          + email. If the key is correct, it will generate the same user ID that
          was created during registration. No storage needed!
        </Text>
      </Stack>
    </form>
  );
}



