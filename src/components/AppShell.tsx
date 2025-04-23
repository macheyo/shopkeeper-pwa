"use client";

import React from "react";
import {
  AppShell,
  Group,
  NavLink,
  Title,
  Text,
  Container,
  Divider,
  Box,
} from "@mantine/core";
import {
  IconHome,
  IconPackage,
  IconShoppingCart,
  IconSend,
} from "@tabler/icons-react";
import DateFilter from "./DateFilter";
import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

interface AppShellProps {
  children: React.ReactNode;
}

export default function ShopkeeperAppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  // Status indicator for connection to backend
  const getConnectionStatus = () => {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    return (
      <Text
        size="sm"
        c={isOnline ? "green.7" : "red.7"}
        fw={500}
        style={{
          transition: "color 0.3s ease, transform 0.2s ease",
          animation: isOnline ? "pulse 2s infinite" : "none",
        }}
      >
        {isOnline ? "Connected" : "Offline"}
      </Text>
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
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.05)",
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Title
              order={3}
              c="blue.7"
              style={{
                transition: "transform 0.3s ease",
                "&:hover": {
                  transform: "scale(1.02)",
                },
              }}
            >
              ShopKeeper
            </Title>
          </Group>
          <Group>{getConnectionStatus()}</Group>
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
            label="Products"
            leftSection={
              <IconPackage
                size={24}
                stroke={1.5}
                style={{ transition: "transform 0.2s ease" }}
                className="tabler-icon icon-pulse"
              />
            }
            active={
              pathname === "/products" || pathname.startsWith("/products/")
            }
            href="/products"
            component="a"
            h={60}
            p="md"
            style={{ fontSize: "18px" }}
            styles={{
              root: {
                transition: "all 0.2s ease",
                "&:hover": {
                  transform: "translateX(5px)",
                  backgroundColor: "var(--mantine-color-green-0)",
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
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        {/* Global Date Filter - Fixed position for mobile and desktop */}
        <Box
          style={{
            position: "sticky",
            top: 70, // Below the header
            zIndex: 100,
            width: "100%",
            backgroundColor: "white",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            padding: "12px 16px",
            borderBottom: "1px solid #eee",
            marginBottom: "16px",
            transition: "all 0.3s ease",
            backdropFilter: "blur(10px)",
            background: "rgba(0, 0, 0, 0.95)",
          }}
        >
          <DateFilter />
        </Box>

        <Container size="xl">
          {/* Add padding at the bottom on mobile to account for the bottom nav */}
          <Box pb={{ base: "60px", sm: 0 }}>{children}</Box>
        </Container>

        {/* Bottom navigation for mobile */}
        <BottomNav />
      </AppShell.Main>
    </AppShell>
  );
}
