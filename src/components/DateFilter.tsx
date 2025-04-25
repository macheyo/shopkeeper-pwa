"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Group,
  Text,
  Tooltip,
  Button,
  Modal,
  Stack,
  SegmentedControl,
  Badge,
  Menu,
  Drawer,
  Box,
} from "@mantine/core";
import {
  IconCalendar,
  IconInfoCircle,
  IconChevronDown,
  IconFilter,
  IconCalendarStats,
} from "@tabler/icons-react";
import { useDateFilter } from "@/contexts/DateFilterContext";

export type DateRange =
  | "today"
  | "yesterday"
  | "2days"
  | "week"
  | "month"
  | "all"
  | "custom";

// Interface for custom date range
export interface CustomDateRange {
  startDate: Date;
  endDate: Date;
}

export interface DateRangeInfo {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface DateFilterProps {
  value: DateRange;
  onChange: (value: DateRange, customRange?: CustomDateRange) => void;
  showCounts: boolean;
  todayCount?: number;
  yesterdayCount?: number;
  twoDaysCount?: number;
  weekCount?: number;
  monthCount?: number;
  allCount?: number;
  customCount?: number;
}

/**
 * Get date range based on the selected filter
 */
export function getDateRangeFromFilter(
  filter: DateRange,
  customRange?: CustomDateRange
): DateRangeInfo {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Week ago
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Month ago
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  // Set a far past date for "all" filter (1 year ago)
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  switch (filter) {
    case "today":
      return {
        startDate: today,
        endDate: tomorrow,
        label: "Today",
      };
    case "yesterday":
      return {
        startDate: yesterday,
        endDate: today,
        label: "Yesterday",
      };
    case "2days":
      return {
        startDate: twoDaysAgo,
        endDate: yesterday,
        label: "2 Days Ago",
      };
    case "week":
      return {
        startDate: weekAgo,
        endDate: tomorrow,
        label: "Last 7 Days",
      };
    case "month":
      return {
        startDate: monthAgo,
        endDate: tomorrow,
        label: "Last 30 Days",
      };
    case "custom":
      if (customRange) {
        // Make sure endDate is the next day to include the full day
        const endDate = new Date(customRange.endDate);
        endDate.setDate(endDate.getDate() + 1);
        return {
          startDate: customRange.startDate,
          endDate: endDate,
          label: "Custom Range",
        };
      }
      // Fallback to today if no custom range provided
      return {
        startDate: today,
        endDate: tomorrow,
        label: "Today",
      };
    case "all":
      return {
        startDate: oneYearAgo,
        endDate: tomorrow,
        label: "All Time",
      };
    default:
      return {
        startDate: today,
        endDate: tomorrow,
        label: "Today",
      };
  }
}

export default function DateFilter({
  showCounts = false,
  todayCount,
  yesterdayCount,
  twoDaysCount,
  weekCount,
  monthCount,
  allCount,
  customCount,
}: Partial<DateFilterProps>) {
  const { dateRange, customDateRange, setDateRange, dateRangeInfo } =
    useDateFilter();
  const [mounted, setMounted] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [lastValue, setLastValue] = useState<DateRange>(dateRange);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Only render on client side to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Store the last non-custom value to revert to if needed
  useEffect(() => {
    if (dateRange !== "custom") {
      setLastValue(dateRange);
    }
  }, [dateRange]);

  // Initialize custom date range when opening the modal
  useEffect(() => {
    if (showCustomModal && customDateRange) {
      setStartDate(customDateRange.startDate);
      setEndDate(customDateRange.endDate);
    } else if (showCustomModal) {
      // Default to last 7 days if no custom range is set
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      setStartDate(start);
      setEndDate(end);
    }
  }, [showCustomModal, customDateRange]);

  // Handle value change from SegmentedControl or Menu
  const handleValueChange = useCallback(
    (newValue: string) => {
      if (newValue === "custom") {
        setShowCustomModal(true);
      } else {
        setDateRange(newValue as DateRange);
        setShowFilterDrawer(false);
      }
    },
    [setDateRange]
  );

  // Handle custom range selection
  const handleCustomRangeSelect = useCallback(() => {
    if (startDate && endDate) {
      setDateRange("custom", { startDate, endDate });
      setShowCustomModal(false);
      setShowFilterDrawer(false);
    }
  }, [startDate, endDate, setDateRange]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowCustomModal(false);
    // If we're in custom mode without valid dates, revert to last value
    if (dateRange === "custom" && (!startDate || !endDate)) {
      setDateRange(lastValue);
    }
  }, [dateRange, startDate, endDate, setDateRange, lastValue]);

  if (!mounted) {
    return null;
  }

  // Basic options for quick filters
  const basicOptions = [
    {
      value: "today",
      label: (
        <Group gap={4} wrap="nowrap">
          <Text size="xs">Today</Text>
          {showCounts && todayCount !== undefined && (
            <Badge size="xs" variant="light" color="blue">
              {todayCount}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      value: "yesterday",
      label: (
        <Group gap={4} wrap="nowrap">
          <Text size="xs">Yesterday</Text>
          {showCounts && yesterdayCount !== undefined && (
            <Badge size="xs" variant="light" color="blue">
              {yesterdayCount}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      value: "2days",
      label: (
        <Group gap={4} wrap="nowrap">
          <Text size="xs">2 Days Ago</Text>
          {showCounts && twoDaysCount !== undefined && (
            <Badge size="xs" variant="light" color="blue">
              {twoDaysCount}
            </Badge>
          )}
        </Group>
      ),
    },
  ];

  // Extended options for more date ranges
  const extendedOptions = [
    {
      value: "week",
      label: (
        <Group gap={4} wrap="nowrap">
          <Text size="xs">Last 7 Days</Text>
          {showCounts && weekCount !== undefined && (
            <Badge size="xs" variant="light" color="blue">
              {weekCount}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      value: "month",
      label: (
        <Group gap={4} wrap="nowrap">
          <Text size="xs">Last 30 Days</Text>
          {showCounts && monthCount !== undefined && (
            <Badge size="xs" variant="light" color="blue">
              {monthCount}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      value: "all",
      label: (
        <Group gap={4} wrap="nowrap">
          <Text size="xs">All Time</Text>
          {showCounts && allCount !== undefined && (
            <Badge size="xs" variant="light" color="blue">
              {allCount}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      value: "custom",
      label: (
        <Group gap={4} wrap="nowrap">
          <Text size="xs">Custom Range</Text>
          {showCounts && customCount !== undefined && (
            <Badge size="xs" variant="light" color="blue">
              {customCount}
            </Badge>
          )}
        </Group>
      ),
    },
  ];

  // Mobile filter drawer
  const renderFilterDrawer = () => (
    <Drawer
      opened={showFilterDrawer}
      onClose={() => setShowFilterDrawer(false)}
      title={
        <Group>
          <IconCalendarStats size={20} />
          <Text fw={600} c="blue.7">
            Date Filter
          </Text>
        </Group>
      }
      position="bottom"
      size="70%"
    >
      <Stack>
        <Box
          style={{
            padding: "10px",
            borderRadius: "8px",
            backgroundColor: "var(--mantine-color-default)",
            marginBottom: "10px",
          }}
        >
          <Text fw={500} size="sm" c="blue.7" mb="xs">
            Currently Viewing:
          </Text>
          <Text size="lg" fw={700} c="blue.7">
            {dateRangeInfo.label}
          </Text>
          {dateRange === "custom" && customDateRange && (
            <Text size="sm" c="dimmed">
              {customDateRange.startDate.toLocaleDateString()} -{" "}
              {customDateRange.endDate.toLocaleDateString()}
            </Text>
          )}
        </Box>

        <Text fw={500} size="sm" c="blue.7">
          Quick Filters
        </Text>
        <Group grow>
          {basicOptions.map((option) => (
            <Button
              key={option.value}
              variant={dateRange === option.value ? "light" : "outline"}
              onClick={() => handleValueChange(option.value)}
              fullWidth
              color={dateRange === option.value ? "blue" : "gray"}
              styles={(theme) => ({
                root: {
                  transition: "all 0.2s ease",
                  transform:
                    dateRange === option.value ? "scale(1.02)" : "none",
                  boxShadow:
                    dateRange === option.value ? theme.shadows.sm : "none",
                  backgroundColor:
                    dateRange === option.value
                      ? theme.colors.blue[0]
                      : theme.white,
                  borderColor:
                    dateRange === option.value
                      ? theme.colors.blue[3]
                      : theme.colors.gray[3],
                  color:
                    dateRange === option.value
                      ? theme.colors.blue[8]
                      : theme.colors.gray[7],
                  "&:hover": {
                    transform: "scale(1.02)",
                    backgroundColor:
                      dateRange === option.value
                        ? theme.colors.blue[1]
                        : theme.colors.gray[0],
                    borderColor:
                      dateRange === option.value
                        ? theme.colors.blue[4]
                        : theme.colors.gray[4],
                  },
                },
              })}
            >
              {option.label}
            </Button>
          ))}
        </Group>

        <Text fw={500} size="sm" c="blue.7" mt="md">
          More Options
        </Text>
        <Group grow>
          {extendedOptions.map((option) => (
            <Button
              key={option.value}
              variant={dateRange === option.value ? "light" : "outline"}
              onClick={() => handleValueChange(option.value)}
              fullWidth
              color={dateRange === option.value ? "blue" : "gray"}
              styles={(theme) => ({
                root: {
                  transition: "all 0.2s ease",
                  transform:
                    dateRange === option.value ? "scale(1.02)" : "none",
                  boxShadow:
                    dateRange === option.value ? theme.shadows.sm : "none",
                  backgroundColor:
                    dateRange === option.value
                      ? theme.colors.blue[0]
                      : theme.white,
                  borderColor:
                    dateRange === option.value
                      ? theme.colors.blue[3]
                      : theme.colors.gray[3],
                  color:
                    dateRange === option.value
                      ? theme.colors.blue[8]
                      : theme.colors.gray[7],
                  "&:hover": {
                    transform: "scale(1.02)",
                    backgroundColor:
                      dateRange === option.value
                        ? theme.colors.blue[1]
                        : theme.colors.gray[0],
                    borderColor:
                      dateRange === option.value
                        ? theme.colors.blue[4]
                        : theme.colors.gray[4],
                  },
                },
              })}
            >
              {option.label}
            </Button>
          ))}
        </Group>
      </Stack>
    </Drawer>
  );

  // Desktop view with SegmentedControl
  const renderDesktopFilter = () => (
    <Group align="center" wrap="wrap" justify="space-between">
      <Group gap="xs">
        <IconCalendar size={18} />
        <Text size="sm" fw={500}>
          Viewing:{" "}
          <Text span c="blue.7">
            {dateRangeInfo.label}
          </Text>
        </Text>

        <Tooltip
          label="Filter your view by date range"
          position="right"
          withArrow
        >
          <IconInfoCircle size={16} style={{ opacity: 0.5 }} />
        </Tooltip>
      </Group>

      <Group>
        <SegmentedControl
          value={dateRange}
          onChange={handleValueChange}
          data={basicOptions}
          size="xs"
          radius="md"
        />

        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button
              variant="light"
              size="xs"
              rightSection={<IconChevronDown size={14} />}
              color="blue"
            >
              More Options
            </Button>
          </Menu.Target>

          <Menu.Dropdown>
            {extendedOptions.map((option) => (
              <Menu.Item
                key={option.value}
                onClick={() => handleValueChange(option.value)}
                rightSection={
                  dateRange === option.value ? (
                    <Badge size="xs" variant="filled" color="blue">
                      Selected
                    </Badge>
                  ) : null
                }
              >
                {option.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );

  // Mobile view with filter button
  const renderMobileFilter = () => (
    <Group justify="space-between" align="center">
      <Group gap="xs">
        <IconCalendar size={18} />
        <Text size="sm" fw={500}>
          Viewing:{" "}
          <Text span c="blue.7">
            {dateRangeInfo.label}
          </Text>
        </Text>
      </Group>

      <Button
        variant="light"
        color="blue"
        onClick={() => setShowFilterDrawer(true)}
        radius="xl"
        size="sm"
        leftSection={<IconFilter size={16} />}
      >
        Filter
      </Button>
    </Group>
  );

  return (
    <>
      {/* Desktop view (hidden on mobile) */}
      <Box hiddenFrom="sm">{renderMobileFilter()}</Box>

      {/* Mobile view (hidden on desktop) */}
      <Box visibleFrom="sm">{renderDesktopFilter()}</Box>

      {/* Custom Date Range Modal */}
      <Modal
        opened={showCustomModal}
        onClose={handleModalClose}
        title={
          <Group>
            <IconCalendarStats size={20} color="var(--mantine-color-blue-7)" />
            <Text fw={600} c="blue.7">
              Custom Date Range
            </Text>
          </Group>
        }
        centered
        size="sm"
      >
        <Stack>
          <Text size="sm" c="dimmed" mb="md">
            Select a custom date range to view your data for a specific period.
          </Text>

          <Box
            style={{
              padding: "15px",
              borderRadius: "12px",
              backgroundColor: "var(--mantine-color-blue-0)",
              marginBottom: "15px",
              border: "1px solid var(--mantine-color-blue-2)",
            }}
          >
            <Group>
              <div style={{ flex: 1 }}>
                <Text size="sm" fw={500} c="blue.7" mb={5}>
                  Start Date
                </Text>
                <input
                  type="date"
                  value={startDate ? startDate.toISOString().split("T")[0] : ""}
                  onChange={(e) =>
                    setStartDate(
                      e.target.value ? new Date(e.target.value) : null
                    )
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid var(--mantine-color-default-border)",
                    fontSize: "14px",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Text size="sm" fw={500} c="blue.7" mb={5}>
                  End Date
                </Text>
                <input
                  type="date"
                  value={endDate ? endDate.toISOString().split("T")[0] : ""}
                  onChange={(e) =>
                    setEndDate(e.target.value ? new Date(e.target.value) : null)
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid var(--mantine-color-default-border)",
                    fontSize: "14px",
                  }}
                  min={startDate ? startDate.toISOString().split("T")[0] : ""}
                />
              </div>
            </Group>
          </Box>

          {startDate && endDate && (
            <Box
              style={{
                padding: "10px",
                borderRadius: "6px",
                backgroundColor: "var(--mantine-color-blue-light)",
                marginBottom: "10px",
              }}
            >
              <Text size="sm" fw={500} c="blue.7">
                Selected Range:
              </Text>
              <Text size="sm">
                {startDate.toLocaleDateString()} to{" "}
                {endDate.toLocaleDateString()} (
                {Math.round(
                  (endDate.getTime() - startDate.getTime()) /
                    (1000 * 60 * 60 * 24) +
                    1
                )}{" "}
                days)
              </Text>
            </Box>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={handleModalClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCustomRangeSelect}
              disabled={!startDate || !endDate}
              color="blue"
            >
              Apply Range
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Mobile Filter Drawer */}
      {renderFilterDrawer()}
    </>
  );
}
