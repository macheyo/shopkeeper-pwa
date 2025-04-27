// Define supported currencies
// Default base currency
export const BASE_CURRENCY: CurrencyCode = "USD";

// Default exchange rates relative to USD (1 USD = X units of currency)
export const DEFAULT_EXCHANGE_RATES = {
  USD: 1, // Base currency
  EUR: 0.92, // 1 USD = 0.92 EUR
  KES: 138.5, // 1 USD = 138.50 KES
  ZWL: 6550, // 1 USD = 6550 ZWL
  ZAR: 19.15, // 1 USD = 19.15 ZAR
  BWP: 13.85, // 1 USD = 13.85 BWP
  ZMW: 26.95, // 1 USD = 26.95 ZMW
  MZN: 64.25, // 1 USD = 64.25 MZN
} as const satisfies Record<CurrencyCode, number>;

export type CurrencyCode =
  | "USD" // United States Dollar
  | "EUR" // Euro
  | "ZWL" // Zimbabwe Dollar
  | "ZAR" // South African Rand
  | "BWP" // Botswana Pula
  | "ZMW" // Zambian Kwacha
  | "MZN" // Mozambican Metical
  | "KES"; // Kenyan Shilling

// Currency information with flags
export interface CurrencyInfo {
  code: CurrencyCode;
  name: string;
  symbol: string;
  flag: string; // Flag emoji
}

// Currency information for UI display
export const CURRENCY_INFO: Record<CurrencyCode, CurrencyInfo> = {
  USD: { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  EUR: { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  ZWL: { code: "ZWL", name: "Zimbabwe Dollar", symbol: "Z$", flag: "🇿🇼" },
  ZAR: { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  BWP: { code: "BWP", name: "Botswana Pula", symbol: "P", flag: "🇧🇼" },
  ZMW: { code: "ZMW", name: "Zambian Kwacha", symbol: "K", flag: "🇿🇲" },
  MZN: { code: "MZN", name: "Mozambican Metical", symbol: "MT", flag: "🇲🇿" },
  KES: { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪" },
};

// Define the Money object structure
export interface Money {
  amount: number;
  currency: CurrencyCode;
  exchangeRate: number; // Rate relative to USD (e.g., 1 USD = X of this currency)
}

import { useMoneyContext } from "@/contexts/MoneyContext";

// Custom hook for money operations
export function useMoneyOperations() {
  const { baseCurrency, exchangeRates } = useMoneyContext();

  const createMoney = (
    amount: number,
    currency?: CurrencyCode,
    exchangeRate?: number
  ): Money => {
    const actualCurrency = currency || baseCurrency;
    const actualRate = exchangeRate || exchangeRates[actualCurrency];

    return {
      amount,
      currency: actualCurrency,
      exchangeRate: actualRate,
    };
  };

  const convertMoney = (
    money: Money,
    targetCurrency: CurrencyCode,
    targetExchangeRate?: number
  ): Money => {
    if (money.currency === targetCurrency) {
      return money;
    }

    const actualTargetRate =
      targetExchangeRate || exchangeRates[targetCurrency];

    // Convert to base currency first (if not already in base currency)
    const valueInBaseCurrency =
      money.currency === baseCurrency
        ? money.amount
        : money.amount / money.exchangeRate;

    // Then convert from base currency to target currency
    const valueInTargetCurrency = valueInBaseCurrency * actualTargetRate;

    return {
      amount: valueInTargetCurrency,
      currency: targetCurrency,
      exchangeRate: actualTargetRate,
    };
  };

  return {
    createMoney,
    convertMoney,
    baseCurrency,
    exchangeRates,
  };
}

// Helper functions for use outside React components
// Export the createMoney function for use outside React components
export function createMoney(
  amount: number,
  currency: CurrencyCode = BASE_CURRENCY,
  exchangeRate: number = 1
): Money {
  return {
    amount,
    currency,
    exchangeRate,
  };
}

export function createMoneyWithRates(
  amount: number,
  currency: CurrencyCode,
  exchangeRate: number
): Money {
  return {
    amount,
    currency,
    exchangeRate,
  };
}

// Helper function to convert Money
export function convertMoney(
  money: Money,
  targetCurrency: CurrencyCode,
  targetExchangeRate: number
): Money {
  if (money.currency === targetCurrency) {
    return money;
  }

  // Convert to target currency
  const valueInTargetCurrency =
    money.amount * (targetExchangeRate / money.exchangeRate);

  return {
    amount: valueInTargetCurrency,
    currency: targetCurrency,
    exchangeRate: targetExchangeRate,
  };
}

// Helper function to convert Money without context
export function convertMoneyWithRates(
  money: Money,
  targetCurrency: CurrencyCode,
  targetExchangeRate: number,
  baseCurrency: CurrencyCode
): Money {
  if (money.currency === targetCurrency) {
    return money;
  }

  // Convert to base currency first (if not already in base currency)
  const valueInBaseCurrency =
    money.currency === baseCurrency
      ? money.amount
      : money.amount / money.exchangeRate;

  // Then convert from base currency to target currency
  const valueInTargetCurrency = valueInBaseCurrency * targetExchangeRate;

  return {
    amount: valueInTargetCurrency,
    currency: targetCurrency,
    exchangeRate: targetExchangeRate,
  };
}

// Helper function to format Money for display
export function formatMoney(money: Money): string {
  // Use the standard formatter for all currencies
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true, // Ensure thousands separators are used
  });

  return formatter.format(money.amount);
}

// Helper function to format number with thousands separator and 2 decimal places
export function formatNumberWithCommas(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(value);
}
