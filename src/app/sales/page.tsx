"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@mantine/core";
import { IconPlus, IconTarget, IconTrophy } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import SalesList from "@/components/SalesList";
import CollapsibleFab from "@/components/CollapsibleFab";
import { getSalesDB } from "@/lib/databases";
import { SaleDoc } from "@/types";
import { formatMoney, createMoney, BASE_CURRENCY, Money } from "@/types/money";

// Interface for sales target
interface SalesTarget {
  amount: number;
  currency: string;
  date: string;
  achieved: boolean;
}

export default function SalesPage() {
  const router = useRouter();
  const [todayRevenue, setTodayRevenue] = useState<Money | null>(null);
  const [currentTarget, setCurrentTarget] = useState<SalesTarget | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  console.log("SalesPage rendered::", loading);

  // Function to check if target is achieved and update it
  const checkTargetAchievement = useCallback(
    (totalAmount: number) => {
      if (!currentTarget) return;

      if (totalAmount >= currentTarget.amount && !currentTarget.achieved) {
        // Target achieved!
        const updatedTarget = {
          ...currentTarget,
          achieved: true,
        };
        setCurrentTarget(updatedTarget);
        localStorage.setItem(
          "currentSalesTarget",
          JSON.stringify(updatedTarget)
        );
      }
    },
    [currentTarget]
  );

  // Function to fetch today's sales data
  const fetchTodaySalesData = useCallback(async () => {
    if (typeof window === "undefined") return;

    setLoading(true);
    try {
      // Get today's sales
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISOString = today.toISOString();

      const salesDB = await getSalesDB();
      const salesResult = await salesDB.find({
        selector: {
          type: "sale",
          timestamp: { $gte: todayISOString },
        },
      });

      const todaySales = salesResult.docs as SaleDoc[];

      // Calculate total revenue
      let totalAmount = 0;
      if (todaySales.length > 0) {
        const currency = BASE_CURRENCY;
        const exchangeRate = 1;

        // Sum up all sales and convert to base currency
        todaySales.forEach((sale) => {
          if (sale.totalAmount.currency === BASE_CURRENCY) {
            totalAmount += sale.totalAmount.amount;
          } else {
            // Convert to base currency
            const valueInBaseCurrency =
              sale.totalAmount.amount / sale.totalAmount.exchangeRate;
            totalAmount += valueInBaseCurrency;
          }
        });

        setTodayRevenue({
          amount: totalAmount,
          currency,
          exchangeRate,
        });
      } else {
        setTodayRevenue(createMoney(0));
      }

      // Load current target from localStorage
      const targetJson = localStorage.getItem("currentSalesTarget");
      if (targetJson) {
        const target = JSON.parse(targetJson);
        setCurrentTarget(target);

        // Check if we've met the target
        if (totalAmount >= target.amount && !target.achieved) {
          checkTargetAchievement(totalAmount);
        }
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
    } finally {
      setLoading(false);
    }
  }, [checkTargetAchievement]);

  // Fetch data when component mounts
  useEffect(() => {
    fetchTodaySalesData();

    // Set up interval to refresh data every 30 seconds
    const intervalId = setInterval(fetchTodaySalesData, 30000);
    return () => clearInterval(intervalId);
  }, [fetchTodaySalesData]);

  // Calculate percentage of target achieved (without capping at 100%)
  const calculateTargetPercentage = () => {
    if (!todayRevenue || !currentTarget) return 0;
    return (todayRevenue.amount / currentTarget.amount) * 100;
  };

  // Calculate display percentage for progress bar (capped at 100%)
  const getDisplayPercentage = () => {
    return Math.min(100, calculateTargetPercentage());
  };

  // Get motivational message based on progress
  const getMotivationalMessage = () => {
    if (!todayRevenue || !currentTarget) return null;

    const percentage = calculateTargetPercentage();
    const remaining = currentTarget.amount - todayRevenue.amount;
    const excessPercentage = Math.max(0, percentage - 100);

    // Special message for overachievers
    if (percentage > 100) {
      const excess = todayRevenue.amount - currentTarget.amount;
      return {
        message: `🏅 EXCEPTIONAL PERFORMANCE! You've exceeded your target by ${formatMoney(
          createMoney(excess)
        )} (${excessPercentage.toFixed(1)}%)! You're a champion! 🏅`,
        color: "yellow.7", // Gold color for overachievers
      };
    } else if (currentTarget.achieved || percentage >= 100) {
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
      {currentTarget ? (
        <Paper withBorder p="md" mb="lg" radius="md">
          <Group justify="space-between" mb="xs">
            <Group>
              <IconTarget size={20} color={motivationalMessage?.color} />
              <Text fw={600} size="md">
                Today&apos;s Sales Target
              </Text>
            </Group>
            {calculateTargetPercentage() > 100 ? (
              <Badge color="yellow.7" leftSection={<IconTrophy size={14} />}>
                Exceeded! 🏅
              </Badge>
            ) : (
              currentTarget.achieved && (
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
              currentTarget.achieved || calculateTargetPercentage() >= 90
            }
            animated={
              currentTarget.achieved || calculateTargetPercentage() >= 90
            }
            mb="xs"
          />

          <Group justify="space-between" mb="xs">
            <Text size="sm">
              {todayRevenue ? formatMoney(todayRevenue) : "$0.00"}
            </Text>
            <Text size="sm" fw={500} c={motivationalMessage?.color}>
              {calculateTargetPercentage().toFixed(1)}%
            </Text>
            <Text size="sm">
              {formatMoney(createMoney(currentTarget.amount, BASE_CURRENCY))}
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
              <Text>No sales target set for today</Text>
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
        <SalesList />
      </Paper>
    </>
  );
}
