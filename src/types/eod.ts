import { Money } from "./money";

export type VarianceType =
  | "exact"
  | "shortage"
  | "surplus"
  | "explained_shortage"
  | "explained_surplus";

export type VarianceExplanationType =
  // Customer-related
  | "change_owed"
  | "customer_refund"
  | "customer_credit"
  | "tips_received"
  | "customer_deposit"
  // Banking
  | "bank_deposit"
  | "bank_withdrawal"
  | "banking_fees"
  | "bank_error"
  // Supplier/Vendor
  | "supplier_refund"
  | "vendor_credit"
  | "supplier_advance"
  // Expenses
  | "petty_cash_expense"
  | "operating_expense"
  | "employee_reimbursement"
  | "loan_given"
  | "loan_received"
  // Operational
  | "till_float_adjustment"
  | "change_fund_replenish"
  | "currency_exchange"
  | "till_swap"
  // Errors
  | "counting_error"
  | "recording_error"
  | "change_error"
  | "duplicate_transaction"
  // Losses/Gains
  | "theft_loss"
  | "found_money"
  | "damaged_currency"
  | "counterfeit_currency"
  // Special
  | "donation"
  | "interest_earned"
  | "penalty_fine"
  | "commission_paid"
  | "security_deposit"
  // System
  | "sync_delay"
  | "manual_adjustment"
  | "opening_balance_error"
  // Other
  | "other"
  | "unexplained";

export interface VarianceExplanation {
  type: VarianceExplanationType;
  description: string;
  amount: Money;
  relatedTransactionId?: string; // Link to sale/purchase if applicable
  customerName?: string; // For change owed, refunds, etc.
  expectedResolutionDate?: string; // When will this be resolved
  resolved?: boolean; // Has this been resolved
  resolvedAt?: string;
  resolvedBy?: string;
}

export type CashSurrenderMethod =
  | "bank_deposit"
  | "owner_collection"
  | "safe_deposit";

export interface CashSurrender {
  _id: string;
  _rev?: string;
  type: "cash_surrender";
  eodRecordId: string; // Link to EOD
  amount: Money;
  method: CashSurrenderMethod;
  reference: string; // Bank reference, receipt number, etc.
  notes?: string;
  timestamp: string;
  surrenderedBy: string; // userId
  ledgerEntryId?: string;
  shopId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EODCashRecord {
  _id: string; // "eod_2024-01-15_user123" (date + userId)
  _rev?: string;
  type: "eod_cash_record";
  date: string; // "2024-01-15" (YYYY-MM-DD)
  userId: string; // ✅ Which user this EOD is for
  userName?: string; // For display purposes (cached for performance)

  // Opening Balance
  openingBalance: Money;
  openingBalanceSource?: "previous_day" | "manual"; // How opening balance was determined

  // Day's Transactions (filtered by createdBy = userId)
  cashSales: Money;
  cashPurchases: Money;
  otherCashIn?: Money;
  otherCashOut?: Money;

  // Calculated Expected
  expectedClosingBalance: Money;

  // Actual Count
  actualCashCount: Money;
  variance: Money; // Actual - Expected

  // Variance Details
  varianceType: VarianceType;
  varianceExplanation?: VarianceExplanation[];

  // Cash Surrender
  cashSurrendered?: Money; // Amount surrendered to bank/owner
  surrenderMethod?: CashSurrenderMethod;
  surrenderReference?: string; // Bank reference, receipt number, etc.
  surrenderNotes?: string;

  // Accounting
  varianceLedgerEntryId?: string;
  surrenderLedgerEntryId?: string;

  // Metadata
  completedBy: string; // userId (should match userId)
  completedAt: string;
  verifiedBy?: string; // userId (manager/owner)
  verifiedAt?: string;
  notes?: string;
  status: "pending" | "completed" | "verified";
  shopId?: string;
  createdAt: string;
  updatedAt: string;
}
