/**
 * Trading Day Enforcement
 * Ensures employees cannot start a new trading day without completing previous EOD
 */

import { isPreviousDayEODCompletedForUser } from "./eodDB";

export interface TradingDayStatus {
  canTrade: boolean;
  blocked: boolean;
  message?: string;
  previousDayDate?: string;
  eodRecordId?: string;
}

/**
 * Check if trading is allowed for a user (their previous day EOD must be completed)
 */
export async function checkTradingDayStatus(
  userId: string,
  shopId?: string
): Promise<TradingDayStatus> {
  try {
    const previousDayStatus = await isPreviousDayEODCompletedForUser(
      userId,
      shopId
    );

    if (!previousDayStatus.completed) {
      return {
        canTrade: false,
        blocked: true,
        message: `Please complete your End of Day (EOD) for ${
          previousDayStatus.date || "previous day"
        } before starting a new trading day.`,
        previousDayDate: previousDayStatus.date,
        eodRecordId: previousDayStatus.record?._id,
      };
    }

    return {
      canTrade: true,
      blocked: false,
    };
  } catch (error) {
    console.error("Error checking trading day status:", error);
    // On error, allow trading (fail open)
    return {
      canTrade: true,
      blocked: false,
    };
  }
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().split("T")[0];
}

/**
 * Get previous business day date
 */
export function getPreviousBusinessDay(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  return yesterday.toISOString().split("T")[0];
}

/**
 * Format date for display
 */
export function formatDateForDisplay(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
