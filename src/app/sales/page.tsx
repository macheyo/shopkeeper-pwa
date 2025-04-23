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
import { useDateFilter } from "@/contexts/DateFilterContext";

// Interface for sales target
interface SalesTarget {
  amount: number;
  currency: string;
  date: string;
  achieved: boolean;
}

export default function SalesPage() {
  const router = useRouter();
  const { dateRangeInfo } = useDateFilter();
  const [revenue, setRevenue] = useState<Money | null>(null);
  const [currentTarget, setCurrentTarget] = useState<SalesTarget | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  // Function to fetch sales data for the selected date range
  const fetchSalesData = useCallback(async () => {
    if (typeof window === "undefined") return;

    setLoading(true);
    try {
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
  }, [checkTargetAchievement, dateRangeInfo]); // Re-fetch when date range changes

  // Fetch data when component mounts or date range changes
  useEffect(() => {
    fetchSalesData();

    // Set up interval to refresh data every 30 seconds
    const intervalId = setInterval(fetchSalesData, 30000);
    return () => clearInterval(intervalId);
  }, [fetchSalesData]);

  // Calculate percentage of target achieved (without capping at 100%)
  const calculateTargetPercentage = () => {
    if (!revenue || !currentTarget) return 0;
    return (revenue.amount / currentTarget.amount) * 100;
  };

  // Calculate display percentage for progress bar (capped at 100%)
  const getDisplayPercentage = () => {
    return Math.min(100, calculateTargetPercentage());
  };

  // Get motivational message based on progress
  const getMotivationalMessage = () => {
    if (!revenue || !currentTarget) return null;

    const percentage = calculateTargetPercentage();
    const remaining = currentTarget.amount - revenue.amount;
    const excessPercentage = Math.max(0, percentage - 100);

    // Special message for overachievers
    if (percentage > 100) {
      const excess = revenue.amount - currentTarget.amount;
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
            <Text size="sm">{revenue ? formatMoney(revenue) : "$0.00"}</Text>
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
