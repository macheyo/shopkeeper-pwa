import React, { useState } from "react";
import {
  Stepper,
  TextInput,
  Select,
  Stack,
  Title,
  Text,
  Button,
  Group,
  Card,
  ActionIcon,
  Alert,
  Box,
  useMantineTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconAlertCircle } from "@tabler/icons-react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { CurrencyCode, CURRENCY_INFO, Money } from "@/types/money";
import { saveShopSettings } from "@/lib/settingsDB";
import { createOpeningBalanceEntries } from "@/lib/accounting";
import { AccountCode } from "@/types/accounting";
import MoneyInput from "./MoneyInput";

import { AccountSettings } from "@/types";

interface CurrencySettings {
  code: CurrencyCode;
  exchangeRate: number;
}

export default function OnboardingWizard({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [shopName, setShopName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>("USD");
  const [currencies, setCurrencies] = useState<CurrencySettings[]>([]);
  const [accounts, setAccounts] = useState<AccountSettings[]>([]);

  const nextStep = () => {
    // Validate current step
    setError(null);
    switch (active) {
      case 0:
        // Shop Details
        if (!shopName || !businessType) {
          setError("Please fill in all required fields");
          return;
        }
        break;
      case 1:
        // Currency Settings
        if (!baseCurrency) {
          setError("Please select a base currency");
          return;
        }
        break;
      case 2:
        // Opening Balances
        if (accounts.length === 0) {
          setError("Please add at least one account");
          return;
        }
        if (accounts.some((a) => !a.name || a.balance < 0)) {
          setError("Please ensure all accounts have names and valid balances");
          return;
        }
        break;
    }
    setActive((current) => current + 1);
  };
  const prevStep = () => setActive((current) => current - 1);

  const handleAddCurrency = () => {
    setCurrencies((curr) => [
      ...curr,
      { code: "USD", exchangeRate: 1 } as CurrencySettings,
    ]);
  };

  const handleRemoveCurrency = (index: number) => {
    setCurrencies((curr) => curr.filter((_, i) => i !== index));
  };

  const handleCurrencyChange = (
    index: number,
    field: keyof CurrencySettings,
    value: string | number
  ) => {
    setCurrencies((curr) =>
      curr.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleAddAccount = () => {
    setAccounts((curr) => [
      ...curr,
      {
        id: crypto.randomUUID(),
        name: "Cash Account",
        type: "cash",
        balance: 0,
        currency: baseCurrency,
      },
    ]);
  };

  const handleRemoveAccount = (index: number) => {
    setAccounts((curr) => curr.filter((_, i) => i !== index));
  };

  const handleAccountChange = (
    index: number,
    field: keyof AccountSettings,
    value: AccountSettings[keyof AccountSettings]
  ) => {
    setAccounts((curr) =>
      curr.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  };

  const handleFinish = async () => {
    setError(null);
    setIsLoading(true);
    try {
      // Ensure base currency is in the currencies list
      const hasBaseCurrency = currencies.some((c) => c.code === baseCurrency);
      const finalCurrencies = hasBaseCurrency
        ? currencies
        : [{ code: baseCurrency, exchangeRate: 1 }, ...currencies];

      // Save settings
      await saveShopSettings({
        shopName,
        businessType,
        baseCurrency,
        currencies: finalCurrencies.map((c) => ({
          code: c.code,
          exchangeRate: c.exchangeRate,
        })),
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: a.balance,
          currency: a.currency,
        })),
        type: "settings",
        hasCompletedOnboarding: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Create opening balance entries
      await createOpeningBalanceEntries(
        accounts.map((a) => ({
          accountCode: AccountCode.CASH, // All accounts are treated as cash for accounting purposes
          balance: {
            amount: a.balance,
            currency: a.currency as CurrencyCode,
            exchangeRate:
              finalCurrencies.find((c) => c.code === a.currency)
                ?.exchangeRate || 1,
          } as Money,
        })),
        new Date().toISOString()
      );

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      setIsLoading(false);
    }
  };

  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  return (
    <Stack gap="xl" p={isMobile ? "xs" : "xl"}>
      <Title order={1} size={isMobile ? "h2" : "h1"}>
        Welcome to ShopKeeper!
      </Title>
      <Text size={isMobile ? "md" : "lg"}>
        Let&apos;s get your shop set up. This wizard will guide you through
        setting up your shop&apos;s basic information, currencies, and accounts.
      </Text>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
          {error}
        </Alert>
      )}

      <Stepper
        active={active}
        onStepClick={setActive}
        orientation={isMobile ? "vertical" : "horizontal"}
        size={isMobile ? "sm" : "md"}
      >
        <Stepper.Step
          label="Shop Details"
          description="Basic information about your shop"
        >
          <Stack gap="md" mt={isMobile ? "md" : "xl"}>
            <TextInput
              label="Shop Name"
              placeholder="Enter your shop name"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
              size={isMobile ? "sm" : "md"}
            />
            <Select
              label="Business Type"
              placeholder="Select your business type"
              value={businessType}
              onChange={(value) => value && setBusinessType(value)}
              data={[
                { value: "retail", label: "Retail Store" },
                { value: "wholesale", label: "Wholesale Business" },
                { value: "service", label: "Service Business" },
                { value: "restaurant", label: "Restaurant" },
                { value: "other", label: "Other" },
              ]}
              required
              size={isMobile ? "sm" : "md"}
            />
          </Stack>
        </Stepper.Step>

        <Stepper.Step
          label="Currency Settings"
          description="Set up your currencies"
        >
          <Stack gap="md" mt={isMobile ? "md" : "xl"}>
            <Select
              label="Base Currency"
              description="All transactions will be converted to this currency"
              value={baseCurrency}
              onChange={(value) =>
                value && setBaseCurrency(value as CurrencyCode)
              }
              data={Object.values(CURRENCY_INFO).map((currency) => ({
                value: currency.code,
                label: `${currency.flag} ${currency.code} - ${currency.name}`,
              }))}
              searchable
              required
              size={isMobile ? "sm" : "md"}
            />

            <Text size="sm" fw={500}>
              Additional Currencies (Optional)
              <Text size="xs" c="dimmed" component="span">
                Add any other currencies you&apos;ll be dealing with. You can
                always add more later.
              </Text>
            </Text>
            {currencies.map((currency, index) => (
              <Card
                key={index}
                withBorder
                p={isMobile ? "xs" : "md"}
                style={{ position: "relative" }}
              >
                <Box
                  style={{
                    position: "absolute",
                    top: isMobile ? "8px" : "12px",
                    right: isMobile ? "8px" : "12px",
                    zIndex: 10,
                    padding: "4px",
                  }}
                >
                  <ActionIcon
                    color="red"
                    onClick={() => handleRemoveCurrency(index)}
                    size={isMobile ? "md" : "lg"}
                  >
                    <IconX size={isMobile ? 14 : 16} />
                  </ActionIcon>
                </Box>
                <Stack
                  gap={isMobile ? "xs" : "md"}
                  style={{ paddingRight: isMobile ? "48px" : "56px" }}
                >
                  <Select
                    label="Currency"
                    value={currency.code}
                    onChange={(value) =>
                      value &&
                      handleCurrencyChange(index, "code", value as CurrencyCode)
                    }
                    data={Object.values(CURRENCY_INFO).map((c) => ({
                      value: c.code,
                      label: `${c.flag} ${c.code} - ${c.name}`,
                    }))}
                    searchable
                    size={isMobile ? "sm" : "md"}
                  />
                  <MoneyInput
                    label="Exchange Rate"
                    description={`1 ${baseCurrency} = X ${currency.code}`}
                    value={currency.exchangeRate}
                    onChange={(value) =>
                      handleCurrencyChange(
                        index,
                        "exchangeRate",
                        typeof value === "number" ? value : value.amount
                      )
                    }
                    precision={4}
                    variant="light"
                    showCurrencySelect={false}
                    size={isMobile ? "sm" : "md"}
                  />
                </Stack>
              </Card>
            ))}
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={handleAddCurrency}
            >
              Add Currency
            </Button>
          </Stack>
        </Stepper.Step>

        <Stepper.Step
          label="Opening Balances"
          description="Set up your accounts"
        >
          <Stack gap="md" mt={isMobile ? "md" : "xl"}>
            <Text size="sm" fw={500}>
              Cash and Bank Accounts
              <Text size="xs" c="dimmed" component="span">
                Add your cash, mobile money, and bank accounts with their
                opening balances.
              </Text>
            </Text>
            {accounts.map((account, index) => (
              <Card
                key={index}
                withBorder
                p={isMobile ? "xs" : "md"}
                style={{ position: "relative" }}
              >
                <Box
                  style={{
                    position: "absolute",
                    top: isMobile ? "8px" : "12px",
                    right: isMobile ? "8px" : "12px",
                    zIndex: 10,
                    padding: "4px",
                  }}
                >
                  <ActionIcon
                    color="red"
                    onClick={() => handleRemoveAccount(index)}
                    size={isMobile ? "md" : "lg"}
                  >
                    <IconX size={isMobile ? 14 : 16} />
                  </ActionIcon>
                </Box>
                <Stack
                  gap={isMobile ? "xs" : "md"}
                  style={{ paddingRight: isMobile ? "48px" : "56px" }}
                >
                  <TextInput
                    label="Account Name"
                    value={account.name}
                    onChange={(e) =>
                      handleAccountChange(index, "name", e.target.value)
                    }
                    size={isMobile ? "sm" : "md"}
                  />
                  <Group grow align="flex-start">
                    <Select
                      label="Account Type"
                      value={account.type}
                      onChange={(value) =>
                        value && handleAccountChange(index, "type", value)
                      }
                      data={[
                        { value: "cash", label: "Cash" },
                        { value: "mobile_money", label: "Mobile Money" },
                        { value: "bank", label: "Bank Account" },
                      ]}
                      size={isMobile ? "sm" : "md"}
                    />
                    <MoneyInput
                      label="Balance"
                      value={account.balance}
                      currency={account.currency}
                      onChange={(value) => {
                        if (typeof value === "object" && value !== null) {
                          // If it's a Money object, update both balance and currency
                          handleAccountChange(index, "balance", value.amount);
                          handleAccountChange(
                            index,
                            "currency",
                            value.currency
                          );
                        } else {
                          // If it's just a number, only update balance
                          handleAccountChange(index, "balance", value);
                        }
                      }}
                      variant="light"
                      showCurrencySelect={true}
                      size={isMobile ? "sm" : "md"}
                      customCurrencies={[
                        baseCurrency,
                        ...currencies.map((c) => c.code),
                      ]}
                    />
                  </Group>
                </Stack>
              </Card>
            ))}
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={handleAddAccount}
            >
              Add Account
            </Button>
          </Stack>
        </Stepper.Step>

        <Stepper.Completed>
          <Stack gap="md" mt={isMobile ? "md" : "xl"}>
            <Title order={2} size={isMobile ? "h3" : "h2"}>
              All Set!
            </Title>
            <Text size={isMobile ? "sm" : "md"}>
              You&apos;ve completed the initial setup! Your shop is now ready to
              go. Click finish to start managing your business with ShopKeeper.
            </Text>
          </Stack>
        </Stepper.Completed>
      </Stepper>

      <Group
        justify="flex-end"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: isMobile ? "1rem" : "1.5rem",
          background: "var(--mantine-color-body)",
          borderTop: "1px solid var(--mantine-color-gray-3)",
          zIndex: 100,
          marginTop: "2rem",
          boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.1)",
        }}
      >
        {active > 0 && (
          <Button
            variant="default"
            onClick={prevStep}
            size={isMobile ? "sm" : "md"}
          >
            Back
          </Button>
        )}
        {active < 3 && (
          <Button
            onClick={nextStep}
            size={isMobile ? "sm" : "md"}
            disabled={
              (active === 0 && (!shopName || !businessType)) ||
              (active === 1 && !baseCurrency) ||
              (active === 2 &&
                (accounts.length === 0 ||
                  accounts.some((a) => !a.name || a.balance < 0)))
            }
          >
            Next
          </Button>
        )}
        {active === 3 && (
          <Button
            onClick={handleFinish}
            color="blue"
            loading={isLoading}
            disabled={isLoading}
            size={isMobile ? "sm" : "md"}
          >
            Finish
          </Button>
        )}
      </Group>
      {/* Add padding at the bottom to prevent content from being hidden behind fixed buttons */}
      <div style={{ height: isMobile ? "80px" : "100px" }} />
    </Stack>
  );
}
