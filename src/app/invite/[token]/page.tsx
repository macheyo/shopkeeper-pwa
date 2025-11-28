"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
  Modal,
  Code,
  ActionIcon,
  Tooltip,
  Checkbox,
  Box,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconUserPlus,
  IconCheck,
  IconCopy,
} from "@tabler/icons-react";
import {
  getInvitationByToken,
  updateInvitation,
  createUser,
} from "@/lib/usersDB";
import { generateUserId } from "@/lib/auth";
import { InvitationDoc } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function InviteAcceptancePage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  const [invitation, setInvitation] = useState<InvitationDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseConfirmed, setLicenseConfirmed] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadInvitation();
    }
  }, [token]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      const invite = await getInvitationByToken(token);

      if (!invite) {
        setError("Invitation not found or invalid");
        return;
      }

      if (invite.status !== "pending") {
        setError(
          invite.status === "accepted"
            ? "This invitation has already been accepted"
            : "This invitation has expired"
        );
        return;
      }

      if (new Date(invite.expiresAt) < new Date()) {
        setError("This invitation has expired");
        // Update status to expired
        await updateInvitation({
          ...invite,
          status: "expired",
        });
        return;
      }

      setInvitation(invite);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load invitation"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!invitation) return;

    // Validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      setLoading(true);

      // Generate user ID
      const userId = generateUserId();
      setCreatedUserId(userId); // Store userId in state for use in modal

      // Create user
      const user = await createUser({
        userId,
        phoneNumber: invitation.phoneNumber || invitation.email || "", // Use phoneNumber, fallback to email for backwards compatibility
        email: invitation.email, // Optional, for backwards compatibility
        name: name.trim(),
        role: invitation.role,
        shopId: invitation.shopId,
        status: "active",
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.createdAt,
      });

      // Note: We use license-based auth, no password needed

      // Generate employee license (tied to device)
      // License will be shown to user in modal - they must save it
      // We'll store it in localStorage after user confirms they saved it
      let licenseKey: string | undefined;
      try {
        const { generateEmployeeLicense } = await import("@/lib/licenseKey");
        const { getShopById } = await import("@/lib/usersDB");
        const shopData = await getShopById(invitation.shopId);
        const phoneNumber = invitation.phoneNumber || invitation.email || "";
        const licenseResult = await generateEmployeeLicense(
          phoneNumber,
          invitation.shopId,
          shopData?.shopName || "Shop",
          name.trim(),
          userId
        );
        licenseKey = licenseResult.licenseKey;
      } catch (err) {
        console.error(
          "Failed to generate employee license (non-critical):",
          err
        );
        // Continue anyway - invitation acceptance succeeds even if license generation fails
      }

      // Update invitation status
      await updateInvitation({
        ...invitation,
        status: "accepted",
      });

      // Show license modal if license was generated
      if (licenseKey) {
        setLicenseKey(licenseKey);
        setShowLicenseModal(true);
      } else {
        setSuccess(true);
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to accept invitation"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading && !invitation) {
    return (
      <Container size="xs" py="xl">
        <LoadingSpinner size="md" message="Loading invitation..." />
      </Container>
    );
  }

  if (error && !invitation) {
    return (
      <Container size="xs" py="xl">
        <Paper shadow="md" p="xl" radius="md" withBorder>
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
            {error}
          </Alert>
          <Button fullWidth mt="md" onClick={() => router.push("/login")}>
            Go to Login
          </Button>
        </Paper>
      </Container>
    );
  }

  if (success) {
    return (
      <Container size="xs" py="xl">
        <Paper shadow="md" p="xl" radius="md" withBorder>
          <Stack gap="md" align="center">
            <IconCheck size={48} color="green" />
            <Title order={2} ta="center">
              Account Created!
            </Title>
            <Text ta="center" c="dimmed">
              Your account has been created successfully. Redirecting to
              login...
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="xs" py="xl">
      {/* License Modal - shown after invitation acceptance */}
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
              This license key is tied to this device. If you clear your browser
              data or use a different device, you&apos;ll need this license key
              to continue using the app.
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
              if (licenseKey && createdUserId && invitation) {
                // Store license in localStorage
                const { storeLicenseKey } = await import(
                  "@/lib/licenseStorage"
                );
                storeLicenseKey(createdUserId, invitation.shopId, licenseKey);
              }
              setShowLicenseModal(false);
              setSuccess(true);
              // Redirect to login after 2 seconds
              setTimeout(() => {
                router.push("/login");
              }, 2000);
            }}
          >
            I&apos;ve Saved It - Continue
          </Button>
        </Stack>
      </Modal>

      <Paper shadow="md" p="xl" radius="md" withBorder>
        <Stack gap="md">
          <div>
            <Title order={2} ta="center" mb="xs">
              Accept Invitation
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              You&apos;ve been invited to join{" "}
              {invitation?.phoneNumber || invitation?.email || "this shop"}
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

          <form onSubmit={handleAccept}>
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
                label="Phone Number"
                value={invitation?.phoneNumber || invitation?.email || ""}
                disabled
                readOnly
              />

              <TextInput
                label="Role"
                value={invitation?.role || ""}
                disabled
                readOnly
              />

              <Button
                type="submit"
                fullWidth
                leftSection={<IconUserPlus size={16} />}
                loading={loading}
                size="md"
              >
                Accept Invitation
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  );
}
