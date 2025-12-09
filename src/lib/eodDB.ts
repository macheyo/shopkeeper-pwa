import { getEODDB } from "./databases";
import { EODCashRecord, CashSurrender } from "@/types/eod";
import { addShopIdFilter } from "./queryHelpers";

/**
 * Get EOD record for a specific date and user
 */
export async function getEODRecord(
  date: string,
  userId: string,
  shopId?: string
): Promise<EODCashRecord | null> {
  try {
    const eodDB = await getEODDB();
    const dateStr = date.split("T")[0]; // Ensure YYYY-MM-DD format

    const result = await eodDB.find({
      selector: addShopIdFilter(
        {
          type: "eod_cash_record",
          date: dateStr,
          userId: userId,
        },
        shopId
      ),
      limit: 1,
    });

    if (result.docs.length > 0) {
      return result.docs[0] as EODCashRecord;
    }
    return null;
  } catch (error) {
    console.error("Error getting EOD record:", error);
    throw error;
  }
}

/**
 * Get the most recent EOD record for a specific user
 */
export async function getLatestEODRecordForUser(
  userId: string,
  shopId?: string
): Promise<EODCashRecord | null> {
  try {
    const eodDB = await getEODDB();

    const result = await eodDB.find({
      selector: addShopIdFilter(
        {
          type: "eod_cash_record",
          userId: userId,
        },
        shopId
      ),
    });

    if (result.docs.length > 0) {
      // Sort by date descending and return the most recent
      const sorted = (result.docs as EODCashRecord[]).sort(
        (a, b) => b.date.localeCompare(a.date)
      );
      return sorted[0];
    }
    return null;
  } catch (error) {
    console.error("Error getting latest EOD record for user:", error);
    throw error;
  }
}

/**
 * Get EOD records for a date range (optionally filtered by user)
 */
export async function getEODRecords(
  startDate: string,
  endDate: string,
  shopId?: string,
  userId?: string
): Promise<EODCashRecord[]> {
  try {
    const eodDB = await getEODDB();
    const startDateStr = startDate.split("T")[0];
    const endDateStr = endDate.split("T")[0];

    const selector: {
      type: string;
      date: { $gte: string; $lte: string };
      userId?: string;
    } = {
      type: "eod_cash_record",
      date: {
        $gte: startDateStr,
        $lte: endDateStr,
      },
    };

    // Filter by user if provided
    if (userId) {
      selector.userId = userId;
    }

    const result = await eodDB.find({
      selector: addShopIdFilter(selector, shopId),
    });

    // Sort by date descending, then userId ascending
    const sorted = (result.docs as EODCashRecord[]).sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.userId.localeCompare(b.userId);
    });

    return sorted;
  } catch (error) {
    console.error("Error getting EOD records:", error);
    throw error;
  }
}

/**
 * Save EOD record
 */
export async function saveEODRecord(
  eodRecord: EODCashRecord
): Promise<EODCashRecord> {
  try {
    const eodDB = await getEODDB();

    // Check if record already exists (for this user and date)
    const existing = await getEODRecord(
      eodRecord.date,
      eodRecord.userId,
      eodRecord.shopId
    );
    if (existing) {
      // Update existing record
      const updated = {
        ...eodRecord,
        _id: existing._id,
        _rev: existing._rev,
        updatedAt: new Date().toISOString(),
      };
      await eodDB.put(updated);
      return updated;
    } else {
      // Create new record
      const now = new Date().toISOString();
      const newRecord: EODCashRecord = {
        ...eodRecord,
        _id: `eod_${eodRecord.date}_${eodRecord.userId}`,
        createdAt: now,
        updatedAt: now,
      };
      await eodDB.put(newRecord);
      return newRecord;
    }
  } catch (error) {
    console.error("Error saving EOD record:", error);
    throw error;
  }
}

/**
 * Save cash surrender record
 */
export async function saveCashSurrender(
  surrender: CashSurrender
): Promise<CashSurrender> {
  try {
    const eodDB = await getEODDB();

    const now = new Date().toISOString();
    const newSurrender: CashSurrender = {
      ...surrender,
      _id: `surrender_${surrender.timestamp}`,
      createdAt: now,
      updatedAt: now,
    };

    await eodDB.put(newSurrender);
    return newSurrender;
  } catch (error) {
    console.error("Error saving cash surrender:", error);
    throw error;
  }
}

/**
 * Get cash surrenders for an EOD record
 */
export async function getCashSurrendersForEOD(
  eodRecordId: string
): Promise<CashSurrender[]> {
  try {
    const eodDB = await getEODDB();

    const result = await eodDB.find({
      selector: {
        type: "cash_surrender",
        eodRecordId: eodRecordId,
      },
    });

    // Sort by timestamp descending
    const sorted = (result.docs as CashSurrender[]).sort(
      (a, b) => b.timestamp.localeCompare(a.timestamp)
    );

    return sorted;
  } catch (error) {
    console.error("Error getting cash surrenders:", error);
    throw error;
  }
}

/**
 * Check if previous day EOD is completed for a specific user
 */
export async function isPreviousDayEODCompletedForUser(
  userId: string,
  shopId?: string
): Promise<{ completed: boolean; date?: string; record?: EODCashRecord }> {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const record = await getEODRecord(yesterdayStr, userId, shopId);

    if (!record) {
      return { completed: false, date: yesterdayStr };
    }

    return {
      completed: record.status === "completed" || record.status === "verified",
      date: yesterdayStr,
      record,
    };
  } catch (error) {
    console.error("Error checking previous day EOD for user:", error);
    return { completed: false };
  }
}
