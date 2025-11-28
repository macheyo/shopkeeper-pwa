import { Money, CurrencyCode } from "./money";

export interface CashInHand {
  _id: string;
  _rev?: string;
  type: "cash_in_hand";
  amount: Money;
  expectedAmount: Money;
  difference: Money;
  timestamp: string;
  notes: string;
  status: "pending" | "synced" | "failed";
  shopId?: string; // Shop identifier
  createdBy?: string; // userId of creator
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
  shopId?: string; // Shop identifier
  createdBy?: string; // userId of creator
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

export interface InventoryLot {
  _id: string;
  _rev?: string;
  type: "inventory_lot";
  productId: string;
  productName: string;
  productCode: string;
  purchaseRunId: string;
  purchaseTimestamp: string;
  quantity: number; // Original quantity purchased
  remainingQuantity: number; // How much is left (for FIFO tracking)
  costPrice: Money;
  supplier?: string;
  shopId?: string; // Shop identifier
  createdAt: string;
  updatedAt: string;
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
  shopId?: string; // Shop identifier
  createdBy?: string; // userId of creator
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
  // FIFO lot tracking
  lotsUsed?: Array<{
    lotId: string;
    purchaseRunId: string;
    quantity: number;
    costPrice: Money;
  }>;
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
  shopId?: string; // Shop identifier
  createdBy?: string; // userId of creator
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

// User and Shop types
export type UserRole = "owner" | "manager" | "employee";
export type UserStatus = "active" | "invited" | "suspended";
export type InvitationStatus = "pending" | "accepted" | "expired";

export interface UserDoc {
  _id: string; // user_{userId}
  _rev?: string;
  type: "user";
  userId: string; // Unique user identifier
  phoneNumber: string; // Phone number (replaces email)
  email?: string; // Optional email (for backwards compatibility)
  name: string;
  role: UserRole;
  shopId: string; // Links user to shop
  status: UserStatus;
  invitedBy?: string; // userId of inviter
  invitedAt?: string;
  lastLoginAt?: string;
  keySignature?: string; // Signature derived from key (for zero-storage key auth)
  createdAt: string;
  updatedAt: string;
}

export interface InvitationDoc {
  _id: string; // invitation_{inviteId}
  _rev?: string;
  type: "invitation";
  inviteId: string;
  email: string;
  role: "manager" | "employee";
  shopId: string;
  invitedBy: string;
  token: string; // Secure token for invitation acceptance
  expiresAt: string;
  status: InvitationStatus;
  createdAt: string;
}

export interface ShopDoc {
  _id: string; // shop_{shopId}
  _rev?: string;
  type: "shop";
  shopId: string;
  shopName: string;
  ownerId: string; // userId of owner
  businessType: string;
  baseCurrency: CurrencyCode;
  currencies: Array<{ code: CurrencyCode; exchangeRate: number }>;
  createdAt: string;
  updatedAt: string;
}

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
