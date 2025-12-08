"use client";

import React, { useState, useEffect } from "react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, Permission } from "@/lib/permissions";
import {
  AppShell,
  Group,
  NavLink,
  Title,
  Text,
  Container,
  Divider,
  Box,
  Tooltip,
  ActionIcon,
  Menu,
  Badge,
  Button,
} from "@mantine/core";
import {
  IconHome,
  IconShoppingCart,
  IconSend,
  IconShoppingBag,
  IconRefresh,
  IconBrandWhatsapp,
  IconCloud,
  IconUser,
  IconLogout,
  IconUsers,
} from "@tabler/icons-react";
import { usePathname, useRouter } from "next/navigation";
import BottomNav from "./BottomNav";
import DateFilter from "./DateFilter";
import EODBlockingModal from "./EODBlockingModal";
import { checkTradingDayStatus, TradingDayStatus } from "@/lib/tradingDay";

interface AppShellProps {
  children: React.ReactNode;
}

export default function ShopkeeperAppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasCompletedOnboarding } = useOnboarding();
  const { currentUser, shop, logout, isAuthenticated } = useAuth();

  // Check CouchDB sync status - MUST be before any conditional returns
  const [couchdbStatus, setCouchdbStatus] = useState<{
    enabled: boolean;
    available: boolean;
  }>({ enabled: false, available: false });

  useEffect(() => {
    const checkCouchdbStatus = async () => {
      if (!shop) return;

      try {
        const { getCouchDBConfig, isCouchDBSyncEnabled } = await import(
          "@/lib/couchdbConfig"
        );
        const config = await getCouchDBConfig(shop.shopId);
        const enabled = await isCouchDBSyncEnabled(shop.shopId);

        setCouchdbStatus({
          enabled: enabled && !!config,
          available: !!config,
        });
      } catch (err) {
        console.error("Error checking CouchDB status:", err);
        setCouchdbStatus({ enabled: false, available: false });
      }
    };

    checkCouchdbStatus();

    // Only check periodically when tab is visible (reduced frequency)
    let interval: NodeJS.Timeout | null = null;
    
    const startPolling = () => {
      if (!interval) {
        interval = setInterval(checkCouchdbStatus, 30000); // 30 seconds instead of 5
      }
    };
    
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    
    // Start polling only if visible
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      startPolling();
    }
    
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        checkCouchdbStatus(); // Immediate check when visible
        startPolling();
      } else {
        stopPolling();
      }
    };
    
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", visibilityHandler);
    }
    
    return () => {
      stopPolling();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    };
  }, [shop]);

  // Trading day enforcement - check if previous day EOD is completed
  const [tradingDayStatus, setTradingDayStatus] = useState<TradingDayStatus>({
    canTrade: true,
    blocked: false,
  });

  useEffect(() => {
    const checkTradingDay = async () => {
      if (!isAuthenticated || !shop || !currentUser) return;

      // Check for all users (employees, managers, and owners)
      try {
        const status = await checkTradingDayStatus(
          currentUser.userId,
          shop.shopId
        );
        setTradingDayStatus(status);
      } catch (error) {
        console.error("Error checking trading day status:", error);
        // Fail open - allow trading on error
        setTradingDayStatus({ canTrade: true, blocked: false });
      }
    };

    checkTradingDay();
  }, [isAuthenticated, shop, currentUser]);

  // Public routes that don't need the full app shell
  const publicRoutes = ["/login", "/register"];
  const isPublicRoute =
    publicRoutes.includes(pathname) || pathname.startsWith("/invite/");

  // Routes that don't require EOD completion
  const eodExemptRoutes = ["/eod", "/profile", "/sync"];
  const requiresEODCheck =
    currentUser &&
    !eodExemptRoutes.includes(pathname) &&
    !pathname.startsWith("/eod") &&
    hasCompletedOnboarding;

  // For public routes, render children without the shell
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Status indicators for WhatsApp and CouchDB sync
  const getConnectionStatus = () => {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    // TODO: Implement actual WhatsApp connection check
    const whatsAppStatus = isOnline;

    return (
      <Group gap="sm">
        <Tooltip
          label={`WhatsApp: ${whatsAppStatus ? "Connected" : "Offline"}`}
        >
          <ActionIcon
            variant="light"
            color={whatsAppStatus ? "green" : "red"}
            size="md"
            style={{
              transition: "all 0.3s ease",
              animation: whatsAppStatus ? "pulse 2s infinite" : "none",
            }}
          >
            <IconBrandWhatsapp
              size={18}
              style={{ opacity: whatsAppStatus ? 1 : 0.5 }}
            />
          </ActionIcon>
        </Tooltip>
        <Tooltip
          label={
            couchdbStatus.enabled
              ? "CouchDB Sync: Enabled"
              : couchdbStatus.available
              ? "CouchDB Sync: Available (not enabled)"
              : "CouchDB Sync: Not configured"
          }
        >
          <ActionIcon
            variant="light"
            color={
              couchdbStatus.enabled
                ? "green"
                : couchdbStatus.available
                ? "yellow"
                : "gray"
            }
            size="md"
            style={{
              transition: "all 0.3s ease",
              animation: couchdbStatus.enabled ? "pulse 2s infinite" : "none",
            }}
            onClick={() => {
              if (couchdbStatus.available && !couchdbStatus.enabled) {
                router.push("/sync?tab=config");
              }
            }}
          >
            <IconCloud
              size={18}
              style={{
                opacity: couchdbStatus.enabled
                  ? 1
                  : couchdbStatus.available
                  ? 0.7
                  : 0.5,
              }}
            />
          </ActionIcon>
        </Tooltip>
      </Group>
    );
  };

  return (
    <AppShell
      header={{ height: 70 }}
      navbar={{
        width: 280,
        breakpoint: "sm",
        collapsed: { mobile: true }, // Always collapse on mobile since we're using bottom nav
      }}
      padding="md"
      styles={{
        header: {
          transition: "box-shadow 0.3s ease",
          boxShadow: "var(--mantine-shadow-sm)",
          backgroundColor: "var(--mantine-color-body)",
        },
        main: {
          backgroundColor: "var(--mantine-color-gray-0)",
        },
        navbar: {
          backgroundColor: "var(--mantine-color-body)",
        },
      }}
    >
      <AppShell.Header>
        <Group
          h="100%"
          px={{ base: "xs", sm: "md" }}
          justify="space-between"
          wrap="nowrap"
        >
          <Box style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <Title
              order={3}
              c="blue.7"
              style={{
                transition: "transform 0.3s ease",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {shop?.shopName || "ShopKeeper"}
            </Title>
          </Box>
          <Group gap="md" wrap="nowrap">
            {isAuthenticated && currentUser && (
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    variant="subtle"
                    leftSection={<IconUser size={16} />}
                    rightSection={
                      <Badge size="sm" color="blue" variant="light">
                        {currentUser.role}
                      </Badge>
                    }
                    px={{ base: "xs", sm: "sm" }}
                    style={{ overflow: "hidden" }}
                  >
                    <Text
                      size="sm"
                      visibleFrom="sm"
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 120,
                      }}
                    >
                      {currentUser.name}
                    </Text>
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Account</Menu.Label>
                  <Menu.Item leftSection={<IconUser size={16} />}>
                    <Text size="sm" fw={500}>
                      {currentUser.name}
                    </Text>
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconUser size={16} />}
                    onClick={() => router.push("/profile")}
                  >
                    Profile
                  </Menu.Item>
                  {(currentUser.role === "owner" ||
                    currentUser.role === "manager") && (
                    <Menu.Item
                      leftSection={<IconUsers size={16} />}
                      onClick={() => router.push("/users")}
                    >
                      Manage Users
                    </Menu.Item>
                  )}
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout size={16} />}
                    onClick={logout}
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
            {getConnectionStatus()}
          </Group>
        </Group>
        {/* Header DateFilter removed and moved below */}
      </AppShell.Header>

      {/* Side navigation for desktop */}
      <AppShell.Navbar p="md" visibleFrom="sm">
        <AppShell.Section>
          <Text fw={700} size="lg" c="blue.7" mb="xs" ta="center">
            MENU
          </Text>
        </AppShell.Section>
        <Divider mb="md" />

        <AppShell.Section grow>
          <NavLink
            label="Home"
            leftSection={
              <IconHome
                size={24}
                stroke={1.5}
                style={{ transition: "transform 0.2s ease" }}
                className="tabler-icon icon-bounce"
              />
            }
            active={pathname === "/"}
            href="/"
            component="a"
            h={60}
            p="md"
            style={{ fontSize: "18px" }}
            styles={{
              root: {
                transition: "all 0.2s ease",
                "&:hover": {
                  transform: "translateX(5px)",
                  backgroundColor: "var(--mantine-color-blue-0)",
                },
              },
              label: {
                transition: "transform 0.2s ease",
              },
            }}
          />
          <NavLink
            label="Sales"
            leftSection={
              <IconShoppingCart
                size={24}
                stroke={1.5}
                style={{ transition: "transform 0.2s ease" }}
                className="tabler-icon icon-wiggle"
              />
            }
            active={pathname === "/sales" || pathname.startsWith("/sales/")}
            href="/sales"
            component="a"
            h={60}
            p="md"
            style={{ fontSize: "18px" }}
            styles={{
              root: {
                transition: "all 0.2s ease",
                "&:hover": {
                  transform: "translateX(5px)",
                  backgroundColor: "var(--mantine-color-blue-0)",
                },
              },
              label: {
                transition: "transform 0.2s ease",
              },
            }}
          />
          <NavLink
            label="Purchases"
            leftSection={
              <IconShoppingBag
                size={24}
                stroke={1.5}
                style={{ transition: "transform 0.2s ease" }}
                className="tabler-icon icon-bounce"
              />
            }
            active={
              pathname === "/purchases" || pathname.startsWith("/purchases/")
            }
            href="/purchases"
            component="a"
            h={60}
            p="md"
            style={{ fontSize: "18px" }}
            styles={{
              root: {
                transition: "all 0.2s ease",
                "&:hover": {
                  transform: "translateX(5px)",
                  backgroundColor: "var(--mantine-color-teal-0)",
                },
              },
              label: {
                transition: "transform 0.2s ease",
              },
            }}
          />
          {hasPermission(currentUser, Permission.VIEW_REPORTS) && (
            <NavLink
              label="Reports"
              leftSection={
                <IconSend
                  size={24}
                  stroke={1.5}
                  style={{ transition: "transform 0.2s ease" }}
                  className="tabler-icon icon-spin"
                />
              }
              active={pathname === "/reports"}
              href="/reports"
              component="a"
              h={60}
              p="md"
              style={{ fontSize: "18px" }}
              styles={{
                root: {
                  transition: "all 0.2s ease",
                  "&:hover": {
                    transform: "translateX(5px)",
                    backgroundColor: "var(--mantine-color-violet-0)",
                  },
                },
                label: {
                  transition: "transform 0.2s ease",
                },
              }}
            />
          )}
          {hasPermission(currentUser, Permission.VIEW_USERS) && (
            <NavLink
              label="Users"
              leftSection={
                <IconUsers
                  size={24}
                  stroke={1.5}
                  style={{ transition: "transform 0.2s ease" }}
                  className="tabler-icon icon-bounce"
                />
              }
              active={pathname === "/users" || pathname.startsWith("/users/")}
              href="/users"
              component="a"
              h={60}
              p="md"
              style={{ fontSize: "18px" }}
              styles={{
                root: {
                  transition: "all 0.2s ease",
                  "&:hover": {
                    transform: "translateX(5px)",
                    backgroundColor: "var(--mantine-color-orange-0)",
                  },
                },
                label: {
                  transition: "transform 0.2s ease",
                },
              }}
            />
          )}
          <NavLink
            label="Sync"
            leftSection={
              <IconRefresh
                size={24}
                stroke={1.5}
                style={{ transition: "transform 0.2s ease" }}
                className="tabler-icon icon-bounce"
              />
            }
            active={pathname === "/sync"}
            href="/sync"
            component="a"
            h={60}
            p="md"
            style={{ fontSize: "18px" }}
            styles={{
              root: {
                transition: "all 0.2s ease",
                "&:hover": {
                  transform: "translateX(5px)",
                  backgroundColor: "var(--mantine-color-cyan-0)",
                },
              },
              label: {
                transition: "transform 0.2s ease",
              },
            }}
          />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        {/* Global Date Filter - Fixed position for mobile and desktop, hidden during onboarding */}
        {hasCompletedOnboarding && (
          <Box
            style={{
              position: "sticky",
              top: 70, // Below the header
              zIndex: 100,
              width: "100%",
              backgroundColor: "rgba(248, 249, 250, 0.95)", // Semi-transparent to blend
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              padding: "12px 16px",
              borderBottom: "1px solid var(--mantine-color-gray-2)",
              marginBottom: "16px",
              transition: "all 0.3s ease",
              backdropFilter: "blur(8px)",
            }}
          >
            <DateFilter />
          </Box>
        )}

        <Container size="xl">
          {/* Add padding at the bottom on mobile to account for the bottom nav */}
          <Box pb={{ base: "60px", sm: 0 }}>{children}</Box>
        </Container>

        {/* Bottom navigation for mobile, hidden during onboarding */}
        {hasCompletedOnboarding && <BottomNav />}

        {/* EOD Blocking Modal for employees */}
        {requiresEODCheck && tradingDayStatus.blocked && (
          <EODBlockingModal
            opened={tradingDayStatus.blocked}
            status={tradingDayStatus}
          />
        )}
      </AppShell.Main>
    </AppShell>
  );
}
