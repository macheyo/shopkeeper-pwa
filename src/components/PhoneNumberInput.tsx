"use client";

import React from "react";
import { TextInput, Select, Group, Text } from "@mantine/core";
import { getCountryCodeSelectData } from "@/lib/countryCodes";
import { validatePhoneNumber } from "@/lib/phoneValidation";

interface PhoneNumberInputProps {
  countryCode: string;
  phoneNumber: string;
  onCountryCodeChange: (value: string) => void;
  onPhoneNumberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: React.ReactNode;
  description?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

// Format phone number as user types (e.g., "123 456 7890")
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");

  // Limit to reasonable length (15 digits max for international numbers)
  const limitedDigits = digits.slice(0, 15);

  // Format based on length - group digits for readability
  if (limitedDigits.length <= 3) {
    return limitedDigits;
  } else if (limitedDigits.length <= 6) {
    return `${limitedDigits.slice(0, 3)} ${limitedDigits.slice(3)}`;
  } else if (limitedDigits.length <= 9) {
    return `${limitedDigits.slice(0, 3)} ${limitedDigits.slice(
      3,
      6
    )} ${limitedDigits.slice(6)}`;
  } else {
    return `${limitedDigits.slice(0, 3)} ${limitedDigits.slice(
      3,
      6
    )} ${limitedDigits.slice(6, 9)} ${limitedDigits.slice(9)}`;
  }
};

export default function PhoneNumberInput({
  countryCode,
  phoneNumber,
  onCountryCodeChange,
  onPhoneNumberChange,
  label = "Phone Number",
  placeholder = "771 802 312",
  required = false,
  disabled = false,
  error,
  description,
  size = "md",
}: PhoneNumberInputProps) {
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.currentTarget.value);
    // Create a synthetic event with the formatted value
    const syntheticEvent = {
      ...e,
      currentTarget: {
        ...e.currentTarget,
        value: formatted,
      },
    };
    onPhoneNumberChange(syntheticEvent);
  };

  const validationError =
    phoneNumber.trim() && !validatePhoneNumber(phoneNumber).valid
      ? validatePhoneNumber(phoneNumber).error
      : undefined;

  const displayError = error || validationError;

  return (
    <div>
      {label && (
        <Text size="sm" fw={500} mb="xs">
          {label}
          {required && " *"}
        </Text>
      )}
      <Group wrap="nowrap" gap="xs">
        <Select
          value={countryCode}
          onChange={(value) => onCountryCodeChange(value || "+263")}
          data={getCountryCodeSelectData()}
          searchable
          placeholder="Code"
          style={{ width: 120 }}
          disabled={disabled}
          size={size}
        />
        <TextInput
          placeholder={placeholder}
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneNumberChange}
          required={required}
          disabled={disabled}
          style={{ flex: 1 }}
          error={displayError}
          description={description}
          size={size}
        />
      </Group>
    </div>
  );
}
