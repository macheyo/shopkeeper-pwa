"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Container,
  Paper,
  TextInput,
  Button,
  Title,
  Text,
  Stack,
  Alert,
  Group,
} from "@mantine/core";
import { IconAlertCircle, IconLicense } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithLicense } = useAuth();
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!licenseKey.trim()) {
        setError("License key is required");
        setLoading(false);
        return;
      }

      await loginWithLicense(licenseKey);
      // loginWithLicense handles redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requireAuth={false}>
      <Container size="xs" py="xl">
        <Paper shadow="md" p="xl" radius="md" withBorder>
          <Stack gap="md">
            <div>
              <Title order={2} ta="center" mb="xs">
                ShopKeeper
              </Title>
              <Text c="dimmed" ta="center" size="sm">
                Sign in with your license key
              </Text>
            </div>

            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Error"
                color="red"
                onClose={() => setError(null)}
                withCloseButton
              >
                {error}
              </Alert>
            )}

            <form onSubmit={handleLogin}>
              <Stack gap="md">
                <TextInput
                  label="License Key"
                  placeholder="Enter your license key"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.currentTarget.value)}
                  required
                  disabled={loading}
                  leftSection={<IconLicense size={16} />}
                  description="Your device-tied license key from registration"
                />

                <Button
                  type="submit"
                  fullWidth
                  leftSection={<IconLicense size={16} />}
                  loading={loading}
                  size="md"
                >
                  Sign In with License
                </Button>
              </Stack>
            </form>

            <Group justify="center">
              <Text size="sm" c="dimmed">
                Don&apos;t have an account?{" "}
              </Text>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => router.push("/register")}
              >
                Sign Up
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
    </ProtectedRoute>
  );
}
