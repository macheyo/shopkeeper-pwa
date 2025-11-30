import { getSalesDB, getPurchasesDB, getLedgerDB } from "./databases";
import {
  getEODRecord,
  saveEODRecord,
  getLatestEODRecordForUser,
} from "./eodDB";
import {
  createVarianceLedgerEntry,
  createSurrenderLedgerEntry,
} from "./eodAccounting";
import {
  EODCashRecord,
  VarianceExplanation,
  CashSurrender,
  VarianceType,
} from "@/types/eod";
import { SaleDoc, PurchaseDoc } from "@/types";
import {
  Money,
  createMoney,
  BASE_CURRENCY,
  convertMoney,
  DEFAULT_EXCHANGE_RATES,
} from "@/types/money";
import { getShopSettings } from "./settingsDB";
import { addShopIdFilter } from "./queryHelpers";
import { getTodayDate } from "./tradingDay";

/**
 * Calculate expected closing balance for a given date and user
 */
export async function calculateExpectedClosingBalance(
  date: string,
  openingBalance: Money,
  userId: string,
  shopId?: string
): Promise<{
  expectedClosingBalance: Money;
  cashSales: Money;
  cashPurchases: Money;
  otherCashIn: Money;
  otherCashOut: Money;
}> {
  try {
    const salesDB = await getSalesDB();
    const purchasesDB = await getPurchasesDB();

    // Get date range for the day
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Get cash sales for the day created by this user
    const salesResult = await salesDB.find({
      selector: addShopIdFilter(
        {
          type: "sale",
          paymentMethod: "cash",
          createdBy: userId, // ✅ Filter by user
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
        shopId
      ),
    });

    // Get cash purchases for the day created by this user
    const purchasesResult = await purchasesDB.find({
      selector: addShopIdFilter(
        {
          type: "purchase",
          paymentMethod: "cash",
          createdBy: userId, // ✅ Filter by user
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
        shopId
      ),
    });

    // Get shop settings for currency conversion
    const settings = await getShopSettings(shopId);
    const baseCurrency = (settings?.baseCurrency || BASE_CURRENCY) as string;
    const baseExchangeRate =
      DEFAULT_EXCHANGE_RATES[
        baseCurrency as keyof typeof DEFAULT_EXCHANGE_RATES
      ] || 1;

    // Calculate totals in base currency
    const cashSales = (salesResult.docs as SaleDoc[]).reduce(
      (total: number, sale: SaleDoc) => {
        const saleInBase = convertMoney(sale.totalAmount, BASE_CURRENCY, 1);
        return total + saleInBase.amount;
      },
      0
    );

    const cashPurchases = (purchasesResult.docs as PurchaseDoc[]).reduce(
      (total: number, purchase: PurchaseDoc) => {
        const purchaseInBase = convertMoney(
          purchase.totalAmount,
          BASE_CURRENCY,
          1
        );
        return total + purchaseInBase.amount;
      },
      0
    );

    // Convert opening balance to base currency
    const openingInBase = convertMoney(openingBalance, BASE_CURRENCY, 1);

    // Calculate expected closing balance
    const expectedInBase = openingInBase.amount + cashSales - cashPurchases;

    return {
      expectedClosingBalance: createMoney(
        expectedInBase,
        baseCurrency,
        baseExchangeRate
      ),
      cashSales: createMoney(cashSales, baseCurrency, baseExchangeRate),
      cashPurchases: createMoney(cashPurchases, baseCurrency, baseExchangeRate),
      otherCashIn: createMoney(0, baseCurrency, baseExchangeRate),
      otherCashOut: createMoney(0, baseCurrency, baseExchangeRate),
    };
  } catch (error) {
    console.error("Error calculating expected closing balance:", error);
    throw error;
  }
}

/**
 * Get opening balance for a date and user (from same user's previous EOD)
 */
export async function getOpeningBalance(
  date: string,
  userId: string,
  shopId?: string
): Promise<Money> {
  try {
    // Get previous day's EOD record for this user
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split("T")[0];

    const previousEOD = await getEODRecord(previousDateStr, userId, shopId);

    if (previousEOD && previousEOD.status === "completed") {
      // Use previous day's actual cash count as opening balance
      // Subtract any cash surrendered
      const settings = await getShopSettings(shopId);
      const baseCurrency = (settings?.baseCurrency || BASE_CURRENCY) as string;
      const baseExchangeRate =
        DEFAULT_EXCHANGE_RATES[
          baseCurrency as keyof typeof DEFAULT_EXCHANGE_RATES
        ] || 1;

      const surrendered = previousEOD.cashSurrendered
        ? convertMoney(previousEOD.cashSurrendered, BASE_CURRENCY, 1).amount
        : 0;
      const actualInBase = convertMoney(
        previousEOD.actualCashCount,
        BASE_CURRENCY,
        1
      ).amount;
      const openingAmount = actualInBase - surrendered;

      return createMoney(openingAmount, baseCurrency, baseExchangeRate);
    }

    // If no previous day EOD, check for latest EOD record for this user
    const latestEOD = await getLatestEODRecordForUser(userId, shopId);
    if (latestEOD) {
      const settings = await getShopSettings(shopId);
      const baseCurrency = (settings?.baseCurrency || BASE_CURRENCY) as string;
      const baseExchangeRate =
        DEFAULT_EXCHANGE_RATES[
          baseCurrency as keyof typeof DEFAULT_EXCHANGE_RATES
        ] || 1;

      const surrendered = latestEOD.cashSurrendered
        ? convertMoney(latestEOD.cashSurrendered, BASE_CURRENCY, 1).amount
        : 0;
      const actualInBase = convertMoney(
        latestEOD.actualCashCount,
        BASE_CURRENCY,
        1
      ).amount;
      const openingAmount = actualInBase - surrendered;

      return createMoney(openingAmount, baseCurrency, baseExchangeRate);
    }

    // Default to zero if no EOD records exist for this user
    const settings = await getShopSettings(shopId);
    const baseCurrency = (settings?.baseCurrency || BASE_CURRENCY) as string;
    return createMoney(
      0,
      baseCurrency,
      DEFAULT_EXCHANGE_RATES[
        baseCurrency as keyof typeof DEFAULT_EXCHANGE_RATES
      ] || 1
    );
  } catch (error) {
    console.error("Error getting opening balance:", error);
    const settings = await getShopSettings(shopId);
    const baseCurrency = (settings?.baseCurrency || BASE_CURRENCY) as string;
    return createMoney(
      0,
      baseCurrency,
      DEFAULT_EXCHANGE_RATES[
        baseCurrency as keyof typeof DEFAULT_EXCHANGE_RATES
      ] || 1
    );
  }
}

/**
 * Determine variance type based on variance amount and explanations
 */
export function determineVarianceType(
  variance: Money,
  explanations?: VarianceExplanation[]
): VarianceType {
  const varianceAmount = Math.abs(variance.amount);

  // If variance is negligible, it's exact
  if (varianceAmount < 0.01) {
    return "exact";
  }

  // If there are explanations, it's explained
  if (explanations && explanations.length > 0) {
    return variance.amount < 0 ? "explained_shortage" : "explained_surplus";
  }

  // Otherwise, it's unexplained
  return variance.amount < 0 ? "shortage" : "surplus";
}

/**
 * Complete EOD for a date and user
 */
export async function completeEOD(
  date: string,
  actualCashCount: Money,
  userId: string,
  userName?: string,
  varianceExplanations?: VarianceExplanation[],
  cashSurrendered?: Money,
  surrenderMethod?: "bank_deposit" | "owner_collection" | "safe_deposit",
  surrenderReference?: string,
  surrenderNotes?: string,
  notes?: string,
  shopId?: string,
  completedBy?: string
): Promise<EODCashRecord> {
  try {
    // Get opening balance for this user
    const openingBalance = await getOpeningBalance(date, userId, shopId);

    // Determine opening balance source
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split("T")[0];
    const previousEOD = await getEODRecord(previousDateStr, userId, shopId);
    const openingBalanceSource = previousEOD ? "previous_day" : "manual";

    // Calculate expected closing balance for this user
    const {
      expectedClosingBalance,
      cashSales,
      cashPurchases,
      otherCashIn,
      otherCashOut,
    } = await calculateExpectedClosingBalance(
      date,
      openingBalance,
      userId,
      shopId
    );

    // Calculate variance
    const settings = await getShopSettings(shopId);
    const baseCurrency = (settings?.baseCurrency || BASE_CURRENCY) as string;
    const baseExchangeRate =
      DEFAULT_EXCHANGE_RATES[
        baseCurrency as keyof typeof DEFAULT_EXCHANGE_RATES
      ] || 1;

    const actualInBase = convertMoney(actualCashCount, BASE_CURRENCY, 1);
    const expectedInBase = convertMoney(
      expectedClosingBalance,
      BASE_CURRENCY,
      1
    );
    const varianceAmount = actualInBase.amount - expectedInBase.amount;

    const variance: Money = createMoney(
      varianceAmount,
      baseCurrency,
      baseExchangeRate
    );

    // Determine variance type
    const varianceType = determineVarianceType(variance, varianceExplanations);

    // Create EOD record
    const now = new Date().toISOString();
    const eodRecord: EODCashRecord = {
      _id: `eod_${date.split("T")[0]}_${userId}`,
      type: "eod_cash_record",
      date: date.split("T")[0], // Ensure YYYY-MM-DD format
      userId: userId, // ✅ User this EOD is for
      userName: userName, // For display
      openingBalance,
      openingBalanceSource,
      cashSales,
      cashPurchases,
      otherCashIn,
      otherCashOut,
      expectedClosingBalance,
      actualCashCount,
      variance,
      varianceType,
      varianceExplanation: varianceExplanations,
      cashSurrendered,
      surrenderMethod,
      surrenderReference,
      surrenderNotes,
      completedBy: completedBy || userId,
      completedAt: now,
      notes,
      status: "completed",
      shopId,
      createdAt: now,
      updatedAt: now,
    };

    // Create variance ledger entry if variance exists
    if (Math.abs(varianceAmount) >= 0.01) {
      const varianceLedgerEntry = await createVarianceLedgerEntry(
        eodRecord,
        shopId,
        completedBy
      );
      if (varianceLedgerEntry) {
        eodRecord.varianceLedgerEntryId = varianceLedgerEntry._id;
      }
    }

    // Create surrender ledger entry if cash was surrendered
    if (cashSurrendered && cashSurrendered.amount > 0) {
      const surrenderLedgerEntry = await createSurrenderLedgerEntry(
        eodRecord,
        shopId,
        completedBy
      );
      if (surrenderLedgerEntry) {
        eodRecord.surrenderLedgerEntryId = surrenderLedgerEntry._id;
      }
    }

    // Save EOD record
    const savedRecord = await saveEODRecord(eodRecord);

    return savedRecord;
  } catch (error) {
    console.error("Error completing EOD:", error);
    throw error;
  }
}

/**
 * Get EOD summary for today for a specific user
 */
export async function getTodayEODSummary(
  userId: string,
  shopId?: string
): Promise<{
  date: string;
  openingBalance: Money;
  cashSales: Money;
  cashPurchases: Money;
  expectedClosingBalance: Money;
  eodRecord?: EODCashRecord;
}> {
  try {
    const today = getTodayDate();
    const openingBalance = await getOpeningBalance(today, userId, shopId);
    const { expectedClosingBalance, cashSales, cashPurchases } =
      await calculateExpectedClosingBalance(
        today,
        openingBalance,
        userId,
        shopId
      );

    const eodRecord = await getEODRecord(today, userId, shopId);

    return {
      date: today,
      openingBalance,
      cashSales,
      cashPurchases,
      expectedClosingBalance,
      eodRecord: eodRecord || undefined,
    };
  } catch (error) {
    console.error("Error getting today's EOD summary:", error);
    throw error;
  }
}
