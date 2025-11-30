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
  Divider,
  Checkbox,
  Code,
  ActionIcon,
  Tooltip,
  Modal,
  Box,
  Select,
} from "@mantine/core";
import { IconAlertCircle, IconUserPlus, IconCopy } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getCountryCodeSelectData } from "@/lib/countryCodes";
import { validatePhoneNumber } from "@/lib/phoneValidation";

export default function RegisterPage() {
  const router = useRouter();
  const { register, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+263");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseConfirmed, setLicenseConfirmed] = useState(false);
  const [registeredPhoneNumber, setRegisteredPhoneNumber] =
    useState<string>("");

  // Format phone number as user types (e.g., "123 456 7890")
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, "");

    // Limit to reasonable length (15 digits max for international numbers)
    const limitedDigits = digits.slice(0, 15);

    // Format based on length - group digits for readability
    if (limitedDigits.length <= 3) {
      return limitedDigits;
    } else if (limitedDigits.length <= 6) {
      return `${limitedDigits.slice(0, 3)} ${limitedDigits.slice(3)}`;
    } else if (limitedDigits.length <= 9) {
      return `${limitedDigits.slice(0, 3)} ${limitedDigits.slice(
        3,
        6
      )} ${limitedDigits.slice(6)}`;
    } else {
      return `${limitedDigits.slice(0, 3)} ${limitedDigits.slice(
        3,
        6
      )} ${limitedDigits.slice(6, 9)} ${limitedDigits.slice(9)}`;
    }
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.currentTarget.value);
    setPhoneNumber(formatted);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    // Validate phone number using Zod
    const phoneValidation = validatePhoneNumber(phoneNumber.trim());
    if (!phoneValidation.valid) {
      setError(phoneValidation.error || "Please enter a valid phone number");
      return;
    }

    if (!shopName.trim()) {
      setError("Shop name is required");
      return;
    }

    setLoading(true);

    try {
      // Combine country code and phone number
      const fullPhoneNumber = `${countryCode}${phoneNumber
        .replace(/^0+/, "")
        .replace(/[\s\-\(\)]/g, "")}`;
      const result = await register(fullPhoneNumber, name, shopName);

      // Store full phone number (with country code) for later use
      setRegisteredPhoneNumber(fullPhoneNumber);

      // Show license modal first (if license was generated)
      if (result.licenseKey) {
        console.log(
          "License key received:",
          result.licenseKey.substring(0, 20) + "..."
        );
        setLicenseKey(result.licenseKey);
        setShowLicenseModal(true);
      } else {
        console.log("No license key returned");
        // ProtectedRoute will handle redirect after registration
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
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
                Create Account
              </Title>
              <Text c="dimmed" ta="center" size="sm">
                Set up your shop and start managing your business
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

            {/* License Modal - shown after registration */}
            <Modal
              opened={showLicenseModal}
              onClose={() => {}}
              title="Save Your License Key"
              size="lg"
              closeOnClickOutside={false}
              closeOnEscape={false}
              withCloseButton={false}
            >
              <Stack gap="md">
                <Alert icon={<IconAlertCircle size={16} />} color="yellow">
                  <Text size="sm" fw={500} mb="xs">
                    Important: Save this license key securely!
                  </Text>
                  <Text size="xs">
                    This license key is tied to this device and valid for 14
                    days. If you clear your browser data or use a different
                    device, you&apos;ll need this license key to continue using
                    the app.
                  </Text>
                </Alert>

                <Box>
                  <Text size="sm" fw={500} mb="xs">
                    Your License Key:
                  </Text>
                  <Group gap="xs" align="flex-start">
                    <Code
                      style={{
                        flex: 1,
                        wordBreak: "break-all",
                        fontSize: "11px",
                        padding: "12px",
                        fontFamily: "monospace",
                      }}
                      block
                    >
                      {licenseKey}
                    </Code>
                    <Tooltip label="Copy license key">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={async () => {
                          if (licenseKey) {
                            await navigator.clipboard.writeText(licenseKey);
                          }
                        }}
                      >
                        <IconCopy size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Box>

                <Button
                  fullWidth
                  leftSection={<IconCopy size={16} />}
                  onClick={async () => {
                    if (licenseKey) {
                      await navigator.clipboard.writeText(licenseKey);
                    }
                  }}
                  variant="light"
                >
                  Copy License Key
                </Button>

                <Checkbox
                  label="I have saved my license key securely"
                  checked={licenseConfirmed}
                  onChange={(e) => setLicenseConfirmed(e.currentTarget.checked)}
                />

                <Button
                  fullWidth
                  disabled={!licenseConfirmed}
                  onClick={async () => {
                    try {
                      if (licenseKey) {
                        // Store license in localStorage
                        // We need to get user info - but session might not exist yet
                        // So we'll need to create session first, then store license
                        const { createSession, getSession } = await import(
                          "@/lib/auth"
                        );
                        const { getUserByPhoneNumber, getShopById } =
                          await import("@/lib/usersDB");

                        // Get user and shop to create session
                        // Normalize phone number (remove spaces, dashes, parentheses)
                        const fullPhone =
                          registeredPhoneNumber ||
                          `${countryCode}${phoneNumber
                            .replace(/^0+/, "")
                            .replace(/[\s\-\(\)]/g, "")}`;
                        const normalizedPhone = fullPhone.replace(
                          /[\s\-\(\)]/g,
                          ""
                        );
                        const user = await getUserByPhoneNumber(
                          normalizedPhone
                        );
                        if (!user) {
                          setError("User not found. Please try logging in.");
                          return;
                        }

                        const shopData = await getShopById(user.shopId);
                        if (!shopData) {
                          setError("Shop data not found. Please try again.");
                          return;
                        }

                        // Create session with license key
                        createSession(user, licenseKey);

                        // Verify session was created
                        const session = getSession();
                        if (!session) {
                          setError(
                            "Failed to create session. Please try again."
                          );
                          return;
                        }

                        // Store license
                        const { storeLicenseKey } = await import(
                          "@/lib/licenseStorage"
                        );
                        storeLicenseKey(licenseKey);

                        // Refresh auth context to update state
                        // This will load user and shop from the session we just created
                        await refreshUser();

                        // Small delay to ensure state is updated
                        await new Promise((resolve) =>
                          setTimeout(resolve, 100)
                        );
                      }

                      setShowLicenseModal(false);
                      // Small delay to ensure state is updated before navigating
                      await new Promise((resolve) => setTimeout(resolve, 200));
                      // Proceed to onboarding
                      router.push("/");
                    } catch (err) {
                      console.error("Error creating session:", err);
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Failed to create session. Please try again."
                      );
                    }
                  }}
                >
                  I&apos;ve Saved It - Continue
                </Button>
              </Stack>
            </Modal>

            {!showLicenseModal && (
              <form onSubmit={handleRegister}>
                <Stack gap="md">
                  <TextInput
                    label="Full Name"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                    required
                    disabled={loading}
                  />

                  <TextInput
                    label="Shop Name"
                    placeholder="My Shop"
                    value={shopName}
                    onChange={(e) => setShopName(e.currentTarget.value)}
                    required
                    disabled={loading}
                  />

                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Phone Number
                    </Text>
                    <Group wrap="nowrap" gap="xs">
                      <Select
                        value={countryCode}
                        onChange={(value) => setCountryCode(value || "+263")}
                        data={getCountryCodeSelectData()}
                        searchable
                        placeholder="Code"
                        style={{ width: 120 }}
                        disabled={loading}
                      />
                      <TextInput
                        placeholder="771 802 312"
                        type="tel"
                        value={phoneNumber}
                        onChange={handlePhoneNumberChange}
                        required
                        disabled={loading}
                        style={{ flex: 1 }}
                        error={
                          phoneNumber.trim() &&
                          !validatePhoneNumber(phoneNumber).valid
                            ? validatePhoneNumber(phoneNumber).error
                            : undefined
                        }
                      />
                    </Group>
                  </div>

                  <Button
                    type="submit"
                    fullWidth
                    leftSection={<IconUserPlus size={16} />}
                    loading={loading}
                    size="md"
                  >
                    Create Account
                  </Button>
                </Stack>
              </form>
            )}

            {!showLicenseModal && (
              <>
                <Divider label="OR" labelPosition="center" />

                <Group justify="center">
                  <Text size="sm" c="dimmed">
                    Already have an account?{" "}
                  </Text>
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => router.push("/login")}
                  >
                    Sign In
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        </Paper>
      </Container>
    </ProtectedRoute>
  );
}
