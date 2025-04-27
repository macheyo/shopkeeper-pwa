import { Money, CurrencyCode } from "./money";

export interface CashInHand {
  _id: string;
  _rev: string;
  type: "cash_in_hand";
  amount: Money;
  expectedAmount: Money;
  difference: Money;
  timestamp: string;
  notes: string;
  status: "pending" | "synced" | "failed";
}

export interface ShopSettings {
  _id?: string;
  shopName: string;
  businessType: string;
  baseCurrency: CurrencyCode;
  currencies: Array<{
    code: CurrencyCode;
    exchangeRate: number;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    type: "cash" | "mobile_money" | "bank";
    balance: number;
    currency: CurrencyCode;
  }>;
  type: "settings";
  hasCompletedOnboarding: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDoc {
  _id: string;
  _rev?: string;
  type: "product";
  code: string;
  name: string;
  description?: string;
  barcode?: string;
  price: Money; // Current selling price
  costPrice: Money; // Last purchase cost
  stockQuantity: number;
  purchaseDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  productCode: string;
  qty: number;
  costPrice: Money;
  intendedSellingPrice: Money;
  expectedProfit: Money;
  total: Money;
}

export interface PurchaseDoc {
  _id: string;
  _rev?: string;
  type: "purchase";
  purchaseRunId: string;
  timestamp: string;
  supplier?: string;
  notes?: string;
  items: PurchaseItem[];
  totalAmount: Money;
  paymentMethod: PaymentMethod;
  status: "pending" | "synced" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  productCode: string;
  qty: number;
  price: Money;
  costPrice: Money;
  total: Money;
  purchaseDate?: string;
}

export interface SaleDoc {
  _id: string;
  _rev?: string;
  type: "sale";
  timestamp: string;
  customer?: string;
  notes?: string;
  items: SaleItem[];
  totalAmount: Money;
  totalCost: Money;
  profit: Money;
  paymentMethod: PaymentMethod;
  cashReceived?: Money;
  change?: Money;
  status: "pending" | "synced" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface FinancialPeriod {
  startDate: string;
  endDate: string;
}

export interface OnboardingWizardProps {
  onComplete: () => void;
}

export type PaymentMethod = "cash" | "bank" | "mobile_money" | "credit";

export interface AccountSettings {
  id: string;
  name: string;
  type: "cash" | "mobile_money" | "bank";
  balance: number;
  currency: CurrencyCode;
}

export interface TrialBalance extends FinancialPeriod {
  accounts: Record<
    string,
    {
      name: string;
      type: string;
      debitBalance: Money;
      creditBalance: Money;
      netBalance: Money;
    }
  >;
  totalDebits: Money;
  totalCredits: Money;
}

export interface AccountHistory extends FinancialPeriod {
  accountCode: string;
  accountName: string;
  accountType: string;
  entries: Array<{
    timestamp: string;
    description: string;
    debit: Money;
    credit: Money;
    balance: Money;
    transactionType: "sale" | "purchase" | "cash_adjustment";
  }>;
  openingBalance: Money;
  closingBalance: Money;
  totalDebits: Money;
  totalCredits: Money;
}
