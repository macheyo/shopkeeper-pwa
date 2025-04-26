import React from "react";
import { PaymentMethod } from "@/types";
import { Select } from "@mantine/core";

interface PaymentMethodSelectProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  className?: string;
}

export function PaymentMethodSelect({
  value,
  onChange,
  className = "",
}: PaymentMethodSelectProps) {
  return (
    <Select
      label="Payment Method"
      value={value}
      onChange={(value) => onChange(value as PaymentMethod)}
      data={[
        { value: "cash", label: "Cash" },
        { value: "bank", label: "Bank" },
        { value: "mobile_money", label: "Mobile Money" },
        { value: "credit", label: "Credit" },
      ]}
      className={className}
    />
  );
}
