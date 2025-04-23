"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  Tabs,
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
  IconCalendar,
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
import {
  SalesTarget,
  AggregatedTarget,
  setCurrentTarget,
  getCurrentTarget,
  saveTargetToHistory,
  getTargetHistory,
  getTargetForDateRange,
  formatTargetAmount,
  getTargetLabel,
  setWeeklyTarget,
  setMonthlyTarget,
  updateTargetAchievement,
} from "@/lib/salesTargets";

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
  const router = useRouter();
  const { dateRangeInfo, dateRange, customDateRange } = useDateFilter();
  const { startDate, endDate, label } = dateRangeInfo;
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<"synced" | "pending" | "error">(
    "synced"
  );

  // State for actual data with individual loading states
  const [productCount, setProductCount] = useState<number>(0);
  const [salesCount, setSalesCount] = useState<number>(0);
  const [revenue, setRevenue] = useState<Money | null>(null);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [salesLoading, setSalesLoading] = useState<boolean>(true);
  const [revenueLoading, setRevenueLoading] = useState<boolean>(true);

  // State for sales target
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [targetAmount, setTargetAmount] = useState<number>(0);
  const [currentTarget, setCurrentTargetState] = useState<SalesTarget | null>(
    null
  );
  const [aggregatedTarget, setAggregatedTarget] =
    useState<AggregatedTarget | null>(null);
  const [targetHistory, setTargetHistory] = useState<SalesTarget[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [weeklyTargetAmount, setWeeklyTargetAmount] = useState<number>(0);
  const [monthlyTargetAmount, setMonthlyTargetAmount] = useState<number>(0);

  // Function to fetch data for dashboard
  const fetchDashboardData = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Reset loading states
    setProductsLoading(true);
    setSalesLoading(true);
    setRevenueLoading(true);

    // Initialize databases
    let productsDB;
    let salesDB;
    try {
      [productsDB, salesDB] = await Promise.all([
        getProductsDB(),
        getSalesDB(),
      ]);
    } catch (error) {
      console.error("Error initializing databases:", error);
      return;
    }

    // Fetch products count
    try {
      const productsResult = await productsDB.find({
        selector: { type: "product" },
      });
      setProductCount(productsResult.docs.length);
    } catch (error) {
      console.error("Error fetching products:", error);
      setProductCount(0);
    } finally {
      setProductsLoading(false);
    }

    // Fetch sales and revenue data
    try {
      const startDateISOString = startDate.toISOString();
      const endDateISOString = endDate.toISOString();

      // Create an index for timestamp and type if it doesn't exist
      try {
        await salesDB.createIndex({
          index: {
            fields: ["timestamp", "type"],
          },
        });
      } catch (error) {
        // Index might already exist, ignore error
        console.debug("Index might already exist:", error);
      }

      // Query sales with filtering at the database level
      const result = await salesDB.find({
        selector: {
          type: "sale",
          timestamp: {
            $gte: startDateISOString,
            $lt: endDateISOString,
          },
        },
      });

      const filteredSales = result.docs as SaleDoc[];

      setSalesCount(filteredSales.length);

      // Calculate total revenue
      let totalAmount = 0;
      if (filteredSales.length > 0) {
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
      } else {
        setRevenue(createMoney(0));
      }

      // Get the appropriate target for the selected date range
      const target = getTargetForDateRange(
        dateRange,
        customDateRange,
        dateRangeInfo.startDate,
        dateRangeInfo.endDate,
        totalAmount
      );

      if (target) {
        if ("totalAmount" in target) {
          // It's an aggregated target
          setAggregatedTarget(target);
          setCurrentTargetState(null);

          // Check if we've met the aggregated target
          if (totalAmount >= target.totalAmount && !target.achieved) {
            // Show celebration
            setShowCelebration(true);
          }
        } else {
          // It's a single day target
          setCurrentTargetState(target);
          setAggregatedTarget(null);

          // Check if target is achieved
          if (target.amount <= totalAmount && !target.achieved) {
            // Update in localStorage using the imported function
            const newTarget = updateTargetAchievement(target, true);
            setCurrentTargetState(newTarget);

            // Show celebration
            setShowCelebration(true);
          }
        }
      } else {
        setCurrentTargetState(null);
        setAggregatedTarget(null);
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
      setSalesCount(0);
      setRevenue(createMoney(0));
    } finally {
      setSalesLoading(false);
      setRevenueLoading(false);
    }
  }, [dateRange, customDateRange, startDate, endDate, label]); // Re-fetch when date range changes

  // Function to load sales target from localStorage
  const loadSalesTarget = useCallback(() => {
    if (typeof window === "undefined") return;

    // Load current target
    const target = getCurrentTarget();
    if (target) {
      // Check if target is for today
      const today = new Date().toISOString().split("T")[0];
      if (target.date === today) {
        setCurrentTargetState(target);
      } else {
        // If target is from a previous day, move it to history
        saveTargetToHistory(target);
        setCurrentTargetState(null);
      }
    }

    // Load target history
    setTargetHistory(getTargetHistory());

    // Check if we should prompt for a new target
    const lastPrompt = localStorage.getItem("lastTargetPrompt");
    const today = new Date().toISOString().split("T")[0];

    if (!target && (!lastPrompt || lastPrompt !== today)) {
      // Only show the prompt if we don't have a target for today
      // and we haven't prompted today
      setTimeout(() => {
        setShowTargetModal(true);
        localStorage.setItem("lastTargetPrompt", today);
      }, 1000);
    }
  }, []);

  // Function to set a new daily sales target
  const setNewTarget = () => {
    if (targetAmount <= 0) return;

    const newTarget = setCurrentTarget(targetAmount);
    setCurrentTargetState(newTarget);
    setShowTargetModal(false);
    // Reset target amount for next time
    setTargetAmount(0);
  };

  // Function to set a new weekly sales target
  const setNewWeeklyTarget = () => {
    if (weeklyTargetAmount <= 0) return;

    // Get the start of the current week
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to get Monday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    setWeeklyTarget(monday, weeklyTargetAmount);
    setWeeklyTargetAmount(0);

    // Refresh dashboard data
    fetchDashboardData();
  };

  // Function to set a new monthly sales target
  const setNewMonthlyTarget = () => {
    if (monthlyTargetAmount <= 0) return;

    const now = new Date();
    setMonthlyTarget(now.getFullYear(), now.getMonth(), monthlyTargetAmount);
    setMonthlyTargetAmount(0);

    // Refresh dashboard data
    fetchDashboardData();
  };

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") {
      return () => {}; // Return empty cleanup function if window is undefined
    }

    let productsChangeListener: { cancel(): void } | null = null;
    let salesChangeListener: { cancel(): void } | null = null;

    // Set up database change listeners
    async function setupChangeListeners() {
      try {
        const [productsDB, salesDB] = await Promise.all([
          getProductsDB(),
          getSalesDB(),
        ]);

        productsChangeListener = productsDB
          .changes({
            since: "now",
            live: true,
          })
          .on("change", () => {
            // Refresh products count when changes occur
            fetchDashboardData();
          });

        salesChangeListener = salesDB
          .changes({
            since: "now",
            live: true,
            include_docs: true,
          })
          .on("change", (change) => {
            const changedDoc = change.doc as SaleDoc;
            if (changedDoc?.type === "sale") {
              // Refresh sales data when changes occur
              fetchDashboardData();
            }
          });
      } catch (error) {
        console.error("Error setting up change listeners:", error);
      }
    }

    // Load sales target data
    loadSalesTarget();

    // Fetch initial data and set up listeners
    fetchDashboardData();
    setupChangeListeners();

    // Set up interval to refresh data every minute
    const intervalId = setInterval(fetchDashboardData, 60000);

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
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (productsChangeListener) {
        productsChangeListener.cancel();
      }
      if (salesChangeListener) {
        salesChangeListener.cancel();
      }
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnlineStatus);
      window.removeEventListener("offline", handleOnlineStatus);
    };
  }, [
    fetchDashboardData,
    loadSalesTarget,
    dateRange,
    customDateRange,
    startDate,
    endDate,
  ]);

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
      value: productsLoading ? "..." : productCount.toString(),
      icon: IconPackage,
      color: "green",
      path: "/products",
    },
    {
      label: `Sales (${dateRangeInfo.label})`,
      value: salesLoading ? "..." : salesCount.toString(),
      icon: IconShoppingCart,
      color: "blue",
      path: "/sales",
    },
    {
      label: `Revenue (${dateRangeInfo.label})`,
      value: revenueLoading ? "..." : revenue ? formatMoney(revenue) : "$0.00",
      icon: IconChartBar,
      color: "violet",
      path: "/reports",
    },
  ];

  // Function to render the progress bar
  const renderProgressBar = (): React.ReactNode => {
    // Calculate percentage without capping at 100%
    const targetAmount =
      currentTarget?.amount || aggregatedTarget?.totalAmount || 0;
    const percentage =
      revenue && targetAmount > 0 ? (revenue.amount / targetAmount) * 100 : 0;

    // Calculate display percentage for progress bar (capped at 100%)
    const displayPercentage = Math.min(100, percentage);

    // Calculate excess percentage (how much over 100%)
    const excessPercentage = Math.max(0, percentage - 100);

    // Determine color based on progress
    let progressColor = "blue";
    if (percentage > 100) {
      progressColor = "yellow.7"; // Gold color for overachievers
    } else if (currentTarget?.achieved || aggregatedTarget?.achieved) {
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
    const remaining = targetAmount - (revenue?.amount || 0);

    // Special message for overachievers
    if (percentage > 100) {
      const excess = (revenue?.amount || 0) - targetAmount;
      message = `🏅 EXCEPTIONAL PERFORMANCE! You&apos;ve exceeded your target by ${formatMoney(
        createMoney(excess)
      )} (${excessPercentage.toFixed(1)}%)! You&apos;re a champion! 🏅`;
    } else if (currentTarget?.achieved || aggregatedTarget?.achieved) {
      message = "🎉 Amazing job! Target achieved! You&apos;re a superstar! 🏆";
    } else if (percentage >= 90) {
      message = `🚀 Almost there! Just ${formatMoney(
        createMoney(remaining)
      )} more to go! You can do it! ✨`;
    } else if (percentage >= 75) {
      message = `💪 You&apos;re making excellent progress! Only ${formatMoney(
        createMoney(remaining)
      )} more to reach your goal! 🔥`;
    } else if (percentage >= 50) {
      message = `👍 Halfway there! Keep it up! ${formatMoney(
        createMoney(remaining)
      )} more to go! You&apos;re on fire! 🔥`;
    } else if (percentage >= 25) {
      message = `😊 Good start! ${formatMoney(
        createMoney(remaining)
      )} more to reach your target! Keep going! ⭐`;
    } else if (percentage > 0) {
      message = `🌱 You&apos;ve started! ${formatMoney(
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
          striped={
            currentTarget?.achieved ||
            aggregatedTarget?.achieved ||
            percentage >= 90
          }
          animated={
            currentTarget?.achieved ||
            aggregatedTarget?.achieved ||
            percentage >= 90
          }
        />
        <Group justify="apart">
          <Text size="sm" c="dimmed">
            {revenue ? formatMoney(revenue) : "$0.00"}
          </Text>
          <Text size="sm" fw={500} c={progressColor}>
            {percentage.toFixed(1)}%
          </Text>
          <Text size="sm" c="dimmed">
            {currentTarget
              ? formatMoney(
                  createMoney(currentTarget.amount, currentTarget.currency)
                )
              : formatTargetAmount(aggregatedTarget)}
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
  };

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
          {currentTarget || aggregatedTarget ? (
            <Card withBorder p="md" radius="md" mb="md">
              <Group justify="space-between" align="flex-start" mb="xs">
                <div>
                  <Group align="center">
                    <Text fw={500} size="lg">
                      {currentTarget
                        ? "Today&apos;s Sales Target"
                        : getTargetLabel(aggregatedTarget, dateRange)}
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
                      {currentTarget
                        ? formatMoney(
                            createMoney(
                              currentTarget.amount,
                              currentTarget.currency
                            )
                          )
                        : formatTargetAmount(aggregatedTarget)}
                    </Text>
                    {(currentTarget?.achieved ||
                      aggregatedTarget?.achieved) && (
                      <Badge color="green" size="lg">
                        Achieved!
                      </Badge>
                    )}
                  </Group>
                </div>
                <ThemeIcon
                  color={
                    currentTarget?.achieved || aggregatedTarget?.achieved
                      ? "green"
                      : "blue"
                  }
                  variant="light"
                  size="lg"
                  radius="md"
                >
                  {currentTarget?.achieved || aggregatedTarget?.achieved ? (
                    <IconTrophy style={{ width: rem(20), height: rem(20) }} />
                  ) : (
                    <IconTarget style={{ width: rem(20), height: rem(20) }} />
                  )}
                </ThemeIcon>
              </Group>

              {/* Progress bar */}
              <Stack gap="xs">{renderProgressBar()}</Stack>
            </Card>
          ) : null}

          {!currentTarget && !aggregatedTarget && (
            <Card withBorder p="md" radius="md" mb="md">
              <Group justify="space-between" align="center">
                <Text>
                  No sales target set for {dateRangeInfo.label.toLowerCase()}
                </Text>
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
                  leftSection={<IconShare size={20} />}
                  variant="outline"
                  fullWidth
                  onClick={() => {
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

          {/* Add hover styles */}
          <style jsx>{`
            .hover-card {
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .hover-card:hover {
              transform: translateY(-4px);
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
          `}</style>
        </Stack>
      </Container>

      {/* Modals */}
      {/* Target Modal */}
      <Modal
        opened={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        title="Set Sales Target"
        centered
        size="lg"
      >
        <Stack>
          <Text size="sm">
            Setting sales targets can help you track your progress and stay
            motivated. Choose the type of target you want to set.
          </Text>
          <Tabs defaultValue="daily">
            <Tabs.List>
              <Tabs.Tab value="daily" leftSection={<IconTarget size={16} />}>
                Daily Target
              </Tabs.Tab>
              <Tabs.Tab value="weekly" leftSection={<IconCalendar size={16} />}>
                Weekly Target
              </Tabs.Tab>
              <Tabs.Tab
                value="monthly"
                leftSection={<IconCalendar size={16} />}
              >
                Monthly Target
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="daily" pt="xs">
              <Stack mt="md">
                <Text size="sm">Set a target for today&apos;s sales.</Text>
                <NumberInput
                  label="Daily Target Amount"
                  description={`Enter your daily sales target in ${BASE_CURRENCY}`}
                  value={targetAmount}
                  onChange={(val) => setTargetAmount(Number(val))}
                  min={0}
                  step={10}
                  decimalScale={2}
                  prefix="$"
                  size="lg"
                />
                <Group justify="right" mt="md">
                  <Button
                    variant="outline"
                    onClick={() => setShowTargetModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={setNewTarget}
                    disabled={targetAmount <= 0}
                    color="blue"
                  >
                    Set Daily Target
                  </Button>
                </Group>
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="weekly" pt="xs">
              <Stack mt="md">
                <Text size="sm">
                  Set a target for this week&apos;s sales. This will help you
                  track your weekly performance.
                </Text>
                <NumberInput
                  label="Weekly Target Amount"
                  description={`Enter your weekly sales target in ${BASE_CURRENCY}`}
                  value={weeklyTargetAmount}
                  onChange={(val) => setWeeklyTargetAmount(Number(val))}
                  min={0}
                  step={50}
                  decimalScale={2}
                  prefix="$"
                  size="lg"
                />
                <Group justify="right" mt="md">
                  <Button
                    variant="outline"
                    onClick={() => setShowTargetModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={setNewWeeklyTarget}
                    disabled={weeklyTargetAmount <= 0}
                    color="teal"
                  >
                    Set Weekly Target
                  </Button>
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="monthly" pt="xs">
              <Stack mt="md">
                <Text size="sm">
                  Set a target for this month&apos;s sales. This will help you
                  track your monthly performance.
                </Text>
                <NumberInput
                  label="Monthly Target Amount"
                  description={`Enter your monthly sales target in ${BASE_CURRENCY}`}
                  value={monthlyTargetAmount}
                  onChange={(val) => setMonthlyTargetAmount(Number(val))}
                  min={0}
                  step={100}
                  decimalScale={2}
                  prefix="$"
                  size="lg"
                />
                <Group justify="right" mt="md">
                  <Button
                    variant="outline"
                    onClick={() => setShowTargetModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={setNewMonthlyTarget}
                    disabled={monthlyTargetAmount <= 0}
                    color="indigo"
                  >
                    Set Monthly Target
                  </Button>
                </Group>
              </Stack>
            </Tabs.Panel>
          </Tabs>
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
          <div style={{ fontSize: rem(80), textAlign: "center" }}>🏆</div>
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
    </div>
  );
}
