"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Container,
  Group,
  Stack,
  Text,
  Title,
  Badge,
  SimpleGrid,
  rem,
  ThemeIcon,
  Paper,
} from "@mantine/core";
import {
  IconDownload,
  IconPackage,
  IconShoppingCart,
  IconChartBar,
  IconCloudUpload,
  IconPlus,
  IconShare,
  IconWifi,
  IconWifiOff,
} from "@tabler/icons-react";

// BeforeInstallPromptEvent type definition
type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
};

export default function Home() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<"synced" | "pending" | "error">(
    "synced"
  );

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;

      setIsInstalled(isStandalone);
    };

    checkInstalled();

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log("PWA was installed");
    };

    // Listen for online/offline events
    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        // When coming back online, set sync status to pending
        // In a real app, you would trigger a sync here
        setSyncStatus("pending");
        setTimeout(() => setSyncStatus("synced"), 2000); // Simulate sync completion
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnlineStatus);
    window.addEventListener("offline", handleOnlineStatus);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnlineStatus);
      window.removeEventListener("offline", handleOnlineStatus);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
      setIsInstalled(true);
    } else {
      console.log("User dismissed the install prompt");
    }

    // Clear the saved prompt as it can't be used again
    setDeferredPrompt(null);
  };

  // Mock data for dashboard
  const stats = [
    { label: "Products", value: "124", icon: IconPackage, color: "green" },
    {
      label: "Sales Today",
      value: "12",
      icon: IconShoppingCart,
      color: "blue",
    },
    { label: "Revenue", value: "$1,240", icon: IconChartBar, color: "violet" },
  ];

  return (
    <Container size="md" py="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2}>ShopKeeper Dashboard</Title>
          <Badge
            color={isOnline ? "green" : "red"}
            leftSection={
              isOnline ? <IconWifi size={12} /> : <IconWifiOff size={12} />
            }
          >
            {isOnline ? "Online" : "Offline"}
          </Badge>
        </Group>

        {syncStatus === "pending" && (
          <Paper withBorder p="xs" bg="yellow.0">
            <Group>
              <IconCloudUpload size={16} />
              <Text size="sm">Syncing data with server...</Text>
            </Group>
          </Paper>
        )}

        {!isInstalled && (
          <Card withBorder p="md" radius="md" bg="blue.0">
            <Stack gap="md">
              <Text fw={500} size="lg">
                Install ShopKeeper on your device
              </Text>
              <Text size="sm">
                Install this app on your home screen for quick access and
                offline use!
              </Text>
              <Group justify="flex-end">
                <Button
                  leftSection={<IconDownload size={20} />}
                  onClick={handleInstall}
                  disabled={!deferredPrompt}
                >
                  Install Now
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        {/* Stats Cards */}
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
          {stats.map((stat) => (
            <Card key={stat.label} withBorder p="md" radius="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="xs" c="dimmed">
                    {stat.label}
                  </Text>
                  <Text fw={700} size="xl">
                    {stat.value}
                  </Text>
                </div>
                <ThemeIcon
                  color={stat.color}
                  variant="light"
                  size="lg"
                  radius="md"
                >
                  <stat.icon style={{ width: rem(20), height: rem(20) }} />
                </ThemeIcon>
              </Group>
            </Card>
          ))}
        </SimpleGrid>

        {/* Quick Actions */}
        <Card withBorder shadow="sm" p="lg" radius="md">
          <Stack gap="md">
            <Text fw={500} size="lg">
              Quick Actions
            </Text>

            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
              <Button
                component="a"
                href="/sales/new"
                leftSection={<IconPlus size={20} />}
                variant="filled"
                color="blue"
                fullWidth
              >
                New Sale
              </Button>

              <Button
                component="a"
                href="/products/add"
                leftSection={<IconPlus size={20} />}
                variant="filled"
                color="green"
                fullWidth
              >
                Add Product
              </Button>

              <Button
                component="a"
                href="/reports"
                leftSection={<IconChartBar size={20} />}
                variant="outline"
                fullWidth
              >
                View Reports
              </Button>

              <Button
                component="a"
                href="#"
                leftSection={<IconShare size={20} />}
                variant="outline"
                fullWidth
                onClick={(e) => {
                  e.preventDefault();
                  if (navigator.share) {
                    navigator.share({
                      title: "ShopKeeper Reports",
                      text: "Check out my shop reports",
                      url: window.location.origin + "/reports",
                    });
                  }
                }}
              >
                Share Reports
              </Button>
            </SimpleGrid>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
