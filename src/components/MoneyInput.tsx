import React, { useEffect, useState } from "react";
import {
  Group,
  Select,
  Text,
  useMantineTheme,
  Input,
  TextInput,
} from "@mantine/core";
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
  variant?: "dark" | "light";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  customCurrencies?: CurrencyCode[];
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
  variant = "dark",
  size = "md",
  customCurrencies,
}: MoneyInputProps) {
  const theme = useMantineTheme();
  // Get currency context
  const { baseCurrency, exchangeRates, availableCurrencies } =
    useMoneyContext();

  // Use custom currencies if provided, otherwise use availableCurrencies from context
  const currenciesToUse = customCurrencies || availableCurrencies;

  // Theme colors based on variant
  const isLight = variant === "light";
  const borderColor = error
    ? "red"
    : isLight
    ? theme.colors.gray[3]
    : "#313131";
  const backgroundColor = isLight ? theme.white : "rgba(255, 255, 255, 0.05)";
  const textColor = isLight ? theme.black : "#fff";
  const placeholderColor = isLight
    ? "rgba(0, 0, 0, 0.5)"
    : "rgba(255, 255, 255, 0.5)";

  // Handle both Money objects and plain numbers
  const amount = typeof value === "number" ? value : value.amount;
  const currency =
    propCurrency ||
    (typeof value === "object" && value !== null
      ? value.currency
      : baseCurrency);
  const exchangeRate = exchangeRates[currency] || 1;

  // Format exchange rate for display
  const formatExchangeRate = (rate: number) => {
    return `1 ${baseCurrency} = ${rate.toFixed(2)} ${currency}`;
  };

  // State to track if input is focused and display value
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState<string>("");

  // Format number with thousands separators and 2 decimal places for money
  const formatNumber = (value: number | string | undefined): string => {
    if (value === undefined || value === null || value === "") return "";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return "";

    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(numValue);
  };

  // Initialize display value
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatNumber(amount));
    }
  }, [amount, precision, isFocused]);

  // Get currency data for dropdown from available currencies
  const currencyData = currenciesToUse.map((code) => ({
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
    } else if (typeof newAmount === "string") {
      // Handle string input (for formatted values)
      const cleaned = newAmount.replace(/[^\d.-]/g, "");
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        handleAmountChange(parsed);
      }
    }
  };

  // Handle input focus - show raw number
  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(amount?.toString() || "");
  };

  // Handle input blur - format the number
  const handleBlur = () => {
    setIsFocused(false);
    // Parse the current display value and update the amount
    const cleaned = displayValue.replace(/[^\d.-]/g, "");
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      handleAmountChange(parsed);
    }
    setDisplayValue(formatNumber(amount));
  };

  // Handle input change while focused
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDisplayValue(value);
    // Allow typing, but don't update the actual amount until blur
  };

  return (
    <Input.Wrapper
      label={label}
      description={description}
      required={required}
      error={error}
      size={size}
      style={{ width: "100%" }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "42px",
          borderRadius: "4px",
          overflow: "hidden",
          border: `1px solid ${borderColor}`,
          backgroundColor: backgroundColor,
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
                borderRight: `1px solid ${borderColor}`,
                borderRadius: 0,
                backgroundColor: isLight ? theme.white : "transparent",
                color: textColor,
                paddingLeft: "16px",
                fontSize: "16px",
              },
              dropdown: {
                backgroundColor: isLight ? theme.white : theme.colors.dark[7],
              },
              option: {
                backgroundColor: isLight ? theme.white : theme.colors.dark[7],
                color: textColor,
                "&:hover": {
                  backgroundColor: isLight
                    ? theme.colors.blue[0]
                    : theme.colors.dark[6],
                },
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
              borderRight: `1px solid ${borderColor}`,
              color: textColor,
              fontSize: "16px",
            }}
          >
            {CURRENCY_INFO[currency as CurrencyCode].symbol} {currency}
          </div>
        )}

        <TextInput
          value={isFocused ? displayValue : formatNumber(amount)}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder || "0"}
          disabled={disabled}
          type="text"
          inputMode="decimal"
          styles={{
            root: { flex: 1 },
            input: {
              height: "40px",
              border: "none",
              backgroundColor: isLight ? theme.white : "transparent",
              color: textColor,
              paddingLeft: "16px",
              fontSize: "16px",
              "::placeholder": {
                color: placeholderColor,
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
    </Input.Wrapper>
  );
}
