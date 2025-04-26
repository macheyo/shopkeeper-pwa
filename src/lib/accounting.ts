import { getLedgerDB } from "./databases";
import { Money, createMoney, convertMoney, BASE_CURRENCY } from "@/types/money";
import {
  AccountCode,
  LedgerEntryDoc,
  LedgerEntryLine,
  TrialBalance,
  AccountHistory,
  CHART_OF_ACCOUNTS,
} from "@/types/accounting";

// Validate that total debits equal total credits
function validateDoubleEntry(lines: LedgerEntryLine[]): boolean {
  const totalDebits = lines.reduce(
    (sum, line) => sum + convertMoney(line.debit, BASE_CURRENCY, 1).amount,
    0
  );
  const totalCredits = lines.reduce(
    (sum, line) => sum + convertMoney(line.credit, BASE_CURRENCY, 1).amount,
    0
  );

  // Use a small epsilon for floating point comparison
  return Math.abs(totalDebits - totalCredits) < 0.0001;
}

// Create a ledger entry for a sale
export async function createSaleEntry(
  saleId: string,
  totalAmount: Money,
  costOfGoods: Money,
  paymentMethod: string,
  timestamp: string
): Promise<LedgerEntryDoc | null> {
  const ledgerDB = await getLedgerDB();

  // Convert amounts to base currency for consistency
  const saleAmountBase = convertMoney(totalAmount, BASE_CURRENCY, 1);
  const costOfGoodsBase = convertMoney(costOfGoods, BASE_CURRENCY, 1);
  const profitBase = createMoney(
    saleAmountBase.amount - costOfGoodsBase.amount
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
      credit: createMoney(0),
    },
    // Credit sales revenue
    {
      accountCode: AccountCode.SALES_REVENUE,
      description: "Sales revenue",
      debit: createMoney(0),
      credit: saleAmountBase,
    },
    // Debit cost of goods sold
    {
      accountCode: AccountCode.COST_OF_GOODS_SOLD,
      description: "Cost of goods sold",
      debit: costOfGoodsBase,
      credit: createMoney(0),
    },
    // Credit inventory
    {
      accountCode: AccountCode.INVENTORY,
      description: "Reduce inventory",
      debit: createMoney(0),
      credit: costOfGoodsBase,
    },
  ];

  // Validate double-entry accounting principle
  if (!validateDoubleEntry(lines)) {
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
  timestamp: string
): Promise<LedgerEntryDoc | null> {
  const ledgerDB = await getLedgerDB();

  // Convert amount to base currency
  const purchaseAmountBase = convertMoney(totalAmount, BASE_CURRENCY, 1);

  // Create ledger entry lines
  const lines: LedgerEntryLine[] = [
    // Debit inventory
    {
      accountCode: AccountCode.INVENTORY,
      description: "Purchase inventory",
      debit: purchaseAmountBase,
      credit: createMoney(0),
    },
    // Credit the appropriate account based on payment method
    {
      accountCode:
        paymentMethod === "cash"
          ? AccountCode.CASH
          : AccountCode.ACCOUNTS_PAYABLE,
      description: "Purchase payment",
      debit: createMoney(0),
      credit: purchaseAmountBase,
    },
  ];

  // Validate double-entry accounting principle
  if (!validateDoubleEntry(lines)) {
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
  timestamp: string
): Promise<LedgerEntryDoc | null> {
  const ledgerDB = await getLedgerDB();

  // Convert amounts to base currency
  const physicalBase = convertMoney(physicalAmount, BASE_CURRENCY, 1);
  const expectedBase = convertMoney(expectedAmount, BASE_CURRENCY, 1);
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
          debit: createMoney(difference),
          credit: createMoney(0),
        },
        {
          accountCode: AccountCode.OPERATING_EXPENSES,
          description: "Cash surplus adjustment",
          debit: createMoney(0),
          credit: createMoney(difference),
        }
      );
    } else {
      // Shortage: Debit Operating Expense, Credit Cash
      const shortageAmount = Math.abs(difference);
      lines.push(
        {
          accountCode: AccountCode.OPERATING_EXPENSES,
          description: "Cash shortage adjustment",
          debit: createMoney(shortageAmount),
          credit: createMoney(0),
        },
        {
          accountCode: AccountCode.CASH,
          description: "Cash shortage adjustment",
          debit: createMoney(0),
          credit: createMoney(shortageAmount),
        }
      );
    }
  }

  // If no significant difference, return null instead of creating an entry
  if (lines.length === 0) {
    return null;
  }

  // Validate double-entry accounting principle
  if (!validateDoubleEntry(lines)) {
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
  endDate: string
): Promise<TrialBalance> {
  const ledgerDB = await getLedgerDB();

  // Get all posted entries within the date range
  const result = await ledgerDB.find({
    selector: {
      type: "ledger_entry",
      status: "posted",
      timestamp: {
        $gte: startDate,
        $lt: endDate,
      },
    },
  });

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
          debitBalance: createMoney(0),
          creditBalance: createMoney(0),
          netBalance: createMoney(0),
        };
      }

      // Add debits and credits
      accounts[accountCode].debitBalance.amount += convertMoney(
        debit,
        BASE_CURRENCY,
        1
      ).amount;
      accounts[accountCode].creditBalance.amount += convertMoney(
        credit,
        BASE_CURRENCY,
        1
      ).amount;

      // Calculate net balance based on account type
      const netAmount =
        accounts[accountCode].debitBalance.amount -
        accounts[accountCode].creditBalance.amount;
      accounts[accountCode].netBalance = createMoney(netAmount);
    }
  }

  // Calculate totals
  const totalDebits = createMoney(
    Object.values(accounts).reduce(
      (sum, account) => sum + account.debitBalance.amount,
      0
    )
  );
  const totalCredits = createMoney(
    Object.values(accounts).reduce(
      (sum, account) => sum + account.creditBalance.amount,
      0
    )
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
        $lt: endDate,
      },
    },
  });

  // Filter entries that have at least one line with the matching account code
  const filteredDocs = (result.docs as LedgerEntryDoc[]).filter((doc) =>
    doc.lines.some((line) => line.accountCode === accountCode)
  );

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
        const debitAmount = convertMoney(line.debit, BASE_CURRENCY, 1).amount;
        const creditAmount = convertMoney(line.credit, BASE_CURRENCY, 1).amount;

        totalDebits += debitAmount;
        totalCredits += creditAmount;
        balance += debitAmount - creditAmount;

        entries.push({
          timestamp: doc.timestamp,
          description: doc.description,
          debit: line.debit,
          credit: line.credit,
          balance: createMoney(balance),
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
    openingBalance: createMoney(0), // This should be calculated from previous periods
    closingBalance: createMoney(balance),
    totalDebits: createMoney(totalDebits),
    totalCredits: createMoney(totalCredits),
  };
}
