// lib/getInitialSettings.ts
import { CurrencyCode } from "@/types/money";
import type { MoneyContextType } from "@/contexts/MoneyContext";

// Default exchange rates that will be used on server-side
const DEFAULT_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.85,
  ZWL: 321.32,
  ZAR: 15.67,
  BWP: 10.88,
  ZMW: 18.45,
  MZN: 63.21,
  KES: 108.75,
};

// This function is used on the server-side in the root layout
export async function getInitialMoneySettings(): Promise<MoneyContextType> {
  // Note: We don't try to call getShopSettings() here since it's browser-only

  // Instead, we return default settings for server-side rendering
  // The client-side component will fetch the actual settings
  // if initialSettings aren't provided
  return {
    baseCurrency: "USD",
    exchangeRates: DEFAULT_EXCHANGE_RATES,
    availableCurrencies: Object.keys(DEFAULT_EXCHANGE_RATES) as CurrencyCode[],
    isLoading: false,
  };
}
