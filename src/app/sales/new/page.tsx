"use client";

import React, { useState, useEffect } from "react";
import {
  Title,
  Button,
  Group,
  Text,
  Paper,
  Box,
  TextInput,
  NumberInput,
  Divider,
  Alert,
  Stack,
  Card,
  Badge,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconSearch,
  IconBarcode,
  IconShoppingCart,
  IconAlertCircle,
  IconCheck,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getSalesDB, getProductsDB } from "@/lib/databases";
import { ProductDoc } from "@/types";
import { formatMoney, createMoney, BASE_CURRENCY } from "@/types/money";
import MoneyInput from "@/components/MoneyInput";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
});

export default function NewSalePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductDoc[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductDoc | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm({
    initialValues: {
      quantity: 1,
      cashReceived: 0,
    },
    validate: {
      quantity: (value: number) =>
        value > 0 ? null : "Quantity must be greater than 0",
    },
  });

  // State for cash received money input
  const [cashReceivedMoney, setCashReceivedMoney] = useState({
    amount: 0,
    currency: BASE_CURRENCY,
    exchangeRate: 1,
  });

  // Calculate derived values
  const totalPrice = selectedProduct
    ? {
        ...selectedProduct.price,
        amount: selectedProduct.price.amount * form.values.quantity,
      }
    : createMoney(0);

  // Update cash received money when product is selected
  useEffect(() => {
    if (selectedProduct) {
      setCashReceivedMoney({
        amount: selectedProduct.price.amount * form.values.quantity,
        currency: selectedProduct.price.currency,
        exchangeRate: selectedProduct.price.exchangeRate,
      });
      form.setFieldValue(
        "cashReceived",
        selectedProduct.price.amount * form.values.quantity
      );
    }
  }, [selectedProduct, form.values.quantity]);

  // Convert cash received to product currency for comparison
  const convertCashToProductCurrency = () => {
    if (!selectedProduct) return 0;

    // If currencies match, no conversion needed
    if (cashReceivedMoney.currency === totalPrice.currency) {
      return cashReceivedMoney.amount;
    }

    // Convert to base currency first (if not already in base currency)
    const valueInBaseCurrency =
      cashReceivedMoney.currency === BASE_CURRENCY
        ? cashReceivedMoney.amount
        : cashReceivedMoney.amount / cashReceivedMoney.exchangeRate;

    // Then convert from base currency to product currency
    return valueInBaseCurrency * totalPrice.exchangeRate;
  };

  // Check if payment is sufficient
  const isPaymentSufficient = () => {
    if (!selectedProduct) return false;

    // Convert cash received to product currency for comparison
    const cashReceivedInProductCurrency = convertCashToProductCurrency();

    // Check if payment is sufficient
    return cashReceivedInProductCurrency >= totalPrice.amount;
  };

  // Calculate change in the currency the customer paid with
  const calculateChange = () => {
    if (!selectedProduct) {
      return createMoney(
        0,
        cashReceivedMoney.currency,
        cashReceivedMoney.exchangeRate
      );
    }

    // Convert total price to payment currency
    const totalPriceInPaymentCurrency =
      totalPrice.currency === cashReceivedMoney.currency
        ? totalPrice.amount
        : (totalPrice.amount / totalPrice.exchangeRate) *
          cashReceivedMoney.exchangeRate;

    // Calculate change in payment currency
    return {
      ...cashReceivedMoney,
      amount: cashReceivedMoney.amount - totalPriceInPaymentCurrency,
    };
  };

  const change = calculateChange();

  // Fetch all products on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const fetchProducts = async () => {
      try {
        const productsDB = await getProductsDB();
        const result = await productsDB.find({
          selector: { type: "product" },
        });
        setProducts(result.docs as ProductDoc[]);
        setFilteredProducts(result.docs as ProductDoc[]);
      } catch (err) {
        console.error("Error fetching products:", err);
        setError(
          `Failed to load products: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    };

    fetchProducts();
  }, []);

  // Filter products when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = products.filter(
      (product) =>
        product.code.toLowerCase().includes(term) ||
        product.name.toLowerCase().includes(term) ||
        (product.barcode && product.barcode.includes(term))
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  const handleProductSelect = (product: ProductDoc) => {
    setSelectedProduct(product);
    // Reset quantity to 1 when selecting a new product
    form.setFieldValue("quantity", 1);
    // Set cash received to the product price as a starting point
    form.setFieldValue("cashReceived", product.price.amount);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    if (typeof window === "undefined") return;

    setShowScanner(false);
    setSearchTerm(barcode);

    // Try to find product by barcode
    try {
      const productsDB = await getProductsDB();
      const result = await productsDB.find({
        selector: {
          type: "product",
          barcode: barcode,
        },
      });

      if (result.docs.length > 0) {
        const product = result.docs[0] as ProductDoc;
        handleProductSelect(product);
      } else {
        setError(`No product found with barcode: ${barcode}`);
      }
    } catch (err) {
      console.error("Error searching by barcode:", err);
      setError(
        `Error searching by barcode: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  const handleSaveSale = async () => {
    if (typeof window === "undefined") {
      setError("Sales can only be recorded in the browser");
      return;
    }

    if (!selectedProduct) {
      setError("Please select a product first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const saleId = `sale_${now.getTime()}_${selectedProduct.code}`;

      const salesDB = await getSalesDB();
      await salesDB.put({
        _id: saleId,
        type: "sale",
        productId: selectedProduct._id,
        qty: form.values.quantity,
        price: selectedProduct.price,
        total: totalPrice,
        cashReceived: cashReceivedMoney,
        change: change,
        timestamp: now.toISOString(),
        status: "pending", // Will be synced later via WhatsApp
      });

      setSuccess(true);
      setSelectedProduct(null);
      form.reset();

      // Auto-navigate back after success
      setTimeout(() => {
        router.push("/sales");
      }, 1500);
    } catch (err) {
      console.error("Error saving sale:", err);
      setError(
        `Failed to save sale: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Box mb="lg">
        <Group justify="space-between" align="center">
          <Title order={2}>New Sale</Title>
          <Button
            variant="outline"
            leftSection={<IconArrowLeft size={20} />}
            onClick={() => router.push("/sales")}
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
          icon={<IconCheck size="1.5rem" />}
          title="Success"
          color="green"
          mb="md"
          withCloseButton
          onClose={() => setSuccess(false)}
        >
          Sale recorded successfully! Redirecting...
        </Alert>
      )}

      {/* Step 1: Scan or Search */}
      {!selectedProduct && (
        <Paper shadow="md" p="lg" withBorder mb="lg">
          <Title order={3} mb="md" ta="center">
            Step 1: Find Product
          </Title>

          <Button
            fullWidth
            size="xl"
            mb="lg"
            leftSection={<IconBarcode size={24} />}
            onClick={() => setShowScanner(!showScanner)}
            color="blue"
            h={60}
          >
            {showScanner ? "Hide Scanner" : "Scan Barcode"}
          </Button>

          {showScanner && (
            <Box mb="lg">
              <Text size="md" fw={500} mb="xs" ta="center">
                Point camera at barcode
              </Text>
              <BarcodeScanner onScan={handleBarcodeScanned} />
            </Box>
          )}

          <Divider label="OR" labelPosition="center" my="lg" />

          <TextInput
            placeholder="Search by name or code"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            size="lg"
            mb="md"
            leftSection={<IconSearch size={20} />}
          />

          <Box style={{ maxHeight: "400px", overflowY: "auto" }}>
            {filteredProducts.length === 0 ? (
              <Text c="dimmed" ta="center" py="md" size="lg">
                No products found
              </Text>
            ) : (
              <Stack gap="md">
                {filteredProducts.map((product) => (
                  <Card
                    key={product._id}
                    padding="md"
                    withBorder
                    style={{
                      cursor: "pointer",
                    }}
                    onClick={() => handleProductSelect(product)}
                  >
                    <Group justify="space-between">
                      <div>
                        <Text fw={700} size="lg">
                          {product.name}
                        </Text>
                        <Text size="md">Code: {product.code}</Text>
                      </div>
                      <Text fw={700} size="xl">
                        {formatMoney(product.price)}
                      </Text>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>
        </Paper>
      )}

      {/* Step 2: Sale Details */}
      {selectedProduct && (
        <Paper shadow="md" p="lg" withBorder>
          <Title order={3} mb="lg" ta="center">
            Step 2: Complete Sale
          </Title>

          <Card withBorder mb="lg" padding="lg">
            <Group justify="space-between" mb="md">
              <Text fw={700} size="lg">
                Product:
              </Text>
              <Text size="lg">{selectedProduct.name}</Text>
            </Group>
            <Group justify="space-between" mb="md">
              <Text fw={700} size="lg">
                Code:
              </Text>
              <Badge size="lg">{selectedProduct.code}</Badge>
            </Group>
            <Group justify="space-between">
              <Text fw={700} size="lg">
                Unit Price:
              </Text>
              <Text fw={700} size="xl">
                {formatMoney(selectedProduct.price)}
              </Text>
            </Group>
          </Card>

          <form>
            <Stack gap="lg">
              <NumberInput
                label="Quantity"
                description="Number of items"
                min={1}
                required
                size="xl"
                {...form.getInputProps("quantity")}
              />

              <Divider label="Payment" labelPosition="center" size="md" />

              <Group justify="space-between">
                <Text fw={700} size="xl">
                  Total Price:
                </Text>
                <Text fw={700} size="xl">
                  {formatMoney(totalPrice)}
                </Text>
              </Group>

              <MoneyInput
                label="Cash Received"
                description="Amount of cash given by customer (can be in any currency)"
                min={0}
                size="xl"
                value={cashReceivedMoney}
                onChange={(value) => {
                  setCashReceivedMoney(value);
                  form.setFieldValue("cashReceived", value.amount);
                }}
              />

              {form.values.cashReceived > 0 && (
                <>
                  {cashReceivedMoney.currency !== totalPrice.currency && (
                    <Group justify="space-between">
                      <Text fw={500} size="lg">
                        Equivalent in {totalPrice.currency}:
                      </Text>
                      <Text fw={500} size="lg">
                        {formatMoney({
                          ...totalPrice,
                          amount: convertCashToProductCurrency(),
                        })}
                      </Text>
                    </Group>
                  )}

                  <Group justify="space-between">
                    <Text fw={700} size="xl">
                      Change ({cashReceivedMoney.currency}):
                    </Text>
                    <Text
                      fw={700}
                      c={isPaymentSufficient() ? "green" : "red"}
                      size="xl"
                    >
                      {formatMoney(change)}
                    </Text>
                  </Group>
                </>
              )}

              <Group mt="lg">
                <Button
                  variant="outline"
                  color="gray"
                  onClick={() => setSelectedProduct(null)}
                  size="lg"
                  style={{ flex: 1 }}
                >
                  Back
                </Button>
                <Button
                  color="blue"
                  leftSection={<IconShoppingCart size={20} />}
                  onClick={handleSaveSale}
                  loading={loading}
                  disabled={
                    !selectedProduct ||
                    form.values.quantity <= 0 ||
                    !isPaymentSufficient()
                  }
                  size="xl"
                  style={{ flex: 2 }}
                  h={60}
                >
                  Done
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      )}
    </>
  );
}
