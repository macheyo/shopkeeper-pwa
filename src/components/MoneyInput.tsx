import React, { useEffect } from "react";
import { NumberInput, Group, Select, Text } from "@mantine/core";
import { Money, CurrencyCode, CURRENCY_INFO } from "@/types/money";
import { useMoneyContext } from "@/contexts/MoneyContext";
import { IconExchange } from "@tabler/icons-react";

interface MoneyInputProps {
  value: Money | number;
  onChange: (value: Money | number) => void;
  currency?: CurrencyCode;
  precision?: number;
  showCurrencySelect?: boolean;
  showExchangeRate?: boolean;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: React.ReactNode;
}

export default function MoneyInput({
  value,
  onChange,
  currency: propCurrency,
  precision = 2,
  showCurrencySelect = true,
  showExchangeRate = true,
  label,
  description,
  placeholder,
  disabled,
  required,
  error,
}: MoneyInputProps) {
  // Get currency context
  const { baseCurrency, exchangeRates, availableCurrencies } =
    useMoneyContext();

  // Handle both Money objects and plain numbers
  const amount = typeof value === "number" ? value : value.amount;

  // Determine the current currency - prioritize the currency from the Money object
  // This ensures that when currency is changed via the dropdown, it's reflected immediately
  const currency =
    typeof value === "object" && value !== null
      ? value.currency
      : propCurrency || baseCurrency;

  const exchangeRate = exchangeRates[currency] || 1;

  // Calculate step based on precision
  const step = 1 / Math.pow(10, precision);

  // Format exchange rate for display
  const formatExchangeRate = (rate: number) => {
    return `1 ${baseCurrency} = ${rate.toFixed(2)} ${currency}`;
  };

  // Get currency data for dropdown from available currencies in settings
  const currencyData = availableCurrencies.map((code) => ({
    value: code,
    label: `${CURRENCY_INFO[code].symbol} ${code}`,
  }));

  // Debug logging for development
  useEffect(() => {
    console.log("MoneyInput value:", value);
    console.log("Current currency:", currency);
  }, [value, currency]);

  // Handle currency change with robust implementation
  const handleCurrencyChange = (newCurrency: string | null) => {
    console.log("Currency selected:", newCurrency);
    if (!newCurrency) return;

    const newCurrencyCode = newCurrency as CurrencyCode;
    const newExchangeRate = exchangeRates[newCurrencyCode] || 1;

    if (typeof value === "object" && value !== null) {
      // If value is a Money object, update its currency and exchange rate
      const updatedValue = {
        ...value,
        currency: newCurrencyCode,
        exchangeRate: newExchangeRate,
      };
      console.log("Updating Money object:", updatedValue);
      onChange(updatedValue);
    } else {
      // If value is a number or something else, create a new Money object
      const newValue = {
        amount: typeof value === "number" ? value : 0,
        currency: newCurrencyCode,
        exchangeRate: newExchangeRate,
      };
      console.log("Creating new Money object:", newValue);
      onChange(newValue);
    }
  };

  // Handle amount change
  const handleAmountChange = (newAmount: number | string) => {
    if (typeof newAmount === "number") {
      if (typeof value === "number") {
        // Just update the number
        onChange(newAmount);
      } else if (typeof value === "object" && value !== null) {
        // Update amount in Money object
        onChange({
          ...value,
          amount: newAmount,
        });
      } else {
        // Create new Money object if value is invalid
        onChange({
          amount: newAmount,
          currency: currency,
          exchangeRate: exchangeRate,
        });
      }
    }
  };

  return (
    <>
      {label && (
        <div style={{ marginBottom: "5px" }}>
          <Text size="md" fw={500}>
            {label}
            {required && <span style={{ color: "red" }}> *</span>}
          </Text>
          {description && (
            <Text size="sm" color="dimmed">
              {description}
            </Text>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          width: "100%",
          height: "42px",
          borderRadius: "4px",
          overflow: "hidden",
          border: `1px solid ${error ? "red" : "#313131"}`,
          backgroundColor: "rgba(255, 255, 255, 0.05)",
        }}
      >
        {showCurrencySelect ? (
          <Select
            value={currency}
            onChange={handleCurrencyChange}
            data={currencyData}
            disabled={disabled}
            styles={{
              root: {
                width: "142px",
                minWidth: "142px",
              },
              input: {
                height: "40px",
                border: "none",
                borderRight: "1px solid #313131",
                borderRadius: 0,
                backgroundColor: "transparent",
                color: "#fff",
                paddingLeft: "16px",
                fontSize: "16px",
              },
            }}
          />
        ) : (
          <div
            style={{
              width: "142px",
              minWidth: "142px",
              display: "flex",
              alignItems: "center",
              paddingLeft: "16px",
              borderRight: "1px solid #313131",
              color: "#fff",
              fontSize: "16px",
            }}
          >
            {CURRENCY_INFO[currency as CurrencyCode].symbol} {currency}
          </div>
        )}

        <NumberInput
          value={amount}
          onChange={handleAmountChange}
          placeholder={placeholder || "0"}
          disabled={disabled}
          error={false}
          hideControls
          step={step}
          decimalScale={precision}
          styles={{
            root: { flex: 1 },
            input: {
              height: "40px",
              border: "none",
              backgroundColor: "transparent",
              color: "#fff",
              paddingLeft: "16px",
              fontSize: "16px",
              "::placeholder": {
                color: "rgba(255, 255, 255, 0.5)",
              },
            },
          }}
        />
      </div>

      {showExchangeRate && currency !== baseCurrency && (
        <Group gap="xs" mt={5}>
          <IconExchange size={16} color="#ccc" />
          <Text size="sm" color="dimmed">
            {formatExchangeRate(exchangeRate)}
          </Text>
        </Group>
      )}

      {error && (
        <Text size="xs" color="red" mt={5}>
          {error}
        </Text>
      )}
    </>
  );
}
