// Define supported currencies
export type CurrencyCode =
  | "USD" // United States Dollar
  | "EUR" // Euro
  | "ZWL" // Zimbabwe Dollar
  | "ZAR" // South African Rand
  | "BWP" // Botswana Pula
  | "ZMW" // Zambian Kwacha
  | "MZN"; // Mozambican Metical

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
};

// Define the Money object structure
export interface Money {
  amount: number;
  currency: CurrencyCode;
  exchangeRate: number; // Rate relative to USD (e.g., 1 USD = X of this currency)
}

// Default base currency
export const BASE_CURRENCY: CurrencyCode = "USD";

// Helper function to create a Money object
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

// Helper function to convert Money to a different currency
export function convertMoney(
  money: Money,
  targetCurrency: CurrencyCode,
  targetExchangeRate: number
): Money {
  if (money.currency === targetCurrency) {
    return money;
  }

  // Convert to base currency first (if not already in base currency)
  const valueInBaseCurrency =
    money.currency === BASE_CURRENCY
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

// Sample exchange rates (to be replaced with actual rates from an API or user input)
export const DEFAULT_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1, // USD is the reference currency
  EUR: 0.92,
  ZWL: 3250.5,
  ZAR: 18.65,
  BWP: 13.75,
  ZMW: 26.3,
  MZN: 63.85,
};
