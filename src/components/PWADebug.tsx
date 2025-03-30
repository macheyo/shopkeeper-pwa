"use client";
import { useEffect, useState } from "react";
import { Button, Card, Text, Stack, Group, Badge } from "@mantine/core";

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
};

export default function PWADebug() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState("unknown");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    // Use a stable timestamp format for server rendering
    // and update with client-side time after hydration
    const timestamp =
      typeof window === "undefined"
        ? "00:00:00" // Placeholder for SSR
        : new Date().toLocaleTimeString();

    setLogs((prev) => [...prev, `${timestamp}: ${message}`]);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if app is in standalone mode
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    setIsStandalone(standalone);

    // Small delay to ensure this happens after hydration
    setTimeout(() => {
      addLog(`App is ${standalone ? "in standalone mode" : "in browser mode"}`);
    }, 0);

    // Check service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length > 0) {
          setServiceWorkerStatus(`registered (${registrations.length})`);
          addLog(
            `Service worker registered (${registrations.length} registrations)`
          );
        } else {
          setServiceWorkerStatus("not registered");
          addLog("No service worker registrations found");
        }
      });
    } else {
      setServiceWorkerStatus("not supported");
      addLog("Service worker not supported");
    }

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      const beforeInstallEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(beforeInstallEvent);
      addLog("beforeinstallprompt event fired");
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);

    // Listen for appinstalled event
    const installedHandler = () => {
      setIsInstalled(true);
      addLog("App was installed (appinstalled event)");
    };

    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handler as EventListener
      );
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      addLog("Triggering installation prompt");
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      addLog(`User ${outcome} the install prompt`);
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      addLog("No deferred prompt available");
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleCheckManifest = async () => {
    try {
      const response = await fetch("/manifest.json");
      if (response.ok) {
        const manifest = await response.json();
        addLog(`Manifest found: ${JSON.stringify(manifest.name)}`);
      } else {
        addLog(`Manifest fetch failed: ${response.status}`);
      }
    } catch (error) {
      addLog(`Manifest error: ${error}`);
    }
  };

  const handleUnregisterSW = async () => {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        addLog(`Unregistered service worker: ${registration.scope}`);
      }
      setServiceWorkerStatus("not registered");
    }
  };

  return (
    <Card withBorder shadow="sm" p="md" radius="md" mt="xl">
      <Text fw={700} size="lg" mb="md">
        PWA Debug Panel
      </Text>

      <Stack gap="xs">
        <Group>
          <Text fw={500}>Installation Status:</Text>
          <Badge color={isInstalled || isStandalone ? "green" : "yellow"}>
            {isInstalled
              ? "Installed"
              : isStandalone
              ? "Standalone"
              : "Not Installed"}
          </Badge>
        </Group>

        <Group>
          <Text fw={500}>Install Prompt:</Text>
          <Badge color={deferredPrompt ? "green" : "red"}>
            {deferredPrompt ? "Available" : "Not Available"}
          </Badge>
        </Group>

        <Group>
          <Text fw={500}>Service Worker:</Text>
          <Badge
            color={
              serviceWorkerStatus === "registered"
                ? "green"
                : serviceWorkerStatus === "not registered"
                ? "red"
                : "yellow"
            }
          >
            {serviceWorkerStatus}
          </Badge>
        </Group>

        <Group mt="md">
          <Button
            onClick={handleInstall}
            disabled={!deferredPrompt}
            variant="filled"
          >
            Trigger Install
          </Button>
          <Button onClick={handleCheckManifest} variant="outline">
            Check Manifest
          </Button>
          <Button onClick={handleUnregisterSW} variant="outline" color="red">
            Unregister SW
          </Button>
          <Button onClick={handleClearLogs} variant="subtle">
            Clear Logs
          </Button>
        </Group>

        <Text fw={500} mt="md">
          Debug Logs:
        </Text>
        <Card
          withBorder
          p="xs"
          bg="gray.0"
          style={{ maxHeight: "200px", overflow: "auto" }}
        >
          {logs.length === 0 ? (
            <Text c="dimmed" size="sm">
              No logs yet
            </Text>
          ) : (
            logs.map((log, index) => (
              <Text key={index} size="xs" mb={4}>
                {log}
              </Text>
            ))
          )}
        </Card>
      </Stack>
    </Card>
  );
}
