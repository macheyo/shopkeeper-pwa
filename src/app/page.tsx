"use client";

import { useEffect, useState, useCallback } from "react";
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
  Progress,
  Modal,
  NumberInput,
  ActionIcon,
  Tooltip,
  Table,
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
  IconTarget,
  IconTrophy,
  IconHistory,
  IconCheck,
  IconX,
} from "@tabler/icons-react";

import { useRouter } from "next/navigation";
import { getProductsDB, getSalesDB } from "@/lib/databases";
import { SaleDoc } from "@/types";
import {
  formatMoney,
  createMoney,
  BASE_CURRENCY,
  Money,
  CurrencyCode,
} from "@/types/money";
import { useDateFilter } from "@/contexts/DateFilterContext";

// BeforeInstallPromptEvent type definition
type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
};

// Interface for sales target
interface SalesTarget {
  amount: number;
  currency: string;
  date: string;
  achieved: boolean;
}

export default function Home() {
  const router = useRouter();
  const { dateRangeInfo } = useDateFilter();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<"synced" | "pending" | "error">(
    "synced"
  );

  // State for actual data
  const [productCount, setProductCount] = useState<number>(0);
  const [salesCount, setSalesCount] = useState<number>(0);
  const [revenue, setRevenue] = useState<Money | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // State for sales target
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [targetAmount, setTargetAmount] = useState<number>(0);
  const [currentTarget, setCurrentTarget] = useState<SalesTarget | null>(null);
  const [targetHistory, setTargetHistory] = useState<SalesTarget[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // Function to fetch data for dashboard
  const fetchDashboardData = useCallback(async () => {
    if (typeof window === "undefined") return;

    setLoading(true);
    try {
      // Get product count
      const productsDB = await getProductsDB();
      const productsResult = await productsDB.find({
        selector: { type: "product" },
      });
      setProductCount(productsResult.docs.length);

      // Get sales for the selected date range
      const startDateISOString = dateRangeInfo.startDate.toISOString();
      const endDateISOString = dateRangeInfo.endDate.toISOString();

      const salesDB = await getSalesDB();

      // Get all documents
      const result = await salesDB.allDocs({
        include_docs: true,
      });

      // Filter for sales documents within the selected date range
      const filteredSales = result.rows
        .map((row) => row.doc)
        .filter((doc): doc is SaleDoc => {
          // Make sure it's a sale document with a timestamp
          if (
            !doc ||
            typeof doc !== "object" ||
            !("type" in doc) ||
            doc.type !== "sale" ||
            !("timestamp" in doc)
          ) {
            return false;
          }

          // Check if it's within the date range
          const docDate = new Date(doc.timestamp as string);
          return (
            docDate >= new Date(startDateISOString) &&
            docDate < new Date(endDateISOString)
          );
        });

      setSalesCount(filteredSales.length);

      // Calculate total revenue
      if (filteredSales.length > 0) {
        let totalAmount = 0;
        const currency = BASE_CURRENCY;
        const exchangeRate = 1;

        // Sum up all sales and convert to base currency
        filteredSales.forEach((sale) => {
          if (sale.totalAmount.currency === BASE_CURRENCY) {
            totalAmount += sale.totalAmount.amount;
          } else {
            // Convert to base currency
            const valueInBaseCurrency =
              sale.totalAmount.amount / sale.totalAmount.exchangeRate;
            totalAmount += valueInBaseCurrency;
          }
        });

        setRevenue({
          amount: totalAmount,
          currency,
          exchangeRate,
        });

        // Check if we've met the target
        checkTargetAchievement(totalAmount);
      } else {
        setRevenue(createMoney(0));
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRangeInfo]); // Re-fetch when date range changes

  // Function to load sales target from localStorage
  const loadSalesTarget = useCallback(() => {
    if (typeof window === "undefined") return;

    // Load current target
    const targetJson = localStorage.getItem("currentSalesTarget");
    if (targetJson) {
      const target = JSON.parse(targetJson) as SalesTarget;

      // Check if target is for today
      const today = new Date().toISOString().split("T")[0];
      if (target.date === today) {
        setCurrentTarget(target);
      } else {
        // If target is from a previous day, move it to history
        saveTargetToHistory(target);
        setCurrentTarget(null);
        localStorage.removeItem("currentSalesTarget");
      }
    }

    // Load target history
    const historyJson = localStorage.getItem("salesTargetHistory");
    if (historyJson) {
      setTargetHistory(JSON.parse(historyJson));
    }

    // Check if we should prompt for a new target
    const lastPrompt = localStorage.getItem("lastTargetPrompt");
    const today = new Date().toISOString().split("T")[0];

    if (!targetJson && (!lastPrompt || lastPrompt !== today)) {
      // Only show the prompt if we don't have a target for today
      // and we haven't prompted today
      setTimeout(() => {
        setShowTargetModal(true);
        localStorage.setItem("lastTargetPrompt", today);
      }, 1000);
    }
  }, []);

  // Function to save target to history
  const saveTargetToHistory = (target: SalesTarget) => {
    const updatedHistory = [target, ...targetHistory].slice(0, 30); // Keep last 30 days
    setTargetHistory(updatedHistory);
    localStorage.setItem("salesTargetHistory", JSON.stringify(updatedHistory));
  };

  // Function to check if target is achieved
  const checkTargetAchievement = (totalAmount: number) => {
    if (!currentTarget) return;

    if (totalAmount >= currentTarget.amount && !currentTarget.achieved) {
      // Target achieved!
      const updatedTarget = {
        ...currentTarget,
        achieved: true,
      };
      setCurrentTarget(updatedTarget);
      localStorage.setItem("currentSalesTarget", JSON.stringify(updatedTarget));

      // Show celebration
      setShowCelebration(true);
    }
  };

  // Function to set a new sales target
  const setNewTarget = () => {
    if (targetAmount <= 0) return;

    const today = new Date().toISOString().split("T")[0];
    const newTarget: SalesTarget = {
      amount: targetAmount,
      currency: BASE_CURRENCY,
      date: today,
      achieved: false,
    };

    setCurrentTarget(newTarget);
    localStorage.setItem("currentSalesTarget", JSON.stringify(newTarget));
    setShowTargetModal(false);
    // Reset target amount for next time
    setTargetAmount(0);
  };

  // Add a state to track if the context is ready
  const [isContextReady, setIsContextReady] = useState(false);

  // Add an effect to check when the context is ready
  useEffect(() => {
    // If we have dateRangeInfo with valid dates, the context is ready
    if (dateRangeInfo && dateRangeInfo.startDate && dateRangeInfo.endDate) {
      setIsContextReady(true);
    }
  }, [dateRangeInfo]);

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") {
      return () => {}; // Return empty cleanup function if window is undefined
    }

    // Fetch dashboard data only when context is ready
    if (isContextReady) {
      fetchDashboardData();
      loadSalesTarget();
    }

    // Set up interval to refresh data every minute, but only when context is ready
    let intervalId: NodeJS.Timeout | undefined = undefined;
    if (isContextReady) {
      intervalId = setInterval(fetchDashboardData, 60000);
    }

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

    // Add event listeners
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnlineStatus);
    window.addEventListener("offline", handleOnlineStatus);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnlineStatus);
      window.removeEventListener("offline", handleOnlineStatus);
    };
  }, [fetchDashboardData, loadSalesTarget]);

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

  // Prepare stats data with actual values
  const stats = [
    {
      label: "Products",
      value: loading ? "..." : productCount.toString(),
      icon: IconPackage,
      color: "green",
      path: "/products",
    },
    {
      label: `Sales (${dateRangeInfo.label})`,
      value: loading ? "..." : salesCount.toString(),
      icon: IconShoppingCart,
      color: "blue",
      path: "/sales",
    },
    {
      label: `Revenue (${dateRangeInfo.label})`,
      value: loading ? "..." : revenue ? formatMoney(revenue) : "$0.00",
      icon: IconChartBar,
      color: "violet",
      path: "/reports",
    },
  ];

  // Render the target history table
  const renderTargetHistory = () => {
    if (targetHistory.length === 0) {
      return (
        <Text ta="center" py="xl" c="dimmed">
          No previous targets found
        </Text>
      );
    }

    return (
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Target</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {targetHistory.map((target, index) => (
            <Table.Tr key={index}>
              <Table.Td>{new Date(target.date).toLocaleDateString()}</Table.Td>
              <Table.Td>
                {formatMoney(
                  createMoney(target.amount, target.currency as CurrencyCode)
                )}
              </Table.Td>
              <Table.Td>
                {target.achieved ? (
                  <Badge color="green" leftSection={<IconCheck size={14} />}>
                    Achieved
                  </Badge>
                ) : (
                  <Badge color="red" leftSection={<IconX size={14} />}>
                    Not Achieved
                  </Badge>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  return (
    <div>
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
              <Card
                key={stat.label}
                withBorder
                p="md"
                radius="md"
                style={{
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                className="hover-card"
                onClick={() => router.push(stat.path)}
              >
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

          {/* Sales Target Card */}
          {currentTarget && (
            <Card withBorder p="md" radius="md" mb="md">
              <Group justify="space-between" align="flex-start" mb="xs">
                <div>
                  <Group align="center">
                    <Text fw={500} size="lg">
                      Today&apos;s Sales Target
                    </Text>
                    <Tooltip label="View target history">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => setShowHistoryModal(true)}
                      >
                        <IconHistory size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                  <Group gap="xs" mt="xs">
                    <Text fw={700} size="xl">
                      {formatMoney(
                        createMoney(currentTarget.amount, BASE_CURRENCY)
                      )}
                    </Text>
                    {currentTarget.achieved && (
                      <Badge color="green" size="lg">
                        Achieved!
                      </Badge>
                    )}
                  </Group>
                </div>
                <ThemeIcon
                  color={currentTarget.achieved ? "green" : "blue"}
                  variant="light"
                  size="lg"
                  radius="md"
                >
                  {currentTarget.achieved ? (
                    <IconTrophy style={{ width: rem(20), height: rem(20) }} />
                  ) : (
                    <IconTarget style={{ width: rem(20), height: rem(20) }} />
                  )}
                </ThemeIcon>
              </Group>

              {/* Progress bar */}
              <Stack gap="xs">
                {(() => {
                  // Calculate percentage without capping at 100%
                  const percentage =
                    revenue && currentTarget
                      ? (revenue.amount / currentTarget.amount) * 100
                      : 0;

                  // Calculate display percentage for progress bar (capped at 100%)
                  const displayPercentage = Math.min(100, percentage);

                  // Calculate excess percentage (how much over 100%)
                  const excessPercentage = Math.max(0, percentage - 100);

                  // Determine color based on progress
                  let progressColor = "blue";
                  if (percentage > 100) {
                    progressColor = "yellow.7"; // Gold color for overachievers
                  } else if (currentTarget?.achieved) {
                    progressColor = "green";
                  } else if (percentage >= 90) {
                    progressColor = "teal";
                  } else if (percentage >= 75) {
                    progressColor = "cyan";
                  } else if (percentage >= 50) {
                    progressColor = "indigo";
                  }

                  // Get encouraging message based on progress
                  let message = "";
                  const remaining = currentTarget
                    ? currentTarget.amount - (revenue?.amount || 0)
                    : 0;

                  // Special message for overachievers
                  if (percentage > 100) {
                    const excess =
                      (revenue?.amount || 0) - currentTarget.amount;
                    message = `🏅 EXCEPTIONAL PERFORMANCE! You've exceeded your target by ${formatMoney(
                      createMoney(excess)
                    )} (${excessPercentage.toFixed(
                      1
                    )}%)! You're a champion! 🏅`;
                  } else if (currentTarget?.achieved) {
                    message =
                      "🎉 Amazing job! Target achieved! You're a superstar! 🏆";
                  } else if (percentage >= 90) {
                    message = `🚀 Almost there! Just ${formatMoney(
                      createMoney(remaining)
                    )} more to go! You can do it! ✨`;
                  } else if (percentage >= 75) {
                    message = `💪 You're making excellent progress! Only ${formatMoney(
                      createMoney(remaining)
                    )} more to reach your goal! 🔥`;
                  } else if (percentage >= 50) {
                    message = `👍 Halfway there! Keep it up! ${formatMoney(
                      createMoney(remaining)
                    )} more to go! You're on fire! 🔥`;
                  } else if (percentage >= 25) {
                    message = `😊 Good start! ${formatMoney(
                      createMoney(remaining)
                    )} more to reach your target! Keep going! ⭐`;
                  } else if (percentage > 0) {
                    message = `🌱 You've started! ${formatMoney(
                      createMoney(remaining)
                    )} more to reach your target! Every sale counts! 📈`;
                  }

                  return (
                    <>
                      <Progress
                        value={displayPercentage}
                        color={progressColor}
                        size="xl"
                        radius="md"
                        striped={currentTarget?.achieved || percentage >= 90}
                        animated={currentTarget?.achieved || percentage >= 90}
                      />
                      <Group justify="apart">
                        <Text size="sm" c="dimmed">
                          {revenue ? formatMoney(revenue) : "$0.00"}
                        </Text>
                        <Text size="sm" fw={500} c={progressColor}>
                          {percentage.toFixed(1)}%
                        </Text>
                        <Text size="sm" c="dimmed">
                          {formatMoney(
                            createMoney(
                              currentTarget?.amount || 0,
                              BASE_CURRENCY
                            )
                          )}
                        </Text>
                      </Group>
                      {message && (
                        <Text
                          ta="center"
                          size="sm"
                          fw={500}
                          c={progressColor}
                          style={{
                            opacity: percentage > 0 ? 1 : 0,
                            transition: "opacity 0.3s ease",
                          }}
                        >
                          {message}
                        </Text>
                      )}
                    </>
                  );
                })()}
              </Stack>
            </Card>
          )}

          {!currentTarget && (
            <Card withBorder p="md" radius="md" mb="md">
              <Group justify="space-between" align="center">
                <Text>No sales target set for today</Text>
                <Button
                  leftSection={<IconTarget size={16} />}
                  onClick={() => setShowTargetModal(true)}
                  variant="light"
                >
                  Set Target
                </Button>
              </Group>
            </Card>
          )}

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

      {/* Set Target Modal */}
      <Modal
        opened={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        title="Set Sales Target for Today"
        centered
      >
        <Stack>
          <Text size="sm">
            Setting a daily sales target can help you track your progress and
            stay motivated.
          </Text>

          <NumberInput
            label="Target Amount"
            description={`Enter your sales target in ${BASE_CURRENCY}`}
            value={targetAmount}
            onChange={(val) => setTargetAmount(Number(val))}
            min={0}
            step={10}
            decimalScale={2}
            prefix="$"
            size="lg"
          />

          <Group justify="right" mt="md">
            <Button variant="outline" onClick={() => setShowTargetModal(false)}>
              Skip
            </Button>
            <Button onClick={setNewTarget} disabled={targetAmount <= 0}>
              Set Target
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Target History Modal */}
      <Modal
        opened={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Sales Target History"
        size="lg"
      >
        {renderTargetHistory()}
        <Button fullWidth mt="md" onClick={() => setShowHistoryModal(false)}>
          Close
        </Button>
      </Modal>

      {/* Celebration Modal */}
      <Modal
        opened={showCelebration}
        onClose={() => setShowCelebration(false)}
        title={
          <Title order={3} ta="center">
            🎉 Congratulations! 🎉
          </Title>
        }
        centered
        size="md"
      >
        <Stack align="center" gap="lg" py="md">
          <Text size="xl" fw={700} ta="center">
            You&apos;ve achieved your sales target for today!
          </Text>
          <div style={{ fontSize: "5rem", textAlign: "center" }}>🏆</div>
          <Text ta="center">
            Keep up the great work! Your dedication and effort have paid off.
          </Text>
          <Group>
            <Button
              variant="outline"
              onClick={() => {
                setShowCelebration(false);
                setShowTargetModal(true);
              }}
            >
              Set New Target
            </Button>
            <Button size="lg" onClick={() => setShowCelebration(false)}>
              Thank You!
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add hover styles */}
      <style jsx global>{`
        .hover-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}
