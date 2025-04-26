import { Money } from "./money";
import { FinancialPeriod } from "./index";

// Account types following standard accounting categories
export type AccountType =
  | "asset" // Things owned by the business (cash, inventory, etc.)
  | "liability" // Things owed by the business (accounts payable, loans, etc.)
  | "equity" // Owner's stake in the business
  | "revenue" // Income from sales
  | "expense" // Costs incurred
  | "contra"; // Contra accounts that offset other accounts

// Standard chart of accounts
export enum AccountCode {
  // Asset accounts (1xxx)
  CASH = "1000",
  INVENTORY = "1100",
  ACCOUNTS_RECEIVABLE = "1200",

  // Liability accounts (2xxx)
  ACCOUNTS_PAYABLE = "2000",

  // Equity accounts (3xxx)
  OWNERS_EQUITY = "3000",
  RETAINED_EARNINGS = "3100",

  // Revenue accounts (4xxx)
  SALES_REVENUE = "4000",

  // Expense accounts (5xxx)
  COST_OF_GOODS_SOLD = "5000",
  OPERATING_EXPENSES = "5100",

  // Contra accounts (9xxx)
  INVENTORY_ADJUSTMENT = "9100",
}

// Account definition
export interface Account {
  code: AccountCode;
  name: string;
  type: AccountType;
  description: string;
}

// Standard chart of accounts with descriptions
export const CHART_OF_ACCOUNTS: Record<AccountCode, Account> = {
  [AccountCode.CASH]: {
    code: AccountCode.CASH,
    name: "Cash",
    type: "asset",
    description: "Physical and digital cash holdings",
  },
  [AccountCode.INVENTORY]: {
    code: AccountCode.INVENTORY,
    name: "Inventory",
    type: "asset",
    description: "Value of goods held for sale",
  },
  [AccountCode.ACCOUNTS_RECEIVABLE]: {
    code: AccountCode.ACCOUNTS_RECEIVABLE,
    name: "Accounts Receivable",
    type: "asset",
    description: "Money owed by customers",
  },
  [AccountCode.ACCOUNTS_PAYABLE]: {
    code: AccountCode.ACCOUNTS_PAYABLE,
    name: "Accounts Payable",
    type: "liability",
    description: "Money owed to suppliers",
  },
  [AccountCode.OWNERS_EQUITY]: {
    code: AccountCode.OWNERS_EQUITY,
    name: "Owner's Equity",
    type: "equity",
    description: "Owner's stake in the business",
  },
  [AccountCode.RETAINED_EARNINGS]: {
    code: AccountCode.RETAINED_EARNINGS,
    name: "Retained Earnings",
    type: "equity",
    description: "Accumulated profits reinvested in the business",
  },
  [AccountCode.SALES_REVENUE]: {
    code: AccountCode.SALES_REVENUE,
    name: "Sales Revenue",
    type: "revenue",
    description: "Income from sales of goods",
  },
  [AccountCode.COST_OF_GOODS_SOLD]: {
    code: AccountCode.COST_OF_GOODS_SOLD,
    name: "Cost of Goods Sold",
    type: "expense",
    description: "Direct cost of goods sold",
  },
  [AccountCode.OPERATING_EXPENSES]: {
    code: AccountCode.OPERATING_EXPENSES,
    name: "Operating Expenses",
    type: "expense",
    description: "Day-to-day business operation costs",
  },
  [AccountCode.INVENTORY_ADJUSTMENT]: {
    code: AccountCode.INVENTORY_ADJUSTMENT,
    name: "Inventory Adjustment",
    type: "contra",
    description: "Adjustments to inventory value",
  },
};

// A single line in a journal entry
export interface LedgerEntryLine {
  accountCode: AccountCode;
  description: string;
  debit: Money;
  credit: Money;
}

// Complete journal entry document
export interface LedgerEntryDoc extends PouchDB.Core.Document<object> {
  _id: string;
  _rev?: string;
  type: "ledger_entry";
  transactionId: string; // ID of related transaction (sale, purchase, etc.)
  transactionType: string; // Type of transaction (sale, purchase, adjustment)
  timestamp: string; // ISO 8601 format
  postingDate: string; // When the entry was posted to the ledger
  description: string; // General description of the entry
  lines: LedgerEntryLine[]; // Individual debit/credit lines
  status: "pending" | "posted" | "failed";
  metadata?: {
    // Additional contextual information
    [key: string]: string | number | boolean | Money | null;
  };
}

// Trial balance for a period
export interface TrialBalance extends FinancialPeriod {
  accounts: {
    [accountCode: string]: {
      name: string;
      type: AccountType;
      debitBalance: Money;
      creditBalance: Money;
      netBalance: Money;
    };
  };
  totalDebits: Money;
  totalCredits: Money;
}

// General ledger account history
export interface AccountHistory extends FinancialPeriod {
  accountCode: AccountCode;
  accountName: string;
  accountType: AccountType;
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
