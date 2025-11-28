"use client";

import React, { useState, useEffect } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Button,
  Alert,
  Code,
  Group,
  ActionIcon,
  Tooltip,
  Divider,
  Badge,
} from "@mantine/core";
import {
  IconCopy,
  IconCheck,
  IconAlertCircle,
  IconUser,
  IconMail,
  IconBuilding,
  IconLicense,
  IconCalendar,
  IconDeviceDesktop,
  IconShield,
  IconStar,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  formatFeatureName,
  getFeatureCategory,
  FEATURE_METADATA,
} from "@/lib/features";

export default function ProfilePage() {
  const { currentUser, shop } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [licenseCopied, setLicenseCopied] = useState(false);
  const [licenseDetails, setLicenseDetails] = useState<any>(null);

  // Load license key from session (or localStorage fallback) and decode details
  useEffect(() => {
    const loadLicense = async () => {
      if (currentUser && shop) {
        const { getLicenseKey } = await import("@/lib/licenseStorage");
        const { validateLicenseKey } = await import("@/lib/licenseKey");
        const { getSession } = await import("@/lib/auth");

        // Try session first, then fallback to dedicated storage
        const session = getSession();
        const storedLicense =
          session?.licenseKey || getLicenseKey(currentUser.userId, shop.shopId);
        setLicenseKey(storedLicense);

        // Decode license details if license exists
        if (storedLicense) {
          try {
            const validation = await validateLicenseKey(storedLicense);
            if (validation.valid && validation.data) {
              setLicenseDetails(validation.data);
            }
          } catch (err) {
            console.error("Failed to decode license details:", err);
          }
        }
      }
    };
    loadLicense();
  }, [currentUser, shop]);

  const copyLicense = async () => {
    if (licenseKey) {
      await navigator.clipboard.writeText(licenseKey);
      setLicenseCopied(true);
      setTimeout(() => setLicenseCopied(false), 2000);
    }
  };

  return (
    <ProtectedRoute requireAuth={true}>
      <Container size="md" py="xl">
        <Stack gap="md">
          <Title order={2}>Profile</Title>

          {/* User Information */}
          <Paper shadow="sm" p="md" withBorder>
            <Stack gap="sm">
              <Title order={4}>Account Information</Title>
              <Group gap="md">
                <IconUser size={20} />
                <div>
                  <Text size="xs" c="dimmed">
                    Name
                  </Text>
                  <Text fw={500}>{currentUser?.name}</Text>
                </div>
              </Group>
              <Group gap="md">
                <IconMail size={20} />
                <div>
                  <Text size="xs" c="dimmed">
                    Phone Number
                  </Text>
                  <Text fw={500}>
                    {currentUser?.phoneNumber || currentUser?.email || "N/A"}
                  </Text>
                </div>
              </Group>
              <Group gap="md">
                <IconBuilding size={20} />
                <div>
                  <Text size="xs" c="dimmed">
                    Shop
                  </Text>
                  <Text fw={500}>{shop?.shopName}</Text>
                </div>
              </Group>
              <Group gap="md">
                <div>
                  <Text size="xs" c="dimmed">
                    Role
                  </Text>
                  <Text fw={500} tt="capitalize">
                    {currentUser?.role}
                  </Text>
                </div>
              </Group>
            </Stack>
          </Paper>

          {/* License Key Display */}
          <Paper shadow="sm" p="md" withBorder>
            <Stack gap="md">
              <div>
                <Title order={4}>License Key</Title>
                <Text size="sm" c="dimmed">
                  Your device-tied license key. This key is stored locally on
                  this device only.
                </Text>
              </div>

              {licenseKey ? (
                <>
                  <Alert
                    icon={<IconCheck size={16} />}
                    title="License Key Found"
                    color="green"
                  >
                    <Stack gap="sm">
                      <Text size="sm">
                        Your license key is stored on this device. You can copy
                        it below.
                      </Text>
                      <Group gap="xs" align="flex-start" wrap="nowrap">
                        <Code
                          style={{
                            flex: 1,
                            fontSize: "11px",
                            padding: "12px",
                            cursor: "pointer",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "100%",
                            wordBreak: "break-all",
                          }}
                          block
                          onClick={copyLicense}
                          title="Click to copy full license key"
                        >
                          {licenseKey.length > 50
                            ? `${licenseKey.substring(
                                0,
                                25
                              )}...${licenseKey.substring(
                                licenseKey.length - 25
                              )}`
                            : licenseKey}
                        </Code>
                        <Tooltip
                          label={
                            licenseCopied ? "Copied!" : "Copy full license key"
                          }
                          withArrow
                        >
                          <ActionIcon
                            variant="light"
                            color={licenseCopied ? "green" : "blue"}
                            onClick={copyLicense}
                            size="xl"
                            style={{ flexShrink: 0 }}
                          >
                            <IconCopy size={20} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                      <Button
                        fullWidth
                        leftSection={<IconCopy size={16} />}
                        onClick={copyLicense}
                        variant={licenseCopied ? "light" : "filled"}
                        color={licenseCopied ? "green" : "blue"}
                        size="md"
                      >
                        {licenseCopied
                          ? "Copied to Clipboard!"
                          : "Copy License Key"}
                      </Button>
                      <Alert color="yellow">
                        <Text size="xs">
                          <strong>Important:</strong> If you clear your browser
                          data or use a different device, you&apos;ll need to
                          provide this license key again during login.
                        </Text>
                      </Alert>

                      {/* License Details */}
                      {licenseDetails && (
                        <>
                          <Divider />
                          <div>
                            <Title order={5} mb="sm">
                              License Details
                            </Title>
                            <Stack gap="xs">
                              <Group gap="md">
                                <IconUser size={18} />
                                <div>
                                  <Text size="xs" c="dimmed">
                                    Owner
                                  </Text>
                                  <Text size="sm" fw={500}>
                                    {licenseDetails.ownerName}
                                  </Text>
                                </div>
                              </Group>
                              <Group gap="md">
                                <IconBuilding size={18} />
                                <div>
                                  <Text size="xs" c="dimmed">
                                    Shop
                                  </Text>
                                  <Text size="sm" fw={500}>
                                    {licenseDetails.shopName}
                                  </Text>
                                </div>
                              </Group>
                              {licenseDetails.role && (
                                <Group gap="md">
                                  <IconShield size={18} />
                                  <div>
                                    <Text size="xs" c="dimmed">
                                      Role
                                    </Text>
                                    <Text size="sm" fw={500} tt="capitalize">
                                      {licenseDetails.role}
                                    </Text>
                                  </div>
                                </Group>
                              )}
                              {licenseDetails.expiresAt && (
                                <Group gap="md">
                                  <IconCalendar size={18} />
                                  <div>
                                    <Text size="xs" c="dimmed">
                                      Expires
                                    </Text>
                                    <Text
                                      size="sm"
                                      fw={500}
                                      c={
                                        new Date(licenseDetails.expiresAt) <
                                        new Date()
                                          ? "red"
                                          : new Date(licenseDetails.expiresAt) <
                                            new Date(
                                              Date.now() +
                                                3 * 24 * 60 * 60 * 1000
                                            )
                                          ? "yellow"
                                          : "green"
                                      }
                                    >
                                      {new Date(
                                        licenseDetails.expiresAt
                                      ).toLocaleDateString()}{" "}
                                      {new Date(licenseDetails.expiresAt) <
                                      new Date()
                                        ? "(Expired)"
                                        : new Date(licenseDetails.expiresAt) <
                                          new Date(
                                            Date.now() + 3 * 24 * 60 * 60 * 1000
                                          )
                                        ? "(Expiring Soon)"
                                        : ""}
                                    </Text>
                                  </div>
                                </Group>
                              )}
                              {licenseDetails.issuedAt && (
                                <Group gap="md">
                                  <IconCalendar size={18} />
                                  <div>
                                    <Text size="xs" c="dimmed">
                                      Issued
                                    </Text>
                                    <Text size="sm" fw={500}>
                                      {new Date(
                                        licenseDetails.issuedAt
                                      ).toLocaleDateString()}
                                    </Text>
                                  </div>
                                </Group>
                              )}
                              <Group gap="md">
                                <IconDeviceDesktop size={18} />
                                <div>
                                  <Text size="xs" c="dimmed">
                                    Device Tied
                                  </Text>
                                  <Text size="sm" fw={500}>
                                    {licenseDetails.deviceId
                                      ? "Yes (This device only)"
                                      : "No"}
                                  </Text>
                                </div>
                              </Group>
                              {licenseDetails.features &&
                                licenseDetails.features.length > 0 && (
                                  <Group gap="md" align="flex-start">
                                    <IconStar size={18} />
                                    <div style={{ flex: 1 }}>
                                      <Text size="xs" c="dimmed" mb={4}>
                                        Features (
                                        {licenseDetails.features.length})
                                      </Text>
                                      <Group gap="xs">
                                        {licenseDetails.features.map(
                                          (feature: string) => {
                                            const category = getFeatureCategory(
                                              feature as any
                                            );
                                            const name = formatFeatureName(
                                              feature as any
                                            );
                                            const metadata =
                                              FEATURE_METADATA[feature as any];
                                            return (
                                              <Badge
                                                key={feature}
                                                variant="light"
                                                color={
                                                  category === "Premium"
                                                    ? "violet"
                                                    : category === "Security"
                                                    ? "green"
                                                    : "blue"
                                                }
                                                size="sm"
                                                title={
                                                  metadata?.description || ""
                                                }
                                              >
                                                {name}
                                              </Badge>
                                            );
                                          }
                                        )}
                                      </Group>
                                    </div>
                                  </Group>
                                )}
                            </Stack>
                          </div>
                        </>
                      )}
                    </Stack>
                  </Alert>
                </>
              ) : (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  title="License Key Not Found"
                  color="yellow"
                >
                  <Text size="sm">
                    No license key found on this device. If you have a license
                    key, you can provide it during login. The license key is
                    tied to the device where it was generated.
                  </Text>
                </Alert>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </ProtectedRoute>
  );
}
