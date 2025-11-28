"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  Stack,
  Button,
  Title,
  Text,
  Alert,
  Group,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
} from "@mantine/core";
import {
  IconFingerprint,
  IconPlus,
  IconTrash,
  IconCheck,
  IconX,
  IconAlertCircle,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  registerBiometric,
  getUserBiometricCredentials,
  deleteBiometricCredential,
  WebAuthnCredential,
} from "@/lib/webauthn";

export default function BiometricManager() {
  const { currentUser } = useAuth();
  const [supported, setSupported] = useState(false);
  const [available, setAvailable] = useState(false);
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [deviceName, setDeviceName] = useState("");

  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = isWebAuthnSupported();
      setSupported(isSupported);

      if (isSupported) {
        const isAvailable = await isPlatformAuthenticatorAvailable();
        setAvailable(isAvailable);
      }

      if (currentUser) {
        await loadCredentials();
      }
    };

    checkSupport();
  }, [currentUser]);

  const loadCredentials = async () => {
    if (!currentUser) return;

    try {
      const creds = await getUserBiometricCredentials(currentUser.userId);
      setCredentials(creds);
    } catch (err) {
      console.error("Error loading credentials:", err);
    }
  };

  const handleRegister = async () => {
    if (!currentUser) {
      setError("User not found");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await registerBiometric(
        currentUser,
        deviceName || undefined
      );

      if (result.success) {
        setSuccess("Biometric authentication registered successfully!");
        setRegisterModalOpen(false);
        setDeviceName("");
        await loadCredentials();
      } else {
        setError(result.error || "Failed to register biometric");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to register biometric"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (credentialId: string) => {
    if (
      !confirm("Are you sure you want to remove this biometric credential?")
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await deleteBiometricCredential(credentialId);
      if (result.success) {
        setSuccess("Biometric credential removed");
        await loadCredentials();
      } else {
        setError(result.error || "Failed to delete credential");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete credential"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="yellow">
        Please log in to manage biometric authentication.
      </Alert>
    );
  }

  if (!supported) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="yellow">
        Biometric authentication is not supported in this browser.
      </Alert>
    );
  }

  if (!available) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="yellow">
        Platform authenticator (biometric) is not available on this device.
      </Alert>
    );
  }

  return (
    <Card withBorder shadow="sm" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconFingerprint size={20} />
            <Title order={3}>Biometric Authentication</Title>
          </Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setRegisterModalOpen(true)}
            disabled={loading}
          >
            Add Biometric
          </Button>
        </Group>

        <Text size="sm" c="dimmed">
          Register your fingerprint, face, or other biometric to sign in quickly
          and securely.
        </Text>

        {error && (
          <Alert
            icon={<IconX size={16} />}
            color="red"
            title="Error"
            onClose={() => setError(null)}
            withCloseButton
          >
            {error}
          </Alert>
        )}

        {success && (
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

        {credentials.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} color="blue">
            No biometric credentials registered. Click "Add Biometric" to
            register one.
          </Alert>
        ) : (
          <Stack gap="sm">
            {credentials.map((cred) => (
              <Card key={cred._id} withBorder p="md">
                <Group justify="space-between" align="center">
                  <Group>
                    <IconFingerprint size={20} />
                    <div>
                      <Text fw={500}>
                        {cred.deviceName || "Biometric Device"}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Registered:{" "}
                        {new Date(cred.createdAt).toLocaleDateString()}
                        {cred.lastUsedAt &&
                          ` • Last used: ${new Date(
                            cred.lastUsedAt
                          ).toLocaleDateString()}`}
                      </Text>
                    </div>
                  </Group>
                  <Group gap="xs">
                    <Badge color="green" variant="light">
                      Active
                    </Badge>
                    <ActionIcon
                      color="red"
                      variant="light"
                      onClick={() => handleDelete(cred.credentialId)}
                      disabled={loading}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>

      <Modal
        opened={registerModalOpen}
        onClose={() => {
          setRegisterModalOpen(false);
          setDeviceName("");
          setError(null);
        }}
        title="Register Biometric"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            You will be prompted to use your device&apos;s biometric
            authentication (fingerprint, face, etc.) to register.
          </Text>

          <TextInput
            label="Device Name (Optional)"
            placeholder="e.g., iPhone 13, MacBook Pro"
            value={deviceName}
            onChange={(e) => setDeviceName(e.currentTarget.value)}
            description="Give this device a name to identify it later"
          />

          {error && (
            <Alert icon={<IconX size={16} />} color="red" title="Error">
              {error}
            </Alert>
          )}

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                setRegisterModalOpen(false);
                setDeviceName("");
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegister}
              loading={loading}
              leftSection={<IconFingerprint size={16} />}
            >
              Register
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}


