import { getLedgerDB } from "./databases";
import { getShopSettings } from "./settingsDB";
import {
  EODCashRecord,
  VarianceExplanation,
  CashSurrenderMethod,
} from "@/types/eod";
import {
  Money,
  CurrencyCode,
  createMoneyWithRates,
  convertMoneyWithRates,
  BASE_CURRENCY,
} from "@/types/money";
import {
  AccountCode,
  LedgerEntryDoc,
  LedgerEntryLine,
} from "@/types/accounting";

/**
 * Validate that total debits equal total credits
 */
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

/**
 * Create ledger entry for variance (shortage/surplus)
 */
export async function createVarianceLedgerEntry(
  eodRecord: EODCashRecord,
  shopId?: string,
  createdBy?: string
): Promise<LedgerEntryDoc | null> {
  try {
    const ledgerDB = await getLedgerDB();
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

    const variance = eodRecord.variance;
    const varianceAmount = Math.abs(variance.amount);

    // If variance is negligible, don't create entry
    if (varianceAmount < 0.01) {
      return null;
    }

    const varianceInBase = convertMoneyWithRates(
      variance,
      baseCurrency,
      exchangeRates[baseCurrency],
      baseCurrency
    );

    const lines: LedgerEntryLine[] = [];
    const isShortage = variance.amount < 0;
    const hasExplanation =
      eodRecord.varianceExplanation && eodRecord.varianceExplanation.length > 0;

    if (hasExplanation) {
      // Handle explained variances
      const explanation = eodRecord.varianceExplanation![0];

      if (explanation.type === "change_owed" && isShortage) {
        // Change owed to customer - use Accounts Receivable
        lines.push(
          {
            accountCode: AccountCode.ACCOUNTS_RECEIVABLE,
            description: `Change owed to customer: ${
              explanation.customerName || "Customer"
            } - EOD ${eodRecord.date}`,
            debit: createMoneyWithRates(
              varianceAmount,
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
            description: `Change owed - EOD ${eodRecord.date}`,
            debit: createMoneyWithRates(
              0,
              baseCurrency,
              exchangeRates[baseCurrency]
            ),
            credit: createMoneyWithRates(
              varianceAmount,
              baseCurrency,
              exchangeRates[baseCurrency]
            ),
          }
        );
      } else if (explanation.type === "expense_paid" && isShortage) {
        // Expense paid - debit expense, credit cash
        lines.push(
          {
            accountCode: AccountCode.OPERATING_EXPENSES,
            description: `Expense paid: ${explanation.description} - EOD ${eodRecord.date}`,
            debit: createMoneyWithRates(
              varianceAmount,
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
            description: `Expense paid - EOD ${eodRecord.date}`,
            debit: createMoneyWithRates(
              0,
              baseCurrency,
              exchangeRates[baseCurrency]
            ),
            credit: createMoneyWithRates(
              varianceAmount,
              baseCurrency,
              exchangeRates[baseCurrency]
            ),
          }
        );
      } else if (explanation.type === "deposit_received" && !isShortage) {
        // Deposit received - debit cash, credit revenue
        lines.push(
          {
            accountCode: AccountCode.CASH,
            description: `Deposit received: ${explanation.description} - EOD ${eodRecord.date}`,
            debit: createMoneyWithRates(
              varianceAmount,
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
            accountCode: AccountCode.SALES_REVENUE,
            description: `Deposit received - EOD ${eodRecord.date}`,
            debit: createMoneyWithRates(
              0,
              baseCurrency,
              exchangeRates[baseCurrency]
            ),
            credit: createMoneyWithRates(
              varianceAmount,
              baseCurrency,
              exchangeRates[baseCurrency]
            ),
          }
        );
      } else {
        // Other explained variance - treat as adjustment
        // For now, use operating expenses for shortage, revenue for surplus
        if (isShortage) {
          lines.push(
            {
              accountCode: AccountCode.OPERATING_EXPENSES,
              description: `Explained variance: ${explanation.description} - EOD ${eodRecord.date}`,
              debit: createMoneyWithRates(
                varianceAmount,
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
              description: `Explained variance - EOD ${eodRecord.date}`,
              debit: createMoneyWithRates(
                0,
                baseCurrency,
                exchangeRates[baseCurrency]
              ),
              credit: createMoneyWithRates(
                varianceAmount,
                baseCurrency,
                exchangeRates[baseCurrency]
              ),
            }
          );
        } else {
          lines.push(
            {
              accountCode: AccountCode.CASH,
              description: `Explained variance: ${explanation.description} - EOD ${eodRecord.date}`,
              debit: createMoneyWithRates(
                varianceAmount,
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
              accountCode: AccountCode.SALES_REVENUE,
              description: `Explained variance - EOD ${eodRecord.date}`,
              debit: createMoneyWithRates(
                0,
                baseCurrency,
                exchangeRates[baseCurrency]
              ),
              credit: createMoneyWithRates(
                varianceAmount,
                baseCurrency,
                exchangeRates[baseCurrency]
              ),
            }
          );
        }
      }
    } else {
      // Unexplained variance - treat as loss/gain
      if (isShortage) {
        // Shortage: Debit Operating Expense, Credit Cash
        lines.push(
          {
            accountCode: AccountCode.OPERATING_EXPENSES,
            description: `Unexplained cash shortage - EOD ${eodRecord.date}`,
            debit: createMoneyWithRates(
              varianceAmount,
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
            description: `Cash shortage adjustment - EOD ${eodRecord.date}`,
            debit: createMoneyWithRates(
              0,
              baseCurrency,
              exchangeRates[baseCurrency]
            ),
            credit: createMoneyWithRates(
              varianceAmount,
              baseCurrency,
              exchangeRates[baseCurrency]
            ),
          }
        );
      } else {
        // Surplus: Debit Cash, Credit Revenue (Other Income)
        lines.push(
          {
            accountCode: AccountCode.CASH,
            description: `Unexplained cash surplus - EOD ${eodRecord.date}`,
            debit: createMoneyWithRates(
              varianceAmount,
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
            accountCode: AccountCode.SALES_REVENUE,
            description: `Cash surplus adjustment - EOD ${eodRecord.date}`,
            debit: createMoneyWithRates(
              0,
              baseCurrency,
              exchangeRates[baseCurrency]
            ),
            credit: createMoneyWithRates(
              varianceAmount,
              baseCurrency,
              exchangeRates[baseCurrency]
            ),
          }
        );
      }
    }

    // Validate double-entry accounting
    if (!validateDoubleEntry(lines, baseCurrency, exchangeRates)) {
      throw new Error("Invalid ledger entry: Debits do not equal credits");
    }

    // Create the ledger entry
    const entry: LedgerEntryDoc = {
      _id: `eod_variance_${eodRecord.date}_${Date.now()}`,
      type: "ledger_entry",
      transactionId: eodRecord._id,
      transactionType: "cash_adjustment",
      timestamp: eodRecord.completedAt,
      postingDate: new Date().toISOString(),
      description: `EOD Variance - ${eodRecord.date}`,
      lines,
      status: "posted",
      shopId,
      createdBy,
      metadata: {
        eodDate: eodRecord.date,
        varianceType: eodRecord.varianceType,
        varianceAmount: varianceInBase.amount,
        hasExplanation: hasExplanation,
      },
    };

    await ledgerDB.put(entry);
    return entry;
  } catch (error) {
    console.error("Error creating variance ledger entry:", error);
    throw error;
  }
}

/**
 * Create ledger entry for cash surrender
 */
export async function createSurrenderLedgerEntry(
  eodRecord: EODCashRecord,
  shopId?: string,
  createdBy?: string
): Promise<LedgerEntryDoc | null> {
  try {
    if (!eodRecord.cashSurrendered || eodRecord.cashSurrendered.amount <= 0) {
      return null;
    }

    const ledgerDB = await getLedgerDB();
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

    const surrenderInBase = convertMoneyWithRates(
      eodRecord.cashSurrendered,
      baseCurrency,
      exchangeRates[baseCurrency],
      baseCurrency
    );

    const lines: LedgerEntryLine[] = [];

    // Determine account based on surrender method
    let creditAccount: AccountCode;
    let description: string;

    switch (eodRecord.surrenderMethod) {
      case "bank_deposit":
        // For now, we'll use a bank account if it exists, otherwise use a temporary account
        // In a full implementation, you'd have a BANK_ACCOUNT code
        creditAccount = AccountCode.ACCOUNTS_RECEIVABLE; // Temporary - should be BANK_ACCOUNT
        description = `Bank deposit - EOD ${eodRecord.date}`;
        break;
      case "owner_collection":
        creditAccount = AccountCode.OWNERS_EQUITY; // Owner's drawings
        description = `Owner collection - EOD ${eodRecord.date}`;
        break;
      case "safe_deposit":
        // Cash moved to safe - still cash, but different location
        // For now, we'll use a separate account or keep as cash
        creditAccount = AccountCode.CASH; // Could be CASH_IN_SAFE if that account exists
        description = `Safe deposit - EOD ${eodRecord.date}`;
        break;
      default:
        creditAccount = AccountCode.OWNERS_EQUITY;
        description = `Cash surrender - EOD ${eodRecord.date}`;
    }

    lines.push(
      {
        accountCode: creditAccount,
        description: description,
        debit: createMoneyWithRates(
          0,
          baseCurrency,
          exchangeRates[baseCurrency]
        ),
        credit: surrenderInBase,
      },
      {
        accountCode: AccountCode.CASH,
        description: `Cash surrendered - EOD ${eodRecord.date}`,
        debit: surrenderInBase,
        credit: createMoneyWithRates(
          0,
          baseCurrency,
          exchangeRates[baseCurrency]
        ),
      }
    );

    // Validate double-entry accounting
    if (!validateDoubleEntry(lines, baseCurrency, exchangeRates)) {
      throw new Error("Invalid ledger entry: Debits do not equal credits");
    }

    // Create the ledger entry
    const entry: LedgerEntryDoc = {
      _id: `eod_surrender_${eodRecord.date}_${Date.now()}`,
      type: "ledger_entry",
      transactionId: eodRecord._id,
      transactionType: "cash_adjustment",
      timestamp: eodRecord.completedAt,
      postingDate: new Date().toISOString(),
      description: `Cash Surrender - ${eodRecord.date}`,
      lines,
      status: "posted",
      shopId,
      createdBy,
      metadata: {
        eodDate: eodRecord.date,
        surrenderMethod: eodRecord.surrenderMethod,
        surrenderReference: eodRecord.surrenderReference,
        surrenderAmount: surrenderInBase.amount,
      },
    };

    await ledgerDB.put(entry);
    return entry;
  } catch (error) {
    console.error("Error creating surrender ledger entry:", error);
    throw error;
  }
}
