"use client";

import React, { useState } from "react";
import {
  Title,
  Button,
  Group,
  TextInput,
  Paper,
  Stack,
  Text,
  Box,
  Divider,
  Alert,
} from "@mantine/core";
import { BASE_CURRENCY } from "@/types/money";
import MoneyInput from "@/components/MoneyInput";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconBarcode,
  IconAlertCircle,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getProductsDB } from "@/lib/databases";
import BarcodeScanner from "@/components/BarcodeScanner";

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const [moneyValue, setMoneyValue] = useState({
    amount: 0,
    currency: BASE_CURRENCY,
    exchangeRate: 1,
  });

  const form = useForm({
    initialValues: {
      name: "",
      price: 0,
      barcode: "",
    },
    validate: {
      name: (value: string) =>
        value.trim().length > 0 ? null : "Product name is required",
      price: (value: number) =>
        value >= 0 ? null : "Price must be 0 or greater",
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const productsDB = await getProductsDB();

      // Generate a unique product code
      const timestamp = Date.now();
      const randomPart = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      const generatedCode = `P${timestamp.toString().slice(-6)}${randomPart}`;

      // Create new product document
      const now = new Date().toISOString();
      const productId = `prod_${timestamp}`;

      await productsDB.put({
        _id: productId,
        type: "product",
        code: generatedCode.toUpperCase(), // Store codes in uppercase for consistency
        name: values.name,
        price: moneyValue,
        barcode: values.barcode || undefined, // Don't store empty strings
        createdAt: now,
        updatedAt: now,
      });

      setSuccess(true);
      form.reset();

      // Auto-navigate back after success
      setTimeout(() => {
        router.push("/products");
      }, 1500);
    } catch (err) {
      console.error("Error saving product:", err);
      setError(
        `Failed to save product: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleScanBarcode = (barcode: string) => {
    form.setFieldValue("barcode", barcode);
    setShowScanner(false);
  };

  return (
    <>
      <Box mb="lg">
        <Group justify="space-between" align="center">
          <Title order={2}>Add New Product</Title>
          <Button
            variant="outline"
            leftSection={<IconArrowLeft size={20} />}
            onClick={() => router.push("/products")}
            size="md"
          >
            Back
          </Button>
        </Group>
      </Box>

      {error && (
        <Alert
          icon={<IconAlertCircle size="1.5rem" />}
          title="Error"
          color="red"
          mb="md"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          title="Success"
          color="green"
          mb="md"
          withCloseButton
          onClose={() => setSuccess(false)}
        >
          Product saved successfully! Redirecting...
        </Alert>
      )}

      <Paper shadow="md" p="lg" withBorder>
        <Title order={3} mb="lg" ta="center">
          Enter Product Details
        </Title>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="lg">
            <TextInput
              label="Product Name"
              description="The name of the product"
              placeholder="Enter product name"
              required
              size="lg"
              {...form.getInputProps("name")}
            />

            <MoneyInput
              label="Price"
              description="The selling price of the product"
              placeholder="0"
              required
              value={moneyValue}
              onChange={(value) =>
                setMoneyValue((prev) => ({
                  ...prev,
                  amount: typeof value === "number" ? value : value.amount,
                }))
              }
            />

            <Divider
              label="Barcode (Optional)"
              labelPosition="center"
              size="md"
            />

            <Button
              fullWidth
              size="xl"
              leftSection={<IconBarcode size={24} />}
              onClick={() => setShowScanner(!showScanner)}
              color="green"
              h={60}
              mb="md"
            >
              {showScanner ? "Hide Scanner" : "Scan Barcode"}
            </Button>

            {showScanner ? (
              <Box mb="lg">
                <Text size="md" fw={500} mb="xs" ta="center">
                  Point camera at barcode
                </Text>
                <BarcodeScanner onScan={handleScanBarcode} />
              </Box>
            ) : (
              <TextInput
                placeholder="Or enter barcode manually"
                size="lg"
                {...form.getInputProps("barcode")}
              />
            )}

            <Divider my="md" />

            <Group>
              <Button
                variant="outline"
                onClick={() => form.reset()}
                disabled={loading}
                size="lg"
                style={{ flex: 1 }}
              >
                Clear
              </Button>
              <Button
                type="submit"
                loading={loading}
                leftSection={<IconDeviceFloppy size={20} />}
                color="green"
                size="xl"
                style={{ flex: 2 }}
                h={60}
              >
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </>
  );
}
