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
  ActionIcon,
  Modal,
  Table,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconSearch,
  IconBarcode,
  IconShoppingCart,
  IconAlertCircle,
  IconCheck,
  IconPlus,
  IconTrash,
  IconReceipt,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getSalesDB, getProductsDB } from "@/lib/databases";
import { ProductDoc, SaleItem } from "@/types";
import { formatMoney, createMoney, BASE_CURRENCY, Money } from "@/types/money";
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
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    items: SaleItem[];
    totalAmount: Money;
    cashReceived: Money;
    change: Money;
    timestamp: string;
  } | null>(null);

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

  // Calculate total price for all items in the cart
  const calculateTotalPrice = () => {
    if (cartItems.length === 0) {
      return createMoney(0);
    }

    // Start with the first item's currency
    const baseCurrency = cartItems[0].total.currency;
    const baseExchangeRate = cartItems[0].total.exchangeRate;

    let totalAmount = 0;

    // Convert all items to the base currency and sum them up
    cartItems.forEach((item) => {
      if (item.total.currency === baseCurrency) {
        totalAmount += item.total.amount;
      } else {
        // Convert to base currency
        const valueInBaseCurrency =
          item.total.currency === BASE_CURRENCY
            ? item.total.amount
            : item.total.amount / item.total.exchangeRate;

        totalAmount += valueInBaseCurrency * baseExchangeRate;
      }
    });

    return {
      amount: totalAmount,
      currency: baseCurrency,
      exchangeRate: baseExchangeRate,
    };
  };

  const totalPrice = calculateTotalPrice();

  // Update cash received money when cart changes
  useEffect(() => {
    if (cartItems.length > 0) {
      setCashReceivedMoney({
        amount: totalPrice.amount,
        currency: totalPrice.currency,
        exchangeRate: totalPrice.exchangeRate,
      });
      form.setFieldValue("cashReceived", totalPrice.amount);
    }
  }, [cartItems, totalPrice.amount]);

  // Convert cash received to product currency for comparison
  const convertCashToProductCurrency = () => {
    if (cartItems.length === 0) return 0;

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
    if (cartItems.length === 0) return false;

    // Convert cash received to product currency for comparison
    const cashReceivedInProductCurrency = convertCashToProductCurrency();

    // Check if payment is sufficient
    return cashReceivedInProductCurrency >= totalPrice.amount;
  };

  // Calculate change in the currency the customer paid with
  const calculateChange = () => {
    if (cartItems.length === 0) {
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

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const quantity = form.values.quantity;

    // Calculate total for this item
    const itemTotal = {
      ...selectedProduct.price,
      amount: selectedProduct.price.amount * quantity,
    };

    // Create a new sale item
    const newItem: SaleItem = {
      productId: selectedProduct._id,
      productName: selectedProduct.name,
      productCode: selectedProduct.code,
      qty: quantity,
      price: selectedProduct.price,
      total: itemTotal,
    };

    // Add to cart
    setCartItems([...cartItems, newItem]);

    // Reset selection
    setSelectedProduct(null);
    form.reset();
    setSearchTerm("");
  };

  const handleRemoveFromCart = (index: number) => {
    const newCartItems = [...cartItems];
    newCartItems.splice(index, 1);
    setCartItems(newCartItems);
  };

  const handleSaveSale = async () => {
    if (typeof window === "undefined") {
      setError("Sales can only be recorded in the browser");
      return;
    }

    if (cartItems.length === 0) {
      setError("Please add at least one product to the cart");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const saleId = `sale_${now.getTime()}`;

      const salesDB = await getSalesDB();
      await salesDB.put({
        _id: saleId,
        type: "sale",
        items: cartItems,
        totalAmount: totalPrice,
        cashReceived: cashReceivedMoney,
        change: change,
        timestamp: now.toISOString(),
        status: "pending", // Will be synced later via WhatsApp
      });

      // Set receipt data for display
      setReceiptData({
        items: cartItems,
        totalAmount: totalPrice,
        cashReceived: cashReceivedMoney,
        change: change,
        timestamp: now.toISOString(),
      });

      setShowReceipt(true);
      setSuccess(true);

      // Clear cart
      setCartItems([]);
      form.reset();
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

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setReceiptData(null);
    router.push("/sales");
  };

  // Format date for receipt
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

      {success && !showReceipt && (
        <Alert
          icon={<IconCheck size="1.5rem" />}
          title="Success"
          color="green"
          mb="md"
          withCloseButton
          onClose={() => setSuccess(false)}
        >
          Sale recorded successfully!
        </Alert>
      )}

      {/* Cart Items */}
      {cartItems.length > 0 && (
        <Paper shadow="md" p="lg" withBorder mb="lg">
          <Title order={3} mb="md">
            Cart Items
          </Title>
          <Table striped withTableBorder mb="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Price</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cartItems.map((item, index) => (
                <Table.Tr key={`${item.productId}_${index}`}>
                  <Table.Td>{item.productName}</Table.Td>
                  <Table.Td>{item.qty}</Table.Td>
                  <Table.Td>{formatMoney(item.price)}</Table.Td>
                  <Table.Td>{formatMoney(item.total)}</Table.Td>
                  <Table.Td>
                    <ActionIcon
                      color="red"
                      onClick={() => handleRemoveFromCart(index)}
                    >
                      <IconTrash size="1.125rem" />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th colSpan={3} style={{ textAlign: "right" }}>
                  Total:
                </Table.Th>
                <Table.Th colSpan={2}>{formatMoney(totalPrice)}</Table.Th>
              </Table.Tr>
            </Table.Tfoot>
          </Table>

          {/* Payment Section */}
          <Divider label="Payment" labelPosition="center" size="md" my="lg" />

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
                <Group justify="space-between" mt="md">
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

              <Group justify="space-between" mt="md">
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

          <Button
            fullWidth
            color="blue"
            leftSection={<IconShoppingCart size={20} />}
            onClick={handleSaveSale}
            loading={loading}
            disabled={!isPaymentSufficient()}
            size="xl"
            mt="xl"
            h={60}
          >
            Complete Sale
          </Button>
        </Paper>
      )}

      {/* Step 1: Scan or Search */}
      <Paper shadow="md" p="lg" withBorder mb="lg">
        <Title order={3} mb="md" ta="center">
          {cartItems.length > 0 ? "Add Another Product" : "Find Product"}
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

      {/* Step 2: Product Details */}
      {selectedProduct && (
        <Paper shadow="md" p="lg" withBorder>
          <Title order={3} mb="lg" ta="center">
            Product Details
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

              <Group justify="space-between">
                <Text fw={700} size="xl">
                  Total:
                </Text>
                <Text fw={700} size="xl">
                  {formatMoney({
                    ...selectedProduct.price,
                    amount: selectedProduct.price.amount * form.values.quantity,
                  })}
                </Text>
              </Group>

              <Group mt="lg">
                <Button
                  variant="outline"
                  color="gray"
                  onClick={() => setSelectedProduct(null)}
                  size="lg"
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  color="blue"
                  leftSection={<IconPlus size={20} />}
                  onClick={handleAddToCart}
                  disabled={form.values.quantity <= 0}
                  size="xl"
                  style={{ flex: 2 }}
                  h={60}
                >
                  Add to Cart
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      )}

      {/* Receipt Modal */}
      <Modal
        opened={showReceipt}
        onClose={handleCloseReceipt}
        title={
          <Group>
            <IconReceipt size={24} />
            <Text size="xl" fw={700}>
              Sale Receipt
            </Text>
          </Group>
        }
        size="lg"
        centered
      >
        {receiptData && (
          <Stack>
            <Text ta="center" fw={700} size="lg">
              SHOPKEEPER
            </Text>
            <Text ta="center" c="dimmed">
              {formatDate(receiptData.timestamp)}
            </Text>

            <Divider my="sm" />

            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Item</Table.Th>
                  <Table.Th>Qty</Table.Th>
                  <Table.Th>Price</Table.Th>
                  <Table.Th>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {receiptData.items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{item.productName}</Table.Td>
                    <Table.Td>{item.qty}</Table.Td>
                    <Table.Td>{formatMoney(item.price)}</Table.Td>
                    <Table.Td>{formatMoney(item.total)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Divider my="sm" />

            <Group justify="space-between">
              <Text fw={700}>Total:</Text>
              <Text fw={700}>{formatMoney(receiptData.totalAmount)}</Text>
            </Group>

            <Group justify="space-between">
              <Text>Paid ({receiptData.cashReceived.currency}):</Text>
              <Text>{formatMoney(receiptData.cashReceived)}</Text>
            </Group>

            <Group justify="space-between">
              <Text>Change ({receiptData.change.currency}):</Text>
              <Text>{formatMoney(receiptData.change)}</Text>
            </Group>

            <Divider my="sm" />

            <Text ta="center" c="dimmed" size="sm">
              Thank you for your purchase!
            </Text>

            <Button
              fullWidth
              onClick={handleCloseReceipt}
              mt="md"
              leftSection={<IconCheck size={20} />}
            >
              Done
            </Button>
          </Stack>
        )}
      </Modal>
    </>
  );
}
