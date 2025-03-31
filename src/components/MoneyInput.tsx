"use client";

import React, { useState } from "react";
import {
  Group,
  NumberInput,
  Select,
  ActionIcon,
  Popover,
  Text,
  Stack,
  Button,
  Tooltip,
  NumberInputProps,
} from "@mantine/core";
import { IconExchange, IconInfoCircle } from "@tabler/icons-react";
import {
  Money,
  CurrencyCode,
  CURRENCY_INFO,
  DEFAULT_EXCHANGE_RATES,
  createMoney,
  BASE_CURRENCY,
  formatNumberWithCommas,
} from "@/types/money";

// Omit the onChange and value props from NumberInputProps since we'll provide our own
type NumberInputPropsWithoutValueAndOnChange = Omit<
  NumberInputProps,
  "onChange" | "value"
>;

interface MoneyInputProps extends NumberInputPropsWithoutValueAndOnChange {
  value: Money;
  onChange: (value: Money) => void;
  label?: string;
  description?: string;
  required?: boolean;
}

export default function MoneyInput({
  value,
  onChange,
  label,
  description,
  required,
  ...props
}: MoneyInputProps) {
  const [amount, setAmount] = useState<number | string>(value.amount);
  const [currency, setCurrency] = useState<CurrencyCode>(value.currency);
  const [exchangeRate, setExchangeRate] = useState<number>(value.exchangeRate);
  const [exchangeRateInput, setExchangeRateInput] = useState<number | string>(
    value.exchangeRate
  );
  const [popoverOpened, setPopoverOpened] = useState(false);

  // Generate currency data for the select dropdown
  const currencyData = Object.values(CURRENCY_INFO).map((currency) => ({
    value: currency.code,
    label: `${currency.flag} ${currency.code} - ${currency.name}`,
  }));

  // Handle amount change
  const handleAmountChange = (newAmount: number | string) => {
    setAmount(newAmount);
    if (typeof newAmount === "number") {
      onChange(createMoney(newAmount, currency, exchangeRate));
    }
  };

  // Handle currency change
  const handleCurrencyChange = (newCurrency: string | null) => {
    if (!newCurrency) return;

    const currencyCode = newCurrency as CurrencyCode;
    const newExchangeRate = DEFAULT_EXCHANGE_RATES[currencyCode];

    setCurrency(currencyCode);
    setExchangeRate(newExchangeRate);
    setExchangeRateInput(newExchangeRate);

    if (typeof amount === "number") {
      onChange(createMoney(amount, currencyCode, newExchangeRate));
    }
  };

  // Handle exchange rate update
  const handleExchangeRateUpdate = () => {
    if (typeof exchangeRateInput === "number" && exchangeRateInput > 0) {
      setExchangeRate(exchangeRateInput);

      if (typeof amount === "number") {
        onChange(createMoney(amount, currency, exchangeRateInput));
      }

      setPopoverOpened(false);
    }
  };

  return (
    <Stack gap="xs">
      {label && (
        <Text fw={500} size="sm">
          {label}{" "}
          {required && (
            <Text span c="red">
              *
            </Text>
          )}
        </Text>
      )}

      <Stack gap="xs">
        <Group gap="xs" align="center">
          <Select
            data={currencyData}
            value={currency}
            onChange={handleCurrencyChange}
            style={{ width: "250px" }}
            size="lg"
          />

          <NumberInput
            value={amount}
            onChange={handleAmountChange}
            leftSection={<Text>{CURRENCY_INFO[currency].symbol}</Text>}
            style={{ flex: 1 }}
            size="lg"
            thousandSeparator=","
            decimalScale={2}
            fixedDecimalScale
            {...props}
          />

          <Popover
            opened={popoverOpened}
            onChange={setPopoverOpened}
            position="bottom-end"
            width={300}
            shadow="md"
          >
            <Popover.Target>
              <Tooltip label="Update Exchange Rate">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => setPopoverOpened((o) => !o)}
                  size="lg"
                >
                  <IconExchange size="1.2rem" />
                </ActionIcon>
              </Tooltip>
            </Popover.Target>

            <Popover.Dropdown>
              <Stack>
                <Text fw={500} size="sm">
                  Exchange Rate
                </Text>
                <Text size="xs" c="dimmed">
                  1 {BASE_CURRENCY} = X {currency}
                </Text>
                <NumberInput
                  value={exchangeRateInput}
                  onChange={setExchangeRateInput}
                  min={0.000001}
                  step={0.01}
                  leftSection={<IconExchange size="1rem" />}
                />
                <Group justify="flex-end">
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => {
                      setExchangeRateInput(DEFAULT_EXCHANGE_RATES[currency]);
                    }}
                  >
                    Reset
                  </Button>
                  <Button size="xs" onClick={handleExchangeRateUpdate}>
                    Update
                  </Button>
                </Group>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Group>

        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}

        <Group gap="xs" align="center">
          <Text size="xs" c="dimmed" style={{ opacity: 0.7 }}>
            Exchange Rate: 1 {BASE_CURRENCY} ={" "}
            {formatNumberWithCommas(exchangeRate)} {currency}
          </Text>
          <Tooltip label="Click the exchange icon above to update the rate">
            <ActionIcon variant="transparent" size="xs" color="gray">
              <IconInfoCircle size="0.8rem" />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Stack>
    </Stack>
  );
}
