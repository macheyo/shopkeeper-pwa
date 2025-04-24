"use client";
import { useEffect, useState, useRef } from "react";
import { Button, Modal, Text, Group, Stack, Paper } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
};

// These functions will only be called client-side after hydration
// so we don't need to worry about SSR mismatches

// Check if the app is already installed
const isAppInstalled = () => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    // For iOS Safari
    (window.navigator as { standalone?: boolean }).standalone === true
  );
};

// Check if the user has previously dismissed the prompt
const hasUserDismissedPrompt = () => {
  return localStorage.getItem("pwaPromptDismissed") === "true";
};

// Save user's choice to dismiss the prompt
const saveUserDismissed = () => {
  localStorage.setItem("pwaPromptDismissed", "true");
};

// For debugging - clear the dismissed state
const clearDismissedState = () => {
  localStorage.removeItem("pwaPromptDismissed");
};

// Store the deferred prompt in localStorage for later use
const storeDeferredPrompt = (available: boolean) => {
  localStorage.setItem("pwaPromptAvailable", available ? "true" : "false");
};

// Check if a deferred prompt was previously available
const isDeferredPromptAvailable = () => {
  return localStorage.getItem("pwaPromptAvailable") === "true";
};

interface PWAInstallPromptProps {
  title?: string;
  description?: string;
  installButtonText?: string;
  cancelButtonText?: string;
  debug?: boolean;
}

export default function PWAInstallPrompt({
  title = "Install ShopKeeper",
  description = "Install this app on your home screen for quick access and offline use!",
  installButtonText = "Install Now",
  cancelButtonText = "Not Now",
  debug = false,
}: PWAInstallPromptProps) {
  // Use a ref instead of state since we don't need to re-render on changes
  const nativePromptRef = useRef(false);
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [buttonHovered, setButtonHovered] = useState(false);

  useEffect(() => {
    // This effect will only run client-side after hydration

    // Check if already installed
    setIsInstalled(isAppInstalled());

    // If in debug mode, clear the dismissed state
    if (debug) {
      clearDismissedState();
      console.log("PWA debug mode enabled, cleared dismissed state");

      // In debug mode, always show the install button and custom prompt
      setShowInstallButton(true);
      setTimeout(() => {
        setShowCustomPrompt(true);
      }, 1000);

      return;
    }

    // Don't show prompt if already installed (unless in debug mode)
    if (isAppInstalled() && !debug) {
      console.log("PWA already installed, not showing prompt");
      return;
    }

    // Don't show prompt if dismissed (unless in debug mode)
    if (hasUserDismissedPrompt() && !debug) {
      console.log("PWA prompt was dismissed, not showing prompt again");
      // But we'll still show the install button if the app can be installed
      setShowInstallButton(isDeferredPromptAvailable());
      return;
    }

    console.log("PWA install prompt component initialized");

    const handler = (e: Event) => {
      e.preventDefault();
      const beforeInstallEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(beforeInstallEvent);

      // Store that a deferred prompt is available
      storeDeferredPrompt(true);

      // Show the install button
      setShowInstallButton(true);

      // Only show custom prompt if user hasn't dismissed it before
      if (!hasUserDismissedPrompt() || debug) {
        // Show custom prompt after a short delay
        setTimeout(() => {
          setShowCustomPrompt(true);
        }, 2000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);

    // Also listen for appinstalled event
    const installedHandler = () => {
      setIsInstalled(true);
      nativePromptRef.current = false;
      setShowCustomPrompt(false);
      setShowInstallButton(false);
      setIsInstalling(false);
      storeDeferredPrompt(false);
      console.log("App was installed");
    };

    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handler as EventListener
      );
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, [debug]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Show browser's native prompt
      nativePromptRef.current = true;
      setIsInstalling(true);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        console.log("User accepted the install prompt");
        setIsInstalled(true);
        setShowInstallButton(false);
        storeDeferredPrompt(false);
      } else {
        console.log("User dismissed the install prompt");
      }
      nativePromptRef.current = false;
      setIsInstalling(false);
      setShowCustomPrompt(false);
      setDeferredPrompt(null);
    } else if (debug) {
      // In debug mode, simulate the install process
      console.log("Debug mode: Simulating install process");
      setIsInstalling(true);

      // Simulate a delay
      setTimeout(() => {
        setIsInstalling(false);
        setShowCustomPrompt(false);
        // Don't set isInstalled to true in debug mode so we can test again
      }, 2000);
    }
  };

  const handleDismiss = () => {
    setShowCustomPrompt(false);
    saveUserDismissed();

    // Show the floating install button if the app can be installed
    if (deferredPrompt) {
      setShowInstallButton(true);
    }
  };

  // Force show the custom prompt in debug mode
  useEffect(() => {
    if (debug && !showCustomPrompt && !isInstalled) {
      setShowCustomPrompt(true);
      setShowInstallButton(true);
    }
  }, [debug, showCustomPrompt, isInstalled]);

  // Handle scroll behavior for the install button
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Check if we're at the bottom of the page
      const isAtBottom = currentScrollY + windowHeight >= documentHeight - 10;

      if (isAtBottom) {
        // Hide button when at the bottom of the page
        setButtonVisible(false);
      }
      // Show button when scrolling up or at the top
      else if (currentScrollY <= 10 || currentScrollY < lastScrollY) {
        setButtonVisible(true);
      }
      // Hide button when scrolling down and not at the top
      else if (currentScrollY > lastScrollY && currentScrollY > 10) {
        setButtonVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Custom prompt UI
  return (
    <>
      {/* Native browser prompt is handled by the browser */}

      {/* Custom prompt */}
      <Modal
        opened={showCustomPrompt}
        onClose={handleDismiss}
        title={title}
        centered
        size="sm"
        classNames={{
          title: "modal-title",
          content: "modal-content",
          header: "modal-header",
        }}
      >
        <Stack>
          <Text
            size="md"
            style={{
              animation: "fadeIn 0.5s ease-out",
            }}
          >
            {description}
          </Text>

          <Paper
            withBorder
            p="md"
            radius="md"
            style={{
              backgroundColor: "var(--mantine-color-default)",
              animation: "slideIn 0.5s ease-out",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
            className="animated-paper"
          >
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Benefits:
              </Text>
              <Text
                size="sm"
                style={{
                  animation: "slideInFromRight 0.5s ease-out 0.1s both",
                  opacity: 0,
                }}
              >
                • Works offline
              </Text>
              <Text
                size="sm"
                style={{
                  animation: "slideInFromRight 0.5s ease-out 0.2s both",
                  opacity: 0,
                }}
              >
                • Faster loading times
              </Text>
              <Text
                size="sm"
                style={{
                  animation: "slideInFromRight 0.5s ease-out 0.3s both",
                  opacity: 0,
                }}
              >
                • Home screen icon
              </Text>
            </Stack>
          </Paper>

          <Group mt="md">
            <Button
              variant="outline"
              onClick={handleDismiss}
              flex={1}
              style={{
                transition: "all 0.2s ease",
              }}
              className="animated-button"
            >
              {cancelButtonText}
            </Button>
            <Button
              onClick={handleInstall}
              flex={1}
              loading={isInstalling}
              style={{
                transition: "all 0.2s ease",
              }}
              className="animated-button primary"
              leftSection={
                <IconDownload size={16} className="tabler-icon icon-bounce" />
              }
            >
              {installButtonText}
            </Button>
          </Group>

          {debug && (
            <Text size="xs" c="dimmed" ta="center" mt="sm">
              Debug mode enabled
            </Text>
          )}
        </Stack>
      </Modal>

      {/* Persistent install button that shows even after dismissal */}
      {showInstallButton && !isInstalled && !showCustomPrompt && (
        <div
          style={{
            position: "fixed",
            bottom: buttonVisible ? "70px" : "-100px", // Hide below viewport when not visible
            right: "20px",
            zIndex: 1001, // Higher than the navbar's z-index
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
            opacity: buttonVisible ? 1 : 0,
            transform: buttonHovered ? "scale(1.05)" : "scale(1)",
          }}
        >
          <Button
            leftSection={
              <IconDownload
                size={20}
                style={{
                  transition: "transform 0.3s ease",
                  animation: buttonHovered ? "pulse 1.5s infinite" : "none",
                }}
                className="tabler-icon icon-bounce"
              />
            }
            variant="filled"
            color="blue"
            radius="xl"
            onClick={handleInstall}
            title="Install app"
            style={{
              boxShadow: buttonHovered
                ? "var(--mantine-shadow-md)"
                : "var(--mantine-shadow-sm)",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => setButtonHovered(false)}
            className="install-button"
          >
            Install App
          </Button>
        </div>
      )}

      {/* Add CSS animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }

        .modal-title {
          font-weight: 700;
          transition: color 0.2s ease;
        }

        .modal-header {
          transition: background-color 0.3s ease;
        }

        .modal-content {
          animation: fadeIn 0.3s ease-out;
        }

        .animated-paper {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .animated-paper:hover {
          transform: translateY(-3px);
          box-shadow: var(--mantine-shadow-sm);
        }

        .animated-button {
          transition: all 0.2s ease !important;
        }

        .animated-button:hover {
          transform: translateY(-2px) !important;
          box-shadow: var(--mantine-shadow-sm) !important;
        }

        .animated-button:active {
          transform: translateY(0) !important;
        }

        .animated-button.primary:hover {
          box-shadow: var(--mantine-shadow-md) !important;
        }

        .install-button {
          transition: all 0.3s ease !important;
        }

        .install-button:hover {
          transform: translateY(-3px) !important;
        }

        .install-button:active {
          transform: translateY(-1px) !important;
        }
      `}</style>
    </>
  );
}
