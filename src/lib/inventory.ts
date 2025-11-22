import { getInventoryLotsDB } from "./databases";
import {
  InventoryLot,
  PurchaseItem,
  SaleItem,
  PurchaseDoc,
  SaleDoc,
} from "@/types";
import { Money } from "@/types/money";

/**
 * Create inventory lots from a purchase
 */
export async function createInventoryLots(
  purchaseRunId: string,
  purchaseTimestamp: string,
  items: PurchaseItem[],
  supplier?: string
): Promise<InventoryLot[]> {
  const lotsDB = await getInventoryLotsDB();
  const now = new Date().toISOString();
  const lots: InventoryLot[] = [];

  for (const item of items) {
    const lotId = `lot_${purchaseRunId}_${
      item.productId
    }_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const lot: InventoryLot = {
      _id: lotId,
      type: "inventory_lot",
      productId: item.productId,
      productName: item.productName,
      productCode: item.productCode,
      purchaseRunId,
      purchaseTimestamp,
      quantity: item.qty,
      remainingQuantity: item.qty, // Initially all remaining
      costPrice: item.costPrice,
      supplier,
      createdAt: now,
      updatedAt: now,
    };

    await lotsDB.put(lot);
    lots.push(lot);
  }

  return lots;
}

/**
 * Get available inventory lots for a product (FIFO order - oldest first)
 */
export async function getAvailableLotsForProduct(
  productId: string
): Promise<InventoryLot[]> {
  const lotsDB = await getInventoryLotsDB();

  const result = await lotsDB.find({
    selector: {
      type: "inventory_lot",
      productId,
      remainingQuantity: { $gt: 0 }, // Only lots with remaining stock
    },
  });

  // Sort in JavaScript for FIFO (oldest first)
  const lots = result.docs as InventoryLot[];
  return lots.sort(
    (a, b) =>
      new Date(a.purchaseTimestamp).getTime() -
      new Date(b.purchaseTimestamp).getTime()
  );
}

/**
 * Allocate inventory using FIFO method for a sale item
 * Returns the lots used and updates their remaining quantities
 */
export async function allocateInventoryFIFO(
  productId: string,
  quantity: number
): Promise<
  Array<{
    lotId: string;
    purchaseRunId: string;
    quantity: number;
    costPrice: Money;
  }>
> {
  const lotsDB = await getInventoryLotsDB();
  const availableLots = await getAvailableLotsForProduct(productId);

  if (availableLots.length === 0) {
    throw new Error(`No inventory available for product ${productId}`);
  }

  let remainingToAllocate = quantity;
  const lotsUsed: Array<{
    lotId: string;
    purchaseRunId: string;
    quantity: number;
    costPrice: Money;
  }> = [];

  // Allocate from oldest lots first (FIFO)
  for (const lot of availableLots) {
    if (remainingToAllocate <= 0) break;

    const quantityFromThisLot = Math.min(
      lot.remainingQuantity,
      remainingToAllocate
    );

    // Update lot remaining quantity
    const updatedLot = {
      ...lot,
      remainingQuantity: lot.remainingQuantity - quantityFromThisLot,
      updatedAt: new Date().toISOString(),
    };
    await lotsDB.put(updatedLot);

    lotsUsed.push({
      lotId: lot._id,
      purchaseRunId: lot.purchaseRunId,
      quantity: quantityFromThisLot,
      costPrice: lot.costPrice,
    });

    remainingToAllocate -= quantityFromThisLot;
  }

  if (remainingToAllocate > 0) {
    throw new Error(
      `Insufficient inventory for product ${productId}. Requested: ${quantity}, Available: ${
        quantity - remainingToAllocate
      }`
    );
  }

  return lotsUsed;
}

/**
 * Get lots for a specific purchase run
 */
export async function getLotsByPurchaseRun(
  purchaseRunId: string
): Promise<InventoryLot[]> {
  const lotsDB = await getInventoryLotsDB();

  const result = await lotsDB.find({
    selector: {
      type: "inventory_lot",
      purchaseRunId,
    },
  });

  // Sort in JavaScript by purchaseTimestamp (oldest first)
  const lots = result.docs as InventoryLot[];
  return lots.sort(
    (a, b) =>
      new Date(a.purchaseTimestamp).getTime() -
      new Date(b.purchaseTimestamp).getTime()
  );
}

/**
 * Get sales that used items from a specific purchase run
 */
export async function getSalesForPurchaseRun(
  purchaseRunId: string
): Promise<Array<{ saleId: string; timestamp: string; items: SaleItem[] }>> {
  const { getSalesDB } = await import("./databases");
  const salesDB = await getSalesDB();

  // Get all sales and filter those that used items from this purchase run
  const allSales = await salesDB.find({
    selector: {
      type: "sale",
    },
  });

  const relevantSales = (allSales.docs as SaleDoc[]).filter((sale) => {
    return sale.items?.some((item: SaleItem) =>
      item.lotsUsed?.some((lot) => lot.purchaseRunId === purchaseRunId)
    );
  });

  return relevantSales.map((sale) => ({
    saleId: sale._id,
    timestamp: sale.timestamp,
    items: sale.items.filter((item: SaleItem) =>
      item.lotsUsed?.some((lot) => lot.purchaseRunId === purchaseRunId)
    ),
  }));
}

/**
 * Calculate purchase run progress with additional metrics
 */
export async function getPurchaseRunProgress(purchaseRunId: string): Promise<{
  totalPurchased: number;
  totalSold: number;
  totalRemaining: number;
  progressPercentage: number;
  // Financial metrics
  totalCost: Money;
  totalRevenue: Money;
  totalProfit: Money;
  expectedRevenue: Money;
  expectedProfit: Money;
  roi: number; // Return on Investment percentage
  expectedRoi: number;
  // Time metrics
  purchaseDate: string;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  daysSincePurchase: number;
  daysToFirstSale: number | null;
  daysToTurnover: number | null; // Days to sell all items (null if not all sold)
  averageDaysToSell: number | null; // Average days from purchase to sale per item
  turnoverRate: number; // Items sold per day
  daysOfInventoryRemaining: number | null; // Based on current sell rate
  // Additional metrics
  sellThroughRate: number; // Percentage of inventory sold
  items: Array<{
    productId: string;
    productName: string;
    productCode: string;
    purchased: number;
    sold: number;
    remaining: number;
  }>;
}> {
  const lots = await getLotsByPurchaseRun(purchaseRunId);
  const sales = await getSalesForPurchaseRun(purchaseRunId);

  if (lots.length === 0) {
    throw new Error(
      `No inventory lots found for purchase run ${purchaseRunId}`
    );
  }

  // Get purchase date from first lot
  const purchaseDate = lots[0].purchaseTimestamp;
  const purchaseDateObj = new Date(purchaseDate);
  const now = new Date();
  const daysSincePurchase = Math.floor(
    (now.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Group lots by product
  const productMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      productCode: string;
      purchased: number;
      remaining: number;
    }
  >();

  for (const lot of lots) {
    const existing = productMap.get(lot.productId);
    if (existing) {
      existing.purchased += lot.quantity;
      existing.remaining += lot.remainingQuantity;
    } else {
      productMap.set(lot.productId, {
        productId: lot.productId,
        productName: lot.productName,
        productCode: lot.productCode,
        purchased: lot.quantity,
        remaining: lot.remainingQuantity,
      });
    }
  }

  // Calculate sold quantities from sales and track sale dates
  const soldMap = new Map<string, number>();
  const saleDates: Date[] = [];
  let totalCostAmount = 0;
  let totalRevenueAmount = 0;
  let totalProfitAmount = 0;
  const saleItemDates: Array<{ date: Date; quantity: number }> = [];

  // Calculate total cost from lots
  for (const lot of lots) {
    totalCostAmount += lot.costPrice.amount * lot.quantity;
  }

  for (const sale of sales) {
    const saleDate = new Date(sale.timestamp);

    for (const item of sale.items) {
      if (item.lotsUsed && item.lotsUsed.length > 0) {
        // Track sale date only once per sale
        if (!saleDates.some((d) => d.getTime() === saleDate.getTime())) {
          saleDates.push(saleDate);
        }

        for (const lot of item.lotsUsed) {
          if (lot.purchaseRunId === purchaseRunId) {
            const current = soldMap.get(item.productId) || 0;
            soldMap.set(item.productId, current + lot.quantity);

            // Track revenue and profit
            const itemRevenue = item.price.amount * lot.quantity;
            const itemCost = lot.costPrice.amount * lot.quantity;
            totalRevenueAmount += itemRevenue;
            totalProfitAmount += itemRevenue - itemCost;

            // Track sale dates for turnover calculation
            saleItemDates.push({
              date: saleDate,
              quantity: lot.quantity,
            });
          }
        }
      }
    }
  }

  // Combine data
  const items = Array.from(productMap.values()).map((product) => ({
    ...product,
    sold: soldMap.get(product.productId) || 0,
  }));

  const totalPurchased = items.reduce((sum, item) => sum + item.purchased, 0);
  const totalSold = items.reduce((sum, item) => sum + item.sold, 0);
  const totalRemaining = items.reduce((sum, item) => sum + item.remaining, 0);
  const progressPercentage =
    totalPurchased > 0 ? (totalSold / totalPurchased) * 100 : 0;
  const sellThroughRate = progressPercentage;

  // Calculate time metrics
  saleDates.sort((a, b) => a.getTime() - b.getTime());
  const firstSaleDate = saleDates.length > 0 ? saleDates[0] : null;
  const lastSaleDate =
    saleDates.length > 0 ? saleDates[saleDates.length - 1] : null;

  const daysToFirstSale = firstSaleDate
    ? Math.floor(
        (firstSaleDate.getTime() - purchaseDateObj.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  // Days to turnover (when all items are sold)
  const daysToTurnover =
    totalRemaining === 0 && lastSaleDate
      ? Math.floor(
          (lastSaleDate.getTime() - purchaseDateObj.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  // Average days to sell (weighted by quantity)
  let averageDaysToSell: number | null = null;
  if (saleItemDates.length > 0) {
    let totalDays = 0;
    let totalQuantity = 0;
    for (const saleItem of saleItemDates) {
      const days = Math.floor(
        (saleItem.date.getTime() - purchaseDateObj.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      totalDays += days * saleItem.quantity;
      totalQuantity += saleItem.quantity;
    }
    averageDaysToSell = totalQuantity > 0 ? totalDays / totalQuantity : null;
  }

  // Turnover rate (items sold per day)
  // Use actual days since purchase, but ensure we have at least 1 day to avoid division by zero
  const actualDaysSincePurchase = Math.max(1, daysSincePurchase);
  const turnoverRate =
    totalSold > 0 && actualDaysSincePurchase > 0
      ? totalSold / actualDaysSincePurchase
      : 0;

  // Days of inventory remaining (based on current sell rate)
  const daysOfInventoryRemaining =
    turnoverRate > 0 ? Math.ceil(totalRemaining / turnoverRate) : null;

  // Calculate ROI
  const roi =
    totalCostAmount > 0 ? (totalProfitAmount / totalCostAmount) * 100 : 0;

  // Calculate expected revenue and profit (from purchase items with intended selling price)
  // We need to get the purchase document to get intended selling prices
  const { getPurchasesDB } = await import("./databases");
  const purchasesDB = await getPurchasesDB();
  const purchaseDoc = (await purchasesDB
    .get(purchaseRunId)
    .catch(() => null)) as PurchaseDoc | null;

  let expectedRevenueAmount = 0;
  let expectedProfitAmount = 0;

  if (purchaseDoc && purchaseDoc.items) {
    const purchaseItems = purchaseDoc.items;
    for (const item of purchaseItems) {
      const costAmount = item.costPrice.amount * item.qty;
      const sellingAmount = item.intendedSellingPrice
        ? item.intendedSellingPrice.amount * item.qty
        : costAmount; // Fallback to cost if no selling price
      expectedRevenueAmount += sellingAmount;
      expectedProfitAmount += sellingAmount - costAmount;
    }
  }

  const expectedRoi =
    totalCostAmount > 0 ? (expectedProfitAmount / totalCostAmount) * 100 : 0;

  // Use the currency from the first lot
  const baseCurrency = lots[0].costPrice.currency;
  const exchangeRate = lots[0].costPrice.exchangeRate;

  return {
    totalPurchased,
    totalSold,
    totalRemaining,
    progressPercentage,
    totalCost: {
      amount: totalCostAmount,
      currency: baseCurrency,
      exchangeRate,
    },
    totalRevenue: {
      amount: totalRevenueAmount,
      currency: baseCurrency,
      exchangeRate,
    },
    totalProfit: {
      amount: totalProfitAmount,
      currency: baseCurrency,
      exchangeRate,
    },
    expectedRevenue: {
      amount: expectedRevenueAmount,
      currency: baseCurrency,
      exchangeRate,
    },
    expectedProfit: {
      amount: expectedProfitAmount,
      currency: baseCurrency,
      exchangeRate,
    },
    roi,
    expectedRoi,
    purchaseDate,
    firstSaleDate: firstSaleDate?.toISOString() || null,
    lastSaleDate: lastSaleDate?.toISOString() || null,
    daysSincePurchase,
    daysToFirstSale,
    daysToTurnover,
    averageDaysToSell,
    turnoverRate,
    daysOfInventoryRemaining,
    sellThroughRate,
    items,
  };
}
