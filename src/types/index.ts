import { Money } from "./money";

export type PaymentMethod = "cash" | "bank" | "mobile_money" | "credit";

export interface CashInHand extends PouchDB.Core.Document<object> {
  _id: string;
  _rev: string;
  type: "cash_in_hand";
  amount: Money;
  expectedAmount: Money;
  difference: Money;
  timestamp: string; // ISO 8601 format
  notes?: string;
  status: "pending" | "synced" | "failed";
}

// Define the structure for a Product document stored in PouchDB
export interface ProductDoc extends PouchDB.Core.Document<object> {
  _id: string;
  _rev: string;
  type: "product";
  code: string; // unique
  name: string;
  price: Money; // Using Money type instead of number
  barcode?: string; // optional
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
  stockQuantity: number; // Current stock level
  purchasePrice: Money; // Latest purchase price
  purchaseDate: string; // ISO 8601 format of last purchase
  reorderPoint?: number; // Optional minimum stock level for reorder
}

// Define the structure for a sale item
export interface SaleItem {
  productId: string; // Corresponds to ProductDoc._id
  productName: string; // For display purposes
  productCode: string; // For reference
  qty: number;
  price: Money; // Price at the time of sale using Money type
  total: Money; // Total for this item using Money type
  costPrice: Money; // Purchase price at time of sale for profit calculation
  purchaseDate: string; // When the item was purchased
}

// Define the structure for a Sale document stored in PouchDB
export interface SaleDoc extends PouchDB.Core.Document<object> {
  _id: string;
  _rev: string;
  type: "sale";
  items: SaleItem[]; // Array of sale items
  totalAmount: Money; // Total amount for all items
  totalCost: Money; // Total cost of items sold
  profit: Money; // Profit from this sale
  paymentMethod: PaymentMethod;
  cashReceived?: Money; // Optional for non-cash or later payment
  change?: Money; // Optional
  timestamp: string; // ISO 8601 format
  status: "pending" | "synced" | "failed"; // Sync status
}

// Define the structure for a purchase item
export interface PurchaseItem {
  productId: string; // Corresponds to ProductDoc._id
  productName: string; // For display purposes
  productCode: string; // For reference
  qty: number;
  costPrice: Money; // Purchase price per unit
  total: Money; // Total cost for this item
  intendedSellingPrice: Money; // Planned selling price
  expectedProfit: Money; // Expected profit per unit
}

// Define the structure for a Purchase document stored in PouchDB
export interface PurchaseDoc extends PouchDB.Core.Document<object> {
  _id: string;
  _rev: string;
  type: "purchase";
  purchaseRunId: string; // Group purchases made together
  items: PurchaseItem[]; // Array of purchase items
  totalAmount: Money; // Total amount for all items
  paymentMethod: PaymentMethod;
  supplier?: string; // Optional supplier information
  notes?: string; // Optional notes about the purchase
  timestamp: string; // ISO 8601 format
  status: "pending" | "synced" | "failed"; // Sync status
}

// Define structure for financial statements
export interface FinancialPeriod {
  startDate: string; // ISO 8601 format
  endDate: string; // ISO 8601 format
}

export interface ProfitLossStatement extends FinancialPeriod {
  revenue: Money;
  costOfGoodsSold: Money;
  grossProfit: Money;
  expenses: {
    [key: string]: Money; // Categorized expenses
  };
  netProfit: Money;
}

export interface CashFlowStatement extends FinancialPeriod {
  operatingActivities: {
    cashFromSales: Money;
    cashForPurchases: Money;
    cashForExpenses: Money;
    netOperatingCash: Money;
  };
  netCashFlow: Money;
  openingBalance: Money;
  closingBalance: Money;
}

export interface BalanceSheet extends FinancialPeriod {
  assets: {
    inventory: Money;
    cash: Money;
    accountsReceivable: Money;
    totalAssets: Money;
  };
  liabilities: {
    accountsPayable: Money;
    totalLiabilities: Money;
  };
  equity: {
    ownersEquity: Money;
    retainedEarnings: Money;
    totalEquity: Money;
  };
}

export interface PurchaseRunAnalysis {
  purchaseRunId: string;
  timestamp: string;
  totalPurchaseAmount: Money;
  itemsSold: number;
  itemsRemaining: number;
  revenue: Money;
  profit: Money;
  profitMargin: number; // Percentage
  roi: number; // Return on Investment percentage
  averageTimeToSell: number; // Average days from purchase to sale
  itemsWithTimeToSell: Array<{
    productId: string;
    productName: string;
    purchaseDate: string;
    saleDate: string;
    daysToSell: number;
  }>;
}
