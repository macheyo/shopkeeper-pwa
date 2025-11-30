"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Title,
  Button,
  Group,
  Table,
  Badge,
  ActionIcon,
  Stack,
  Text,
  Paper,
  Modal,
  Select,
  Alert,
  Menu,
  Card,
  ScrollArea,
  Divider,
  Textarea,
  CopyButton,
  Tooltip,
} from "@mantine/core";
import {
  IconUserPlus,
  IconCheck,
  IconX,
  IconEdit,
  IconCopy,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, Permission } from "@/lib/permissions";
import { getShopUsers, updateUser } from "@/lib/usersDB";
import { UserDoc, UserRole, UserStatus } from "@/types";
import ProtectedRoute from "@/components/ProtectedRoute";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import { validatePhoneNumber } from "@/lib/phoneValidation";

export default function UsersPage() {
  const { currentUser, shop } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCountryCode, setInviteCountryCode] = useState("+263");
  const [invitePhoneNumber, setInvitePhoneNumber] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("employee");

  const loadUsers = useCallback(async () => {
    if (!shop) return;

    try {
      setLoading(true);
      const shopUsers = await getShopUsers(shop.shopId);
      setUsers(shopUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    if (shop) {
      loadUsers();
    }
  }, [shop, loadUsers]);

  // Check permissions - moved after all hooks
  if (!currentUser || !hasPermission(currentUser, Permission.VIEW_USERS)) {
    return (
      <ProtectedRoute requireAuth={true} allowedRoles={["owner", "manager"]}>
        <Alert color="red" title="Access Denied">
          You don&apos;t have permission to view this page.
        </Alert>
      </ProtectedRoute>
    );
  }

  const handleInvite = async () => {
    if (!shop || !currentUser) {
      setError("Shop or user information not available");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Validate phone number
      const phoneValidation = validatePhoneNumber(invitePhoneNumber.trim());
      if (!phoneValidation.valid) {
        setError(phoneValidation.error || "Please enter a valid phone number");
        return;
      }

      // Combine country code and phone number
      const fullPhoneNumber = `${inviteCountryCode}${invitePhoneNumber
        .replace(/^0+/, "")
        .replace(/[\s\-\(\)]/g, "")}`;

      // Check if user already exists
      const { getUserByPhoneNumber } = await import("@/lib/usersDB");
      const existingUser = await getUserByPhoneNumber(fullPhoneNumber);
      if (existingUser) {
        setError("User with this phone number already exists");
        return;
      }

      // Create invitation
      const { createInvitation } = await import("@/lib/usersDB");
      const { generateInviteId, generateInviteToken } = await import(
        "@/lib/auth"
      );

      const inviteId = generateInviteId();
      const token = generateInviteToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      await createInvitation({
        inviteId,
        type: "invitation",
        phoneNumber: fullPhoneNumber,
        role: (inviteRole === "owner" ? "manager" : inviteRole) as "manager" | "employee",
        shopId: shop.shopId,
        invitedBy: currentUser.userId,
        token,
        expiresAt: expiresAt.toISOString(),
        status: "pending",
      });

      // Generate shareable invitation link
      const generatedInviteLink = `${window.location.origin}/invite/${token}`;

      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(generatedInviteLink);
      } catch (err) {
        // Clipboard copy failed, but continue anyway
        console.warn("Failed to copy to clipboard:", err);
      }

      // Show success modal
      setInviteLink(generatedInviteLink);
      setError(null);
      setInviteModalOpen(false);
      setSuccessModalOpen(true);
      setInvitePhoneNumber("");
      setInviteCountryCode("+263");
      setInviteRole("employee");
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create invitation"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user: UserDoc) => {
    try {
      const newStatus: UserStatus =
        user.status === "active" ? "suspended" : "active";
      await updateUser({
        ...user,
        status: newStatus,
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case "owner":
        return "blue";
      case "manager":
        return "green";
      case "employee":
        return "gray";
      default:
        return "gray";
    }
  };

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case "active":
        return "green";
      case "suspended":
        return "red";
      case "invited":
        return "yellow";
      default:
        return "gray";
    }
  };

  return (
    <ProtectedRoute requireAuth={true} allowedRoles={["owner", "manager"]}>
      <Stack gap="md" mb="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Box style={{ flex: 1, minWidth: 200 }}>
            <Title order={2} mb="xs">
              User Management
            </Title>
            <Text c="dimmed" size="sm">
              Manage shop users and their permissions
            </Text>
          </Box>
          {hasPermission(currentUser, Permission.INVITE_USERS) && (
            <Button
              leftSection={<IconUserPlus size={16} />}
              onClick={() => setInviteModalOpen(true)}
              fullWidth
            >
              Invite User
            </Button>
          )}
        </Group>
      </Stack>

      {error && (
        <Alert
          color="red"
          title="Error"
          onClose={() => setError(null)}
          withCloseButton
          mb="md"
        >
          {error}
        </Alert>
      )}

      <Paper shadow="sm" p={{ base: "xs", sm: "md" }} withBorder>
        {loading ? (
          <Text ta="center" c="dimmed" py="xl">
            Loading users...
          </Text>
        ) : users.length === 0 ? (
          <Text ta="center" c="dimmed" py="xl">
            No users found. Invite your first team member!
          </Text>
        ) : (
          <>
            {/* Desktop Table View */}
            <Box visibleFrom="sm">
              <ScrollArea>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Phone Number</Table.Th>
                      <Table.Th>Role</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Last Login</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {users.map((user) => (
                      <Table.Tr key={user._id}>
                        <Table.Td>{user.name}</Table.Td>
                        <Table.Td>
                          {user.phoneNumber || user.email || "N/A"}
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={getRoleColor(user.role)}
                            variant="light"
                          >
                            {user.role}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={getStatusColor(user.status)}
                            variant="light"
                          >
                            {user.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleDateString()
                            : "Never"}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            {hasPermission(
                              currentUser,
                              Permission.MANAGE_USERS
                            ) &&
                              user.userId !== currentUser.userId && (
                                <Menu shadow="md" width={200}>
                                  <Menu.Target>
                                    <ActionIcon variant="subtle" color="gray">
                                      <IconEdit size={16} />
                                    </ActionIcon>
                                  </Menu.Target>
                                  <Menu.Dropdown>
                                    <Menu.Label>Actions</Menu.Label>
                                    <Menu.Item
                                      leftSection={
                                        user.status === "active" ? (
                                          <IconX size={16} />
                                        ) : (
                                          <IconCheck size={16} />
                                        )
                                      }
                                      onClick={() => handleToggleStatus(user)}
                                    >
                                      {user.status === "active"
                                        ? "Suspend"
                                        : "Activate"}
                                    </Menu.Item>
                                  </Menu.Dropdown>
                                </Menu>
                              )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Box>

            {/* Mobile Card View */}
            <Box hiddenFrom="sm">
              <Stack gap="md">
                {users.map((user) => (
                  <Card key={user._id} shadow="sm" padding="md" withBorder>
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <Box style={{ flex: 1 }}>
                          <Text fw={600} size="lg" mb={4}>
                            {user.name}
                          </Text>
                          <Text size="sm" c="dimmed" mb="xs">
                            {user.phoneNumber || user.email || "N/A"}
                          </Text>
                        </Box>
                        {hasPermission(currentUser, Permission.MANAGE_USERS) &&
                          user.userId !== currentUser.userId && (
                            <Menu shadow="md" width={200}>
                              <Menu.Target>
                                <ActionIcon variant="subtle" color="gray">
                                  <IconEdit size={18} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Label>Actions</Menu.Label>
                                <Menu.Item
                                  leftSection={
                                    user.status === "active" ? (
                                      <IconX size={16} />
                                    ) : (
                                      <IconCheck size={16} />
                                    )
                                  }
                                  onClick={() => handleToggleStatus(user)}
                                >
                                  {user.status === "active"
                                    ? "Suspend"
                                    : "Activate"}
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          )}
                      </Group>
                      <Divider />
                      <Group gap="md" wrap="wrap">
                        <Box>
                          <Text size="xs" c="dimmed" mb={4}>
                            Role
                          </Text>
                          <Badge
                            color={getRoleColor(user.role)}
                            variant="light"
                          >
                            {user.role}
                          </Badge>
                        </Box>
                        <Box>
                          <Text size="xs" c="dimmed" mb={4}>
                            Status
                          </Text>
                          <Badge
                            color={getStatusColor(user.status)}
                            variant="light"
                          >
                            {user.status}
                          </Badge>
                        </Box>
                        <Box>
                          <Text size="xs" c="dimmed" mb={4}>
                            Last Login
                          </Text>
                          <Text size="sm">
                            {user.lastLoginAt
                              ? new Date(user.lastLoginAt).toLocaleDateString()
                              : "Never"}
                          </Text>
                        </Box>
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Paper>

      {/* Invite User Modal */}
      <Modal
        opened={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setInvitePhoneNumber("");
          setInviteCountryCode("+263");
          setInviteRole("employee");
        }}
        title="Invite User"
        fullScreen
        size="md"
      >
        <Stack gap="md">
          <PhoneNumberInput
            countryCode={inviteCountryCode}
            phoneNumber={invitePhoneNumber}
            onCountryCodeChange={setInviteCountryCode}
            onPhoneNumberChange={(e) =>
              setInvitePhoneNumber(e.currentTarget.value)
            }
            label="Phone Number"
            placeholder="771 802 312"
            required
          />
          <Select
            label="Role"
            value={inviteRole}
            onChange={(value) => setInviteRole(value as UserRole)}
            data={[
              { value: "employee", label: "Employee" },
              { value: "manager", label: "Manager" },
            ]}
            disabled={currentUser?.role !== "owner"}
          />
          <Group justify="flex-end" mt="md" gap="sm">
            <Button
              variant="outline"
              onClick={() => {
                setInviteModalOpen(false);
                setInvitePhoneNumber("");
                setInviteCountryCode("+263");
                setInviteRole("employee");
              }}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              leftSection={<IconUserPlus size={16} />}
              fullWidth
            >
              Send Invitation
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Success Modal */}
      <Modal
        opened={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title={
          <Group>
            <IconCheck size={20} color="green" />
            <Text fw={600}>Invitation Created Successfully</Text>
          </Group>
        }
        centered
        size="lg"
      >
        <Stack gap="md">
          <Alert
            icon={<IconCheck size={16} />}
            title="Invitation Link Ready"
            color="green"
          >
            <Text size="sm">
              The invitation link has been copied to your clipboard. Share this
              link with the user via email, WhatsApp, or any other channel.
            </Text>
          </Alert>

          <Box>
            <Text size="sm" fw={500} mb="xs">
              Invitation Link:
            </Text>
            <Group gap="xs">
              <Textarea
                value={inviteLink}
                readOnly
                minRows={2}
                style={{ flex: 1 }}
                styles={{
                  input: {
                    fontFamily: "monospace",
                    fontSize: "0.875rem",
                  },
                }}
              />
              <CopyButton value={inviteLink}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied!" : "Copy link"}>
                    <ActionIcon
                      color={copied ? "teal" : "gray"}
                      onClick={copy}
                      variant="light"
                      size="lg"
                    >
                      {copied ? (
                        <IconCheck size={18} />
                      ) : (
                        <IconCopy size={18} />
                      )}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Box>

          <Group justify="flex-end" mt="md">
            <Button onClick={() => setSuccessModalOpen(false)}>Done</Button>
          </Group>
        </Stack>
      </Modal>
    </ProtectedRoute>
  );
}
