import { DateRange, CustomDateRange } from "@/components/DateFilter";
import {
  BASE_CURRENCY,
  CurrencyCode,
  createMoney,
  formatMoney,
} from "@/types/money";

// Interface for sales target
export interface SalesTarget {
  amount: number;
  currency: CurrencyCode;
  date: string; // ISO date string (YYYY-MM-DD)
  achieved: boolean;
}

// Interface for aggregated sales target
export interface AggregatedTarget {
  totalAmount: number;
  currency: CurrencyCode;
  startDate: string;
  endDate: string;
  achieved: boolean;
  daysCount: number;
  targets: SalesTarget[];
}

const STORAGE_KEY_CURRENT = "currentSalesTarget";
const STORAGE_KEY_HISTORY = "salesTargetHistory";
const STORAGE_KEY_WEEKLY = "weeklySalesTargets";
const STORAGE_KEY_MONTHLY = "monthlySalesTargets";

/**
 * Get the current day's sales target
 */
export function getCurrentTarget(): SalesTarget | null {
  if (typeof window === "undefined") return null;

  const targetJson = localStorage.getItem(STORAGE_KEY_CURRENT);
  if (!targetJson) return null;

  try {
    const target = JSON.parse(targetJson) as SalesTarget;
    return target;
  } catch (error) {
    console.error("Error parsing current target:", error);
    return null;
  }
}

/**
 * Get target history
 */
export function getTargetHistory(): SalesTarget[] {
  if (typeof window === "undefined") return [];

  const historyJson = localStorage.getItem(STORAGE_KEY_HISTORY);
  if (!historyJson) return [];

  try {
    return JSON.parse(historyJson) as SalesTarget[];
  } catch (error) {
    console.error("Error parsing target history:", error);
    return [];
  }
}

/**
 * Save a target to history
 */
export function saveTargetToHistory(target: SalesTarget): void {
  if (typeof window === "undefined") return;

  const history = getTargetHistory();
  const updatedHistory = [target, ...history].slice(0, 30); // Keep last 30 days
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updatedHistory));
}

/**
 * Set a new sales target for the current day
 */
export function setCurrentTarget(amount: number): SalesTarget {
  if (typeof window === "undefined") throw new Error("Cannot run on server");

  const today = new Date().toISOString().split("T")[0];
  const newTarget: SalesTarget = {
    amount,
    currency: BASE_CURRENCY,
    date: today,
    achieved: false,
  };

  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(newTarget));
  return newTarget;
}

/**
 * Update the current target's achieved status
 */
export function updateTargetAchievement(
  target: SalesTarget,
  achieved: boolean
): SalesTarget {
  if (typeof window === "undefined") throw new Error("Cannot run on server");

  const updatedTarget = {
    ...target,
    achieved,
  };

  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(updatedTarget));
  return updatedTarget;
}

/**
 * Set a weekly sales target
 */
export function setWeeklyTarget(
  weekStartDate: Date,
  amount: number
): SalesTarget {
  if (typeof window === "undefined") throw new Error("Cannot run on server");

  // Format date as YYYY-MM-DD
  const startDateStr = weekStartDate.toISOString().split("T")[0];

  // Create a target for the week
  const weeklyTarget: SalesTarget = {
    amount,
    currency: BASE_CURRENCY,
    date: startDateStr, // Use the start date of the week
    achieved: false,
  };

  // Get existing weekly targets
  const targetsJson = localStorage.getItem(STORAGE_KEY_WEEKLY);
  let weeklyTargets: Record<string, SalesTarget> = {};

  if (targetsJson) {
    try {
      weeklyTargets = JSON.parse(targetsJson);
    } catch (error) {
      console.error("Error parsing weekly targets:", error);
    }
  }

  // Add or update the target for this week
  weeklyTargets[startDateStr] = weeklyTarget;

  // Save back to localStorage
  localStorage.setItem(STORAGE_KEY_WEEKLY, JSON.stringify(weeklyTargets));

  return weeklyTarget;
}

/**
 * Set a monthly sales target
 */
export function setMonthlyTarget(
  year: number,
  month: number, // 0-11
  amount: number
): SalesTarget {
  if (typeof window === "undefined") throw new Error("Cannot run on server");

  // Create a date for the first day of the month
  const monthDate = new Date(year, month, 1);
  const monthDateStr = monthDate.toISOString().split("T")[0];

  // Create a target for the month
  const monthlyTarget: SalesTarget = {
    amount,
    currency: BASE_CURRENCY,
    date: monthDateStr,
    achieved: false,
  };

  // Get existing monthly targets
  const targetsJson = localStorage.getItem(STORAGE_KEY_MONTHLY);
  let monthlyTargets: Record<string, SalesTarget> = {};

  if (targetsJson) {
    try {
      monthlyTargets = JSON.parse(targetsJson);
    } catch (error) {
      console.error("Error parsing monthly targets:", error);
    }
  }

  // Add or update the target for this month
  const monthKey = `${year}-${month.toString().padStart(2, "0")}`;
  monthlyTargets[monthKey] = monthlyTarget;

  // Save back to localStorage
  localStorage.setItem(STORAGE_KEY_MONTHLY, JSON.stringify(monthlyTargets));

  return monthlyTarget;
}

/**
 * Get the start of the week for a given date
 */
function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get targets for a specific date range
 */
export function getTargetsForDateRange(
  startDate: Date,
  endDate: Date
): SalesTarget[] {
  if (typeof window === "undefined") return [];

  // Clone dates to avoid modifying the originals
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  // Get all targets that might be relevant
  const currentTarget = getCurrentTarget();
  const historyTargets = getTargetHistory();

  // Get weekly targets
  const weeklyTargetsJson = localStorage.getItem(STORAGE_KEY_WEEKLY);
  let weeklyTargets: Record<string, SalesTarget> = {};
  if (weeklyTargetsJson) {
    try {
      weeklyTargets = JSON.parse(weeklyTargetsJson);
    } catch (error) {
      console.error("Error parsing weekly targets:", error);
    }
  }

  // Get monthly targets
  const monthlyTargetsJson = localStorage.getItem(STORAGE_KEY_MONTHLY);
  let monthlyTargets: Record<string, SalesTarget> = {};
  if (monthlyTargetsJson) {
    try {
      monthlyTargets = JSON.parse(monthlyTargetsJson);
    } catch (error) {
      console.error("Error parsing monthly targets:", error);
    }
  }

  // Combine all targets
  const allTargets: SalesTarget[] = [];

  // Add current target if it's within range
  if (currentTarget) {
    const targetDate = new Date(currentTarget.date);
    if (targetDate >= start && targetDate < end) {
      allTargets.push(currentTarget);
    }
  }

  // Add history targets if they're within range
  historyTargets.forEach((target) => {
    const targetDate = new Date(target.date);
    if (targetDate >= start && targetDate < end) {
      allTargets.push(target);
    }
  });

  // Check if we need to include weekly targets
  const startWeek = getWeekStart(start).toISOString().split("T")[0];
  const endWeek = getWeekStart(end).toISOString().split("T")[0];

  // Add weekly targets if they're within range
  Object.keys(weeklyTargets).forEach((weekStartStr) => {
    if (weekStartStr >= startWeek && weekStartStr <= endWeek) {
      allTargets.push(weeklyTargets[weekStartStr]);
    }
  });

  // Check if we need to include monthly targets
  const startMonth = `${start.getFullYear()}-${start
    .getMonth()
    .toString()
    .padStart(2, "0")}`;
  const endMonth = `${end.getFullYear()}-${end
    .getMonth()
    .toString()
    .padStart(2, "0")}`;

  // Add monthly targets if they're within range
  Object.keys(monthlyTargets).forEach((monthKey) => {
    if (monthKey >= startMonth && monthKey <= endMonth) {
      allTargets.push(monthlyTargets[monthKey]);
    }
  });

  return allTargets;
}

/**
 * Aggregate targets for a date range
 */
export function aggregateTargets(
  startDate: Date,
  endDate: Date,
  actualRevenue: number
): AggregatedTarget | null {
  const targets = getTargetsForDateRange(startDate, endDate);

  if (targets.length === 0) return null;

  // Calculate the number of days in the range
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysCount = Math.round(
    (endDate.getTime() - startDate.getTime()) / msPerDay
  );

  // Sum up all target amounts
  let totalAmount = 0;
  targets.forEach((target) => {
    totalAmount += target.amount;
  });

  // Create the aggregated target
  const aggregatedTarget: AggregatedTarget = {
    totalAmount,
    currency: BASE_CURRENCY,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    achieved: actualRevenue >= totalAmount,
    daysCount,
    targets,
  };

  return aggregatedTarget;
}

/**
 * Get the appropriate target for the selected date range
 */
export function getTargetForDateRange(
  dateRange: DateRange,
  customDateRange: CustomDateRange | undefined,
  startDate: Date,
  endDate: Date,
  actualRevenue: number
): AggregatedTarget | SalesTarget | null {
  // For "today", return the current target
  if (dateRange === "today") {
    return getCurrentTarget();
  }

  // For other ranges, aggregate targets
  return aggregateTargets(startDate, endDate, actualRevenue);
}

/**
 * Format a target amount with appropriate label based on date range
 */
export function formatTargetAmount(
  target: AggregatedTarget | SalesTarget | null
): string {
  if (!target) return "No target set";

  // If it's an aggregated target
  if ("totalAmount" in target) {
    const amount = createMoney(target.totalAmount, target.currency);
    return formatMoney(amount);
  }

  // Single day target
  const amount = createMoney(target.amount, target.currency);
  return formatMoney(amount);
}

/**
 * Get a descriptive label for the target based on date range
 */
export function getTargetLabel(
  target: AggregatedTarget | SalesTarget | null,
  dateRange: DateRange
): string {
  if (!target) return "No Target";

  // If it's an aggregated target with multiple days
  if ("totalAmount" in target && target.daysCount > 1) {
    return `${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)} Target (${
      target.daysCount
    } days)`;
  }

  // Single day target
  switch (dateRange) {
    case "today":
      return "Today's Target";
    case "yesterday":
      return "Yesterday's Target";
    case "2days":
      return "2 Days Ago Target";
    case "week":
      return "Weekly Target";
    case "month":
      return "Monthly Target";
    case "custom":
      return "Custom Period Target";
    case "all":
      return "All-Time Target";
    default:
      return "Sales Target";
  }
}
