/**
 * Trading Day Enforcement
 * Ensures employees cannot start a new trading day without completing previous EOD
 */

import { isPreviousDayEODCompletedForUser } from "./eodDB";
import { getSalesDB, getPurchasesDB } from "./databases";
import { addShopIdFilter } from "./queryHelpers";

export interface TradingDayStatus {
  canTrade: boolean;
  blocked: boolean;
  message?: string;
  previousDayDate?: string;
  eodRecordId?: string;
}

/**
 * Check if a user had any transactions (sales or purchases) on a specific date
 */
async function userHadTransactionsOnDate(
  userId: string,
  date: string,
  shopId?: string
): Promise<boolean> {
  try {
    const salesDB = await getSalesDB();
    const purchasesDB = await getPurchasesDB();

    // Get date range for the day
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Check for sales created by this user on this date
    const salesResult = await salesDB.find({
      selector: addShopIdFilter(
        {
          type: "sale",
          createdBy: userId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
        shopId
      ),
      limit: 1, // We only need to know if any exist
    });

    // Check for purchases created by this user on this date
    const purchasesResult = await purchasesDB.find({
      selector: addShopIdFilter(
        {
          type: "purchase",
          createdBy: userId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
        shopId
      ),
      limit: 1, // We only need to know if any exist
    });

    // Return true if user had any sales or purchases on this date
    return salesResult.docs.length > 0 || purchasesResult.docs.length > 0;
  } catch (error) {
    console.error("Error checking user transactions for date:", error);
    // On error, assume they didn't transact (fail closed for safety)
    return false;
  }
}

/**
 * Check if trading is allowed for a user (their previous day EOD must be completed)
 * Only requires EOD if the user actually transacted on the previous day
 */
export async function checkTradingDayStatus(
  userId: string,
  shopId?: string
): Promise<TradingDayStatus> {
  try {
    // Get previous day date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // First, check if the user had any transactions on the previous day
    const hadTransactions = await userHadTransactionsOnDate(
      userId,
      yesterdayStr,
      shopId
    );

    // If user didn't transact on previous day, they don't need to complete EOD
    if (!hadTransactions) {
      return {
        canTrade: true,
        blocked: false,
      };
    }

    // User transacted, so check if EOD is completed
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
