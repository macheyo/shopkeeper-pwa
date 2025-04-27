"use client";

import { useState, useEffect, useCallback } from "react";
import ClientOnly from "@/components/ClientOnly";
import {
  Title,
  Group,
  Text,
  Paper,
  Box,
  Alert,
  Progress,
  Badge,
  Button,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconPlus,
  IconTarget,
  IconTrophy,
  IconHistory,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import SalesList from "@/components/SalesList";
import CollapsibleFab from "@/components/CollapsibleFab";
import { getSalesDB } from "@/lib/databases";
import { SaleDoc } from "@/types";
import { formatMoney, createMoney, BASE_CURRENCY, Money } from "@/types/money";
import { useDateFilter } from "@/contexts/DateFilterContext";
import {
  SalesTarget,
  AggregatedTarget,
  getTargetForDateRange,
  formatTargetAmount,
  getTargetLabel,
} from "@/lib/salesTargets";
import { SalesTargetHistoryModal } from "@/components/SalesTargetHistoryModal";

export default function SalesPage() {
  const router = useRouter();
  const { dateRangeInfo, dateRange, customDateRange } = useDateFilter();
  const [revenue, setRevenue] = useState<Money | null>(null);
  const [currentTarget, setCurrentTarget] = useState<SalesTarget | null>(null);
  const [aggregatedTarget, setAggregatedTarget] =
    useState<AggregatedTarget | null>(null);
  const [opened, setOpened] = useState(false);

  // Function to fetch sales data for the selected date range
  const fetchSalesData = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      // Get sales for the selected date range
      const startDateISOString = dateRangeInfo.startDate.toISOString();
      const endDateISOString = dateRangeInfo.endDate.toISOString();

      const salesDB = await getSalesDB();

      // Get sales for the selected date range
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
          setCurrentTarget(null);
        } else {
          // It's a single day target
          setCurrentTarget(target);
          setAggregatedTarget(null);
        }
      } else {
        setCurrentTarget(null);
        setAggregatedTarget(null);
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
    } finally {
    }
  }, [dateRange, customDateRange, dateRangeInfo]); // Re-fetch when date range changes

  // Fetch data when component mounts or date range changes
  useEffect(() => {
    fetchSalesData();

    // Set up interval to refresh data every 30 seconds
    const intervalId = setInterval(fetchSalesData, 30000);
    return () => clearInterval(intervalId);
  }, [fetchSalesData]);

  // Calculate percentage of target achieved (without capping at 100%)
  const calculateTargetPercentage = () => {
    if (!revenue) return 0;

    // Get the target amount based on whether we have a current target or aggregated target
    const targetAmount =
      currentTarget?.amount || aggregatedTarget?.totalAmount || 0;

    if (targetAmount === 0) return 0;

    return (revenue.amount / targetAmount) * 100;
  };

  // Calculate display percentage for progress bar (capped at 100%)
  const getDisplayPercentage = () => {
    return Math.min(100, calculateTargetPercentage());
  };

  // Get motivational message based on progress
  const getMotivationalMessage = () => {
    if (!revenue) return null;

    // Get the target based on whether we have a current target or aggregated target
    if (!currentTarget && !aggregatedTarget) return null;

    const percentage = calculateTargetPercentage();
    const targetAmount =
      currentTarget?.amount || aggregatedTarget?.totalAmount || 0;
    const remaining = targetAmount - revenue.amount;
    const excessPercentage = Math.max(0, percentage - 100);

    // Special message for overachievers
    if (percentage > 100) {
      const excess = revenue.amount - targetAmount;
      return {
        message: `🏅 EXCEPTIONAL PERFORMANCE! You've exceeded your target by ${formatMoney(
          createMoney(excess)
        )} (${excessPercentage.toFixed(1)}%)! You're a champion! 🏅`,
        color: "yellow.7", // Gold color for overachievers
      };
    } else if (
      currentTarget?.achieved ||
      aggregatedTarget?.achieved ||
      percentage >= 100
    ) {
      return {
        message:
          "🎉 Amazing job! You've reached your sales target for today! 🏆",
        color: "green",
      };
    } else if (percentage >= 90) {
      return {
        message: `🚀 Almost there! Just ${formatMoney(
          createMoney(remaining)
        )} more to reach your target! You can do it! ✨`,
        color: "teal",
      };
    } else if (percentage >= 75) {
      return {
        message: `💪 You're making excellent progress! Only ${formatMoney(
          createMoney(remaining)
        )} more to go! Keep pushing! 🔥`,
        color: "cyan",
      };
    } else if (percentage >= 50) {
      return {
        message: `👍 Halfway there! Keep it up! Just ${formatMoney(
          createMoney(remaining)
        )} more to reach your goal! You're on fire! 🔥`,
        color: "indigo",
      };
    } else if (percentage >= 25) {
      return {
        message: `😊 Good start! ${formatMoney(
          createMoney(remaining)
        )} more to reach your target! You're making progress! ⭐`,
        color: "blue",
      };
    } else if (percentage > 0) {
      return {
        message: `🌱 You've started! ${formatMoney(
          createMoney(remaining)
        )} more to reach your target! Every sale counts! 📈`,
        color: "blue",
      };
    }

    return {
      message: `Set a sales target for today to track your progress!`,
      color: "gray",
    };
  };

  const motivationalMessage = getMotivationalMessage();

  return (
    <>
      <Box mb="xl">
        <Group justify="space-between" align="center">
          <Title order={2}>Sales</Title>
          <CollapsibleFab
            icon={<IconPlus size={16} />}
            text="New Sale"
            onClick={() => router.push("/sales/new")}
            color="blue"
          />
        </Group>
        <Text c="dimmed" mt="xs">
          Record and manage your sales transactions
        </Text>
      </Box>

      {/* Target Progress Card */}
      {currentTarget || aggregatedTarget ? (
        <Paper withBorder p="md" mb="lg" radius="md">
          <Group justify="space-between" mb="xs">
            <Group>
              <IconTarget size={20} color={motivationalMessage?.color} />
              <Text fw={600} size="md">
                {currentTarget
                  ? "Today's Sales Target"
                  : getTargetLabel(aggregatedTarget, dateRange)}
              </Text>
              <Tooltip label="View target history">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => setOpened(true)}
                >
                  <IconHistory size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
            {calculateTargetPercentage() > 100 ? (
              <Badge color="yellow.7" leftSection={<IconTrophy size={14} />}>
                Exceeded! 🏅
              </Badge>
            ) : (
              (currentTarget?.achieved || aggregatedTarget?.achieved) && (
                <Badge color="green" leftSection={<IconTrophy size={14} />}>
                  Achieved!
                </Badge>
              )
            )}
          </Group>

          <Progress
            value={getDisplayPercentage()}
            color={motivationalMessage?.color}
            size="lg"
            radius="md"
            striped={
              currentTarget?.achieved ||
              aggregatedTarget?.achieved ||
              calculateTargetPercentage() >= 90
            }
            animated={
              currentTarget?.achieved ||
              aggregatedTarget?.achieved ||
              calculateTargetPercentage() >= 90
            }
            mb="xs"
          />

          <Group justify="space-between" mb="xs">
            <Text size="sm">{revenue ? formatMoney(revenue) : "$0.00"}</Text>
            <Text size="sm" fw={500} c={motivationalMessage?.color}>
              {calculateTargetPercentage().toFixed(1)}%
            </Text>
            <Text size="sm">
              {currentTarget
                ? formatMoney(
                    createMoney(currentTarget.amount, currentTarget.currency)
                  )
                : formatTargetAmount(aggregatedTarget)}
            </Text>
          </Group>

          {motivationalMessage && (
            <Alert
              color={motivationalMessage.color}
              variant="light"
              radius="md"
            >
              {motivationalMessage.message}
            </Alert>
          )}
        </Paper>
      ) : (
        <Paper withBorder p="md" mb="lg" radius="md">
          <Group justify="space-between" align="center">
            <Group>
              <IconTarget size={20} />
              <Text>
                No sales target set for {dateRangeInfo.label.toLowerCase()}
              </Text>
            </Group>
            <Button
              leftSection={<IconTarget size={16} />}
              onClick={() => router.push("/")}
              variant="light"
            >
              Set Target
            </Button>
          </Group>
        </Paper>
      )}

      <Paper shadow="xs" p="md" withBorder>
        <ClientOnly>
          <SalesList />
        </ClientOnly>
      </Paper>
      <SalesTargetHistoryModal
        opened={opened}
        onClose={() => setOpened(false)}
      />
    </>
  );
}
