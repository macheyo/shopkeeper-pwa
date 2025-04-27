import React from "react";
import { NumberInput, NumberInputProps } from "@mantine/core";
import { Money, CurrencyCode, DEFAULT_EXCHANGE_RATES } from "@/types/money";

interface MoneyInputProps extends Omit<NumberInputProps, "value" | "onChange"> {
  value: Money | number;
  onChange: (value: Money | number) => void;
  currency?: CurrencyCode;
  exchangeRate?: number;
  precision?: number;
}

export default function MoneyInput({
  value,
  onChange,
  currency = "USD",
  exchangeRate = DEFAULT_EXCHANGE_RATES[currency],
  precision = 2,
  ...props
}: MoneyInputProps) {
  // Calculate step based on precision
  const step = 1 / Math.pow(10, precision);

  // Handle both Money objects and plain numbers
  const amount = typeof value === "number" ? value : value.amount;

  return (
    <NumberInput
      {...props}
      value={amount}
      onChange={(newAmount) => {
        if (typeof newAmount === "number") {
          if (typeof value === "number") {
            // If input was a number, return a number
            onChange(newAmount);
          } else {
            // If input was a Money object, return a Money object
            onChange({
              ...value,
              amount: newAmount,
              exchangeRate: exchangeRate, // Use provided exchange rate
            });
          }
        }
      }}
      decimalSeparator="."
      step={step}
      hideControls
      thousandSeparator=","
    />
  );
}
