import { getLedgerDB } from "./databases";
import {
  Money,
  CurrencyCode,
  createMoneyWithRates,
  convertMoneyWithRates,
} from "@/types/money";
import { getShopSettings } from "@/lib/settingsDB";
import {
  AccountCode,
  LedgerEntryDoc,
  LedgerEntryLine,
  TrialBalance,
  AccountHistory,
  CHART_OF_ACCOUNTS,
} from "@/types/accounting";

// Validate that total debits equal total credits
function validateDoubleEntry(
  lines: LedgerEntryLine[],
  baseCurrency: string,
  exchangeRates: Record<string, number>
): boolean {
  const totalDebits = lines.reduce(
    (sum, line) =>
      sum +
      convertMoneyWithRates(
        line.debit,
        baseCurrency as CurrencyCode,
        exchangeRates[baseCurrency],
        baseCurrency as CurrencyCode
      ).amount,
    0
  );
  const totalCredits = lines.reduce(
    (sum, line) =>
      sum +
      convertMoneyWithRates(
        line.credit,
        baseCurrency as CurrencyCode,
        exchangeRates[baseCurrency],
        baseCurrency as CurrencyCode
      ).amount,
    0
  );

  // Use a small epsilon for floating point comparison
  return Math.abs(totalDebits - totalCredits) < 0.0001;
}

// Create opening balance entries for accounts
export async function createOpeningBalanceEntries(
  accounts: Array<{
    accountCode: AccountCode;
    balance: Money;
  }>,
  timestamp: string,
  shopId?: string,
  createdBy?: string
): Promise<LedgerEntryDoc | null> {
  const ledgerDB = await getLedgerDB();
  const settings = await getShopSettings();
  if (!settings) {
    throw new Error("Shop settings not found");
  }
  const baseCurrency = settings.baseCurrency as CurrencyCode;
  const exchangeRates = settings.currencies.reduce((acc, curr) => {
    acc[curr.code as CurrencyCode] = curr.exchangeRate;
    return acc;
  }, {} as Record<CurrencyCode, number>);
  exchangeRates[baseCurrency] = 1;

  // Create ledger entry lines
  const lines: LedgerEntryLine[] = [];

  for (const account of accounts) {
    const balanceInBase = convertMoneyWithRates(
      account.balance,
      baseCurrency,
      exchangeRates[baseCurrency],
      baseCurrency
    );

    if (balanceInBase.amount > 0) {
      // For positive balances
      lines.push(
        {
          accountCode: account.accountCode,
          description: "Opening balance",
          debit: balanceInBase,
          credit: createMoneyWithRates(
            0,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
        },
        {
          accountCode: AccountCode.OWNERS_EQUITY,
          description: "Opening balance contra",
          debit: createMoneyWithRates(
            0,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
          credit: balanceInBase,
        }
      );
    } else if (balanceInBase.amount < 0) {
      // For negative balances
      const positiveAmount = createMoneyWithRates(
        Math.abs(balanceInBase.amount),
        baseCurrency,
        exchangeRates[baseCurrency]
      );
      lines.push(
        {
          accountCode: AccountCode.OWNERS_EQUITY,
          description: "Opening balance",
          debit: positiveAmount,
          credit: createMoneyWithRates(
            0,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
        },
        {
          accountCode: account.accountCode,
          description: "Opening balance contra",
          debit: createMoneyWithRates(
            0,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
          credit: positiveAmount,
        }
      );
    }
  }

  // If no lines were created, return null
  if (lines.length === 0) {
    return null;
  }

  // Validate double-entry accounting principle
  if (!validateDoubleEntry(lines, baseCurrency, exchangeRates)) {
    throw new Error("Invalid ledger entry: Debits do not equal credits");
  }

  // Create the ledger entry
  const entry: LedgerEntryDoc = {
    _id: `${timestamp}_opening_balance`,
    type: "ledger_entry",
    transactionId: "opening_balance",
    transactionType: "opening_balance",
    timestamp,
    postingDate: new Date().toISOString(),
    description: "Opening balance entries",
    lines,
    status: "posted",
    shopId,
    createdBy,
    metadata: {
      isOpeningBalance: true,
    },
  };

  // Save to database
  await ledgerDB.put(entry);
  return entry;
}

// Create a ledger entry for a sale
export async function createSaleEntry(
  saleId: string,
  totalAmount: Money,
  costOfGoods: Money,
  paymentMethod: string,
  timestamp: string,
  shopId?: string,
  createdBy?: string
): Promise<LedgerEntryDoc | null> {
  const ledgerDB = await getLedgerDB();

  // Get settings for currency conversion
  const settings = await getShopSettings();
  if (!settings) {
    throw new Error("Shop settings not found");
  }
  const baseCurrency = settings.baseCurrency as CurrencyCode;
  const exchangeRates = settings.currencies.reduce((acc, curr) => {
    acc[curr.code as CurrencyCode] = curr.exchangeRate;
    return acc;
  }, {} as Record<CurrencyCode, number>);
  exchangeRates[baseCurrency] = 1;

  // Convert amounts to base currency for consistency
  const saleAmountBase = convertMoneyWithRates(
    totalAmount,
    baseCurrency,
    exchangeRates[baseCurrency],
    baseCurrency
  );
  const costOfGoodsBase = convertMoneyWithRates(
    costOfGoods,
    baseCurrency,
    exchangeRates[baseCurrency],
    baseCurrency
  );
  const profitBase = createMoneyWithRates(
    saleAmountBase.amount - costOfGoodsBase.amount,
    baseCurrency,
    exchangeRates[baseCurrency]
  );

  // Create ledger entry lines
  const lines: LedgerEntryLine[] = [
    // Debit the appropriate asset account based on payment method
    {
      accountCode:
        paymentMethod === "cash"
          ? AccountCode.CASH
          : AccountCode.ACCOUNTS_RECEIVABLE,
      description: "Sale payment",
      debit: saleAmountBase,
      credit: createMoneyWithRates(
        0,
        baseCurrency,
        exchangeRates[baseCurrency]
      ),
    },
    // Credit sales revenue
    {
      accountCode: AccountCode.SALES_REVENUE,
      description: "Sales revenue",
      debit: createMoneyWithRates(0, baseCurrency, exchangeRates[baseCurrency]),
      credit: saleAmountBase,
    },
    // Debit cost of goods sold
    {
      accountCode: AccountCode.COST_OF_GOODS_SOLD,
      description: "Cost of goods sold",
      debit: costOfGoodsBase,
      credit: createMoneyWithRates(
        0,
        baseCurrency,
        exchangeRates[baseCurrency]
      ),
    },
    // Credit inventory
    {
      accountCode: AccountCode.INVENTORY,
      description: "Reduce inventory",
      debit: createMoneyWithRates(0, baseCurrency, exchangeRates[baseCurrency]),
      credit: costOfGoodsBase,
    },
  ];

  // Validate double-entry accounting principle
  if (!validateDoubleEntry(lines, baseCurrency, exchangeRates)) {
    throw new Error("Invalid ledger entry: Debits do not equal credits");
  }

  // Create the ledger entry
  const entry: LedgerEntryDoc = {
    _id: `${timestamp}_${saleId}`,
    type: "ledger_entry",
    transactionId: saleId,
    transactionType: "sale",
    timestamp,
    postingDate: new Date().toISOString(),
    description: "Sale transaction",
    lines,
    status: "posted",
    shopId,
    createdBy,
    metadata: {
      totalAmount: saleAmountBase.amount,
      costOfGoods: costOfGoodsBase.amount,
      profit: profitBase.amount,
      paymentMethod,
    },
  };

  // Save to database
  await ledgerDB.put(entry);
  return entry;
}

// Create a ledger entry for a purchase
export async function createPurchaseEntry(
  purchaseId: string,
  totalAmount: Money,
  paymentMethod: string,
  timestamp: string,
  shopId?: string,
  createdBy?: string
): Promise<LedgerEntryDoc | null> {
  const ledgerDB = await getLedgerDB();

  // Validate shopId is provided
  if (!shopId) {
    throw new Error("shopId is required to create purchase entry");
  }

  // Get settings for currency conversion
  const settings = await getShopSettings(shopId);
  if (!settings) {
    throw new Error("Shop settings not found");
  }
  const baseCurrency = settings.baseCurrency as CurrencyCode;
  const exchangeRates = settings.currencies.reduce((acc, curr) => {
    acc[curr.code as CurrencyCode] = curr.exchangeRate;
    return acc;
  }, {} as Record<CurrencyCode, number>);
  exchangeRates[baseCurrency] = 1;

  // Convert amount to base currency
  const purchaseAmountBase = convertMoneyWithRates(
    totalAmount,
    baseCurrency,
    exchangeRates[baseCurrency],
    baseCurrency
  );

  // Create ledger entry lines
  const lines: LedgerEntryLine[] = [
    // Debit inventory
    {
      accountCode: AccountCode.INVENTORY,
      description: "Purchase inventory",
      debit: purchaseAmountBase,
      credit: createMoneyWithRates(
        0,
        baseCurrency,
        exchangeRates[baseCurrency]
      ),
    },
    // Credit the appropriate account based on payment method
    {
      accountCode:
        paymentMethod === "cash"
          ? AccountCode.CASH
          : AccountCode.ACCOUNTS_PAYABLE,
      description: "Purchase payment",
      debit: createMoneyWithRates(0, baseCurrency, exchangeRates[baseCurrency]),
      credit: purchaseAmountBase,
    },
  ];

  // Validate double-entry accounting principle
  if (!validateDoubleEntry(lines, baseCurrency, exchangeRates)) {
    throw new Error("Invalid ledger entry: Debits do not equal credits");
  }

  // Create the ledger entry
  const entry: LedgerEntryDoc = {
    _id: `${timestamp}_${purchaseId}`,
    type: "ledger_entry",
    transactionId: purchaseId,
    transactionType: "purchase",
    timestamp,
    postingDate: new Date().toISOString(),
    description: "Purchase transaction",
    lines,
    status: "posted",
    shopId,
    createdBy,
    metadata: {
      totalAmount: purchaseAmountBase.amount,
      paymentMethod,
    },
  };

  // Save to database
  await ledgerDB.put(entry);
  return entry;
}

// Create a ledger entry for cash count adjustment
export async function createCashAdjustmentEntry(
  countId: string,
  physicalAmount: Money,
  expectedAmount: Money,
  timestamp: string,
  shopId?: string,
  createdBy?: string
): Promise<LedgerEntryDoc | null> {
  const ledgerDB = await getLedgerDB();

  // Get settings for currency conversion
  const settings = await getShopSettings();
  if (!settings) {
    throw new Error("Shop settings not found");
  }
  const baseCurrency = settings.baseCurrency as CurrencyCode;
  const exchangeRates = settings.currencies.reduce((acc, curr) => {
    acc[curr.code as CurrencyCode] = curr.exchangeRate;
    return acc;
  }, {} as Record<CurrencyCode, number>);
  exchangeRates[baseCurrency] = 1;

  // Convert amounts to base currency
  const physicalBase = convertMoneyWithRates(
    physicalAmount,
    baseCurrency,
    exchangeRates[baseCurrency],
    baseCurrency
  );
  const expectedBase = convertMoneyWithRates(
    expectedAmount,
    baseCurrency,
    exchangeRates[baseCurrency],
    baseCurrency
  );
  const difference = physicalBase.amount - expectedBase.amount;

  // Create ledger entry lines based on whether there's a surplus or shortage
  const lines: LedgerEntryLine[] = [];

  if (Math.abs(difference) > 0.0001) {
    // Only create adjustment if difference is significant
    if (difference > 0) {
      // Surplus: Debit Cash, Credit Operating Income
      lines.push(
        {
          accountCode: AccountCode.CASH,
          description: "Cash surplus adjustment",
          debit: createMoneyWithRates(
            difference,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
          credit: createMoneyWithRates(
            0,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
        },
        {
          accountCode: AccountCode.OPERATING_EXPENSES,
          description: "Cash surplus adjustment",
          debit: createMoneyWithRates(
            0,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
          credit: createMoneyWithRates(
            difference,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
        }
      );
    } else {
      // Shortage: Debit Operating Expense, Credit Cash
      const shortageAmount = Math.abs(difference);
      lines.push(
        {
          accountCode: AccountCode.OPERATING_EXPENSES,
          description: "Cash shortage adjustment",
          debit: createMoneyWithRates(
            shortageAmount,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
          credit: createMoneyWithRates(
            0,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
        },
        {
          accountCode: AccountCode.CASH,
          description: "Cash shortage adjustment",
          debit: createMoneyWithRates(
            0,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
          credit: createMoneyWithRates(
            shortageAmount,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
        }
      );
    }
  }

  // If no significant difference, return null instead of creating an entry
  if (lines.length === 0) {
    return null;
  }

  // Validate double-entry accounting principle
  if (!validateDoubleEntry(lines, baseCurrency, exchangeRates)) {
    throw new Error("Invalid ledger entry: Debits do not equal credits");
  }

  // Create the ledger entry
  const entry: LedgerEntryDoc = {
    _id: `${timestamp}_${countId}`,
    type: "ledger_entry",
    transactionId: countId,
    transactionType: "cash_adjustment",
    timestamp,
    postingDate: new Date().toISOString(),
    description: "Cash count adjustment",
    lines,
    status: "posted",
    shopId,
    createdBy,
    metadata: {
      physicalAmount: physicalBase.amount,
      expectedAmount: expectedBase.amount,
      difference,
    },
  };

  // Save to database
  await ledgerDB.put(entry);
  return entry;
}

// Generate a trial balance for a period
export async function generateTrialBalance(
  startDate: string,
  endDate: string,
  shopId?: string
): Promise<TrialBalance> {
  const ledgerDB = await getLedgerDB();

  // Get all posted entries within the date range
  const selector: {
    type: string;
    status: string;
    timestamp: { $gte: string; $lte: string };
    shopId?: string;
  } = {
    type: "ledger_entry",
    status: "posted",
    timestamp: {
      $gte: startDate,
      $lte: endDate,
    },
  };
  if (shopId) {
    selector.shopId = shopId;
  }
  const result = await ledgerDB.find({ selector });

  // Get settings for currency conversion
  const settings = await getShopSettings();
  if (!settings) {
    throw new Error("Shop settings not found");
  }
  const baseCurrency = settings.baseCurrency as CurrencyCode;
  const exchangeRates = settings.currencies.reduce((acc, curr) => {
    acc[curr.code as CurrencyCode] = curr.exchangeRate;
    return acc;
  }, {} as Record<CurrencyCode, number>);
  exchangeRates[baseCurrency] = 1;

  // Initialize accounts totals
  const accounts: TrialBalance["accounts"] = {};

  // Process all entries
  for (const entry of result.docs as LedgerEntryDoc[]) {
    for (const line of entry.lines) {
      const { accountCode, debit, credit } = line;

      // Initialize account if not exists
      if (!accounts[accountCode]) {
        accounts[accountCode] = {
          name: CHART_OF_ACCOUNTS[accountCode as AccountCode].name,
          type: CHART_OF_ACCOUNTS[accountCode as AccountCode].type,
          debitBalance: createMoneyWithRates(
            0,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
          creditBalance: createMoneyWithRates(
            0,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
          netBalance: createMoneyWithRates(
            0,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
        };
      }

      // Add debits and credits
      accounts[accountCode].debitBalance.amount += convertMoneyWithRates(
        debit,
        baseCurrency,
        exchangeRates[baseCurrency],
        baseCurrency
      ).amount;
      accounts[accountCode].creditBalance.amount += convertMoneyWithRates(
        credit,
        baseCurrency,
        exchangeRates[baseCurrency],
        baseCurrency
      ).amount;

      // Calculate net balance based on account type
      const netAmount =
        accounts[accountCode].debitBalance.amount -
        accounts[accountCode].creditBalance.amount;
      accounts[accountCode].netBalance = createMoneyWithRates(
        netAmount,
        baseCurrency,
        exchangeRates[baseCurrency]
      );
    }
  }

  // Calculate totals

  const totalDebitsAmount = Object.values(accounts).reduce(
    (sum, account) => sum + account.debitBalance.amount,
    0
  );
  const totalCreditsAmount = Object.values(accounts).reduce(
    (sum, account) => sum + account.creditBalance.amount,
    0
  );

  const totalDebits = createMoneyWithRates(
    totalDebitsAmount,
    baseCurrency,
    exchangeRates[baseCurrency]
  );
  const totalCredits = createMoneyWithRates(
    totalCreditsAmount,
    baseCurrency,
    exchangeRates[baseCurrency]
  );

  return {
    startDate,
    endDate,
    accounts,
    totalDebits,
    totalCredits,
  };
}

// Get history for a specific account
export async function getAccountHistory(
  accountCode: AccountCode,
  startDate: string,
  endDate: string
): Promise<AccountHistory> {
  const ledgerDB = await getLedgerDB();

  // Get all posted entries for this account within the date range
  const result = await ledgerDB.find({
    selector: {
      type: "ledger_entry",
      status: "posted",
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
    },
  });

  // Filter entries that have at least one line with the matching account code
  const filteredDocs = (result.docs as LedgerEntryDoc[]).filter((doc) =>
    doc.lines.some((line) => line.accountCode === accountCode)
  );

  // Get settings for currency conversion
  const settings = await getShopSettings();
  if (!settings) {
    throw new Error("Shop settings not found");
  }
  const baseCurrency = settings.baseCurrency as CurrencyCode;
  const exchangeRates = settings.currencies.reduce((acc, curr) => {
    acc[curr.code as CurrencyCode] = curr.exchangeRate;
    return acc;
  }, {} as Record<CurrencyCode, number>);
  exchangeRates[baseCurrency] = 1;

  const entries = [];
  let balance = 0;
  let totalDebits = 0;
  let totalCredits = 0;

  // Process entries chronologically
  const sortedDocs = (filteredDocs as LedgerEntryDoc[]).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const doc of sortedDocs) {
    for (const line of doc.lines) {
      if (line.accountCode === accountCode) {
        const debitAmount = convertMoneyWithRates(
          line.debit,
          baseCurrency,
          exchangeRates[baseCurrency],
          baseCurrency
        ).amount;
        const creditAmount = convertMoneyWithRates(
          line.credit,
          baseCurrency,
          exchangeRates[baseCurrency],
          baseCurrency
        ).amount;

        totalDebits += debitAmount;
        totalCredits += creditAmount;
        balance += debitAmount - creditAmount;

        entries.push({
          timestamp: doc.timestamp,
          description: doc.description,
          debit: line.debit,
          credit: line.credit,
          balance: createMoneyWithRates(
            balance,
            baseCurrency,
            exchangeRates[baseCurrency]
          ),
          transactionType: doc.transactionType as
            | "sale"
            | "purchase"
            | "cash_adjustment",
        });
      }
    }
  }

  return {
    startDate,
    endDate,
    accountCode,
    accountName: CHART_OF_ACCOUNTS[accountCode].name,
    accountType: CHART_OF_ACCOUNTS[accountCode].type,
    entries,
    openingBalance: createMoneyWithRates(
      0,
      baseCurrency,
      exchangeRates[baseCurrency]
    ), // This should be calculated from previous periods
    closingBalance: createMoneyWithRates(
      balance,
      baseCurrency,
      exchangeRates[baseCurrency]
    ),
    totalDebits: createMoneyWithRates(
      totalDebits,
      baseCurrency,
      exchangeRates[baseCurrency]
    ),
    totalCredits: createMoneyWithRates(
      totalCredits,
      baseCurrency,
      exchangeRates[baseCurrency]
    ),
  };
}
