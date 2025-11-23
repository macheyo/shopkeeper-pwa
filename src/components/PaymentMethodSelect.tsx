import React, { useState, useEffect, useMemo } from "react";
import { PaymentMethod } from "@/types";
import { Select } from "@mantine/core";
import { generateTrialBalance } from "@/lib/accounting";
import { AccountCode } from "@/types/accounting";
import {
  formatMoney,
  Money,
  createMoney,
  CurrencyCode,
  convertMoneyWithRates,
} from "@/types/money";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { getShopSettings } from "@/lib/settingsDB";
import { getLedgerDB } from "@/lib/databases";
import { LedgerEntryDoc } from "@/types/accounting";

interface PaymentMethodSelectProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  className?: string;
  error?: string;
}

export function PaymentMethodSelect({
  value,
  onChange,
  className = "",
  error,
}: PaymentMethodSelectProps) {
  const { dateRangeInfo } = useDateFilter();
  const [balances, setBalances] = useState<{
    cash: Money | null;
    bank: Money | null;
    mobile_money: Money | null;
    credit: Money | null;
  }>({
    cash: null,
    bank: null,
    mobile_money: null,
    credit: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const settings = await getShopSettings();
        if (!settings) {
          setLoading(false);
          return;
        }

        const baseCurrency = settings.baseCurrency as CurrencyCode;
        const exchangeRates = settings.currencies.reduce((acc, curr) => {
          acc[curr.code as CurrencyCode] = curr.exchangeRate;
          return acc;
        }, {} as Record<CurrencyCode, number>);
        exchangeRates[baseCurrency] = 1;

        // Get trial balance for ledger accounts
        const trialBalance = await generateTrialBalance(
          new Date(0).toISOString(),
          dateRangeInfo.endDate.toISOString()
        );

        // Cash balance from CASH account
        const cashAccount = trialBalance.accounts[AccountCode.CASH];
        const cashBalance = cashAccount
          ? cashAccount.netBalance
          : createMoney(0, baseCurrency, 1);

        // Credit balance from ACCOUNTS_PAYABLE (what you owe)
        const payableAccount =
          trialBalance.accounts[AccountCode.ACCOUNTS_PAYABLE];
        const creditBalance = payableAccount
          ? {
              ...payableAccount.netBalance,
              amount: -payableAccount.netBalance.amount, // Flip sign for liability
            }
          : createMoney(0, baseCurrency, 1);

        // Calculate bank and mobile_money balances from shop settings + transactions
        // Start with opening balances from shop settings
        let bankOpeningBalance = 0;
        let mobileMoneyOpeningBalance = 0;

        settings.accounts.forEach((account) => {
          if (account.type === "bank") {
            // Convert to base currency
            const accountBalance = convertMoneyWithRates(
              {
                amount: account.balance,
                currency: account.currency as CurrencyCode,
                exchangeRate:
                  exchangeRates[account.currency as CurrencyCode] || 1,
              },
              baseCurrency,
              exchangeRates[baseCurrency],
              baseCurrency
            );
            bankOpeningBalance += accountBalance.amount;
          } else if (account.type === "mobile_money") {
            const accountBalance = convertMoneyWithRates(
              {
                amount: account.balance,
                currency: account.currency as CurrencyCode,
                exchangeRate:
                  exchangeRates[account.currency as CurrencyCode] || 1,
              },
              baseCurrency,
              exchangeRates[baseCurrency],
              baseCurrency
            );
            mobileMoneyOpeningBalance += accountBalance.amount;
          }
        });

        // Get ledger entries to calculate net changes for bank and mobile_money
        const ledgerDB = await getLedgerDB();
        const ledgerEntries = await ledgerDB.find({
          selector: {
            type: "ledger_entry",
            status: "posted",
            timestamp: {
              $lte: dateRangeInfo.endDate.toISOString(),
            },
          },
        });

        let bankNetChange = 0;
        let mobileMoneyNetChange = 0;

        (ledgerEntries.docs as LedgerEntryDoc[]).forEach((entry) => {
          const paymentMethod = entry.metadata?.paymentMethod as string;
          if (!paymentMethod) return;

          // Find the CASH or ACCOUNTS_RECEIVABLE line
          const cashLine = entry.lines.find(
            (line) =>
              line.accountCode === AccountCode.CASH ||
              line.accountCode === AccountCode.ACCOUNTS_RECEIVABLE
          );

          if (cashLine) {
            const debitAmount = convertMoneyWithRates(
              cashLine.debit,
              baseCurrency,
              exchangeRates[baseCurrency],
              baseCurrency
            ).amount;
            const creditAmount = convertMoneyWithRates(
              cashLine.credit,
              baseCurrency,
              exchangeRates[baseCurrency],
              baseCurrency
            ).amount;
            const netChange = debitAmount - creditAmount;

            if (paymentMethod === "bank") {
              bankNetChange += netChange;
            } else if (paymentMethod === "mobile_money") {
              mobileMoneyNetChange += netChange;
            }
          }
        });

        setBalances({
          cash: cashBalance,
          bank: createMoney(
            bankOpeningBalance + bankNetChange,
            baseCurrency,
            1
          ),
          mobile_money: createMoney(
            mobileMoneyOpeningBalance + mobileMoneyNetChange,
            baseCurrency,
            1
          ),
          credit: creditBalance,
        });
      } catch (err) {
        console.error("Error fetching balances:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [dateRangeInfo.endDate]);

  const paymentMethodData = useMemo(() => {
    const getLabel = (method: PaymentMethod): string => {
      const baseLabel = {
        cash: "Cash",
        bank: "Bank",
        mobile_money: "Mobile Money",
        credit: "Credit",
      }[method];

      const balance = balances[method];
      if (balance && !loading) {
        return `${baseLabel} (${formatMoney(balance)})`;
      }

      return baseLabel;
    };

    return [
      { value: "cash" as PaymentMethod, label: getLabel("cash") },
      { value: "bank" as PaymentMethod, label: getLabel("bank") },
      {
        value: "mobile_money" as PaymentMethod,
        label: getLabel("mobile_money"),
      },
      { value: "credit" as PaymentMethod, label: getLabel("credit") },
    ];
  }, [balances, loading]);

  return (
    <Select
      label="Payment Method"
      value={value}
      onChange={(value) => onChange(value as PaymentMethod)}
      data={paymentMethodData}
      className={className}
      mb="md"
      error={error}
      styles={
        error
          ? {
              input: {
                borderColor: "var(--mantine-color-red-6)",
                backgroundColor: "var(--mantine-color-red-0)",
              },
            }
          : undefined
      }
    />
  );
}
