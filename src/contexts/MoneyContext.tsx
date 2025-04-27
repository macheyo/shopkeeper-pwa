import React, { createContext, useContext, useEffect, useState } from "react";
import { CurrencyCode } from "@/types/money";
import { getShopSettings } from "@/lib/settingsDB";

interface MoneyContextType {
  baseCurrency: CurrencyCode;
  exchangeRates: Record<CurrencyCode, number>;
  isLoading: boolean;
}

// Default exchange rates (1:1 with base currency)
const DEFAULT_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 1,
  ZWL: 1,
  ZAR: 1,
  BWP: 1,
  ZMW: 1,
  MZN: 1,
  KES: 1,
};

const MoneyContext = createContext<MoneyContextType>({
  baseCurrency: "USD",
  exchangeRates: DEFAULT_EXCHANGE_RATES,
  isLoading: true,
});

export function useMoneyContext() {
  return useContext(MoneyContext);
}

export function MoneyProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MoneyContextType>({
    baseCurrency: "USD",
    exchangeRates: DEFAULT_EXCHANGE_RATES,
    isLoading: true,
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await getShopSettings();
        if (settings) {
          // Start with default rates
          const rates = { ...DEFAULT_EXCHANGE_RATES };
          // Set base currency rate to 1
          rates[settings.baseCurrency as CurrencyCode] = 1;
          // Update rates from settings
          settings.currencies.forEach((c) => {
            rates[c.code as CurrencyCode] = c.exchangeRate;
          });

          setState({
            baseCurrency: settings.baseCurrency as CurrencyCode,
            exchangeRates: rates,
            isLoading: false,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error("Error loading money settings:", error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }

    loadSettings();
  }, []);

  return (
    <MoneyContext.Provider value={state}>{children}</MoneyContext.Provider>
  );
}
