"use client"; // Mark as client component

import React, { createContext, useContext, useState, useEffect } from "react";
import { CurrencyCode } from "@/types/money";
import { getShopSettings } from "@/lib/settingsDB";
import { useAuth } from "@/contexts/AuthContext";

// Define the MoneyContextType clearly
export interface MoneyContextType {
  baseCurrency: CurrencyCode;
  exchangeRates: Record<CurrencyCode, number>;
  availableCurrencies: CurrencyCode[];
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

// Create context with default values
const MoneyContext = createContext<MoneyContextType>({
  baseCurrency: "USD",
  exchangeRates: DEFAULT_EXCHANGE_RATES,
  availableCurrencies: Object.keys(DEFAULT_EXCHANGE_RATES) as CurrencyCode[],
  isLoading: true,
});

// Export the hook
export function useMoneyContext() {
  return useContext(MoneyContext);
}

// Define props interface for the provider
export interface MoneyProviderProps {
  children: React.ReactNode;
  initialSettings?: MoneyContextType;
}

// Export the provider component
export function MoneyProvider({
  children,
  initialSettings,
}: MoneyProviderProps) {
  const { shop } = useAuth();
  const [state, setState] = useState<MoneyContextType>(
    initialSettings || {
      baseCurrency: "USD",
      exchangeRates: DEFAULT_EXCHANGE_RATES,
      availableCurrencies: Object.keys(
        DEFAULT_EXCHANGE_RATES
      ) as CurrencyCode[],
      isLoading: !initialSettings, // Only show loading if no initial settings
    }
  );

  // Only fetch settings if no initialSettings were provided
  useEffect(() => {
    // Skip loading if we already have initial settings
    if (initialSettings) return;

    async function loadSettings() {
      try {
        const settings = await getShopSettings(shop?.shopId);

        if (settings) {
          // Start with default rates
          const rates = { ...DEFAULT_EXCHANGE_RATES };

          // Set base currency rate to 1
          rates[settings.baseCurrency as CurrencyCode] = 1;

          // Get available currencies from settings
          const availableCurrencies = settings.currencies.map(
            (c) => c.code as CurrencyCode
          );

          // Make sure base currency is included
          if (
            !availableCurrencies.includes(settings.baseCurrency as CurrencyCode)
          ) {
            availableCurrencies.push(settings.baseCurrency as CurrencyCode);
          }

          // Update rates from settings
          settings.currencies.forEach((c) => {
            rates[c.code as CurrencyCode] = c.exchangeRate;
          });

          setState({
            baseCurrency: settings.baseCurrency as CurrencyCode,
            exchangeRates: rates,
            availableCurrencies,
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
  }, [initialSettings, shop?.shopId]);

  return (
    <MoneyContext.Provider value={state}>{children}</MoneyContext.Provider>
  );
}
