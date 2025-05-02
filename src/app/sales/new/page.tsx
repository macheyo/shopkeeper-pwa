"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  ActionIcon,
  Modal,
  Table,
  Checkbox,
  Drawer,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconSearch,
  IconBarcode,
  IconShoppingCart,
  IconAlertCircle,
  IconCheck,
  IconTrash,
  IconReceipt,
  IconMicrophone,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getSalesDB, getProductsDB } from "@/lib/databases";
import { createSaleEntry } from "@/lib/accounting";
import {
  parseSpeechToTransaction,
  createDefaultProduct,
} from "@/lib/speechParser";
import { ProductDoc, SaleItem, PaymentMethod } from "@/types";
import { formatMoney, createMoney, BASE_CURRENCY, Money } from "@/types/money";
import MoneyInput from "@/components/MoneyInput";
import { PaymentMethodSelect } from "@/components/PaymentMethodSelect";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
});

const SpeechRecognition = dynamic(
  () => import("@/components/SpeechRecognition"),
  {
    ssr: false,
  }
);

export default function NewSalePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [showScanner, setShowScanner] = useState(false);
  const [showSpeechRecognition, setShowSpeechRecognition] = useState(false);
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductDoc[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductDoc[]>([]);
  const [quantityDrawerOpen, setQuantityDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [cashReceivedMoney, setCashReceivedMoney] = useState<Money>(
    createMoney(0)
  );
  const [change, setChange] = useState<Money>(createMoney(0));
  const [receiptData, setReceiptData] = useState<{
    items: SaleItem[];
    totalAmount: Money;
    cashReceived: Money;
    change: Money;
    timestamp: string;
    paymentMethod: PaymentMethod;
  } | null>(null);

  const form = useForm({
    initialValues: {
      quantity: 1,
      cashReceived: 0,
    },
    validate: {
      quantity: (value: number) =>
        value > 0 ? null : "Quantity must be greater than 0",
      cashReceived: (value: number) =>
        value >= 0 ? null : "Cash received must be greater than or equal to 0",
    },
  });

  // Fetch all products on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const fetchData = async () => {
      try {
        const productsDB = await getProductsDB();
        const result = await productsDB.find({
          selector: { type: "product" },
        });
        setProducts(result.docs as ProductDoc[]);
        setFilteredProducts(result.docs as ProductDoc[]);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(
          `Failed to load data: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    };

    fetchData();
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

  const handleProductSelect = (product: ProductDoc, isSelected: boolean) => {
    if (isSelected) {
      setSelectedProducts([...selectedProducts, product]);
    } else {
      setSelectedProducts(
        selectedProducts.filter((p) => p._id !== product._id)
      );
    }
  };

  const handleSpeechResult = useCallback(
    async (text: string) => {
      if (typeof window === "undefined") return;

      setShowSpeechRecognition(false);
      setError(null);

      try {
        // Parse the speech into transaction data
        const transaction = await parseSpeechToTransaction(text);

        if (!transaction) {
          setError("Could not understand the speech. Please try again.");
          return;
        }

        // Only process sales in this page
        if (transaction.type !== "sale") {
          setError(
            "This is for sales only. For purchases, please go to the purchases page."
          );
          return;
        }

        // If we have a matched product, add it to the selected products
        if (transaction.matchedProduct) {
          // Add to selected products if not already selected
          if (
            !selectedProducts.some(
              (p) => p._id === transaction.matchedProduct!._id
            )
          ) {
            const product = transaction.matchedProduct;
            setSelectedProducts([product]);
            form.setFieldValue("quantity", transaction.quantity);
            setQuantityDrawerOpen(true);
          }
        } else {
          // No matching product found, show error
          setError(
            `No product found matching "${transaction.productName}". Please select a product manually.`
          );
          // Set search term to help find the product
          setSearchTerm(transaction.productName);
        }
      } catch (err) {
        console.error("Error processing speech:", err);
        setError(
          `Error processing speech: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    },
    [form, selectedProducts]
  );

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
        // Add to selected products if not already selected
        if (!selectedProducts.some((p) => p._id === product._id)) {
          handleProductSelect(product, true);
        }
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

  const handleAddSelectedToCart = () => {
    if (selectedProducts.length === 0) return;

    const newItems: SaleItem[] = selectedProducts.map((product) => {
      const quantity = form.values.quantity;

      // Calculate total for this item
      const itemTotal = {
        ...product.price,
        amount: product.price.amount * quantity,
      };

      return {
        productId: product._id,
        productName: product.name,
        productCode: product.code,
        qty: quantity,
        price: product.price,
        total: itemTotal,
        costPrice: product.costPrice || createMoney(0),
        purchaseDate: product.purchaseDate,
      };
    });

    // Add to cart
    setCartItems([...cartItems, ...newItems]);

    // Reset selection
    setSelectedProducts([]);
    setQuantityDrawerOpen(false);
    setSearchTerm("");
    form.reset();
  };

  const handleRemoveFromCart = (index: number) => {
    const newCartItems = [...cartItems];
    newCartItems.splice(index, 1);
    setCartItems(newCartItems);
  };

  // Calculate total price for all items in the cart
  const calculateTotalPrice = () => {
    if (cartItems.length === 0) {
      return createMoney(0);
    }

    // Start with the first item's currency as the target currency
    const targetCurrency = cartItems[0].total.currency;
    const targetExchangeRate = cartItems[0].total.exchangeRate;

    let totalAmount = 0;

    // Sum up all items (they should all be in the same currency)
    cartItems.forEach((item) => {
      totalAmount += item.total.amount;
    });

    return {
      amount: totalAmount,
      currency: targetCurrency,
      exchangeRate: targetExchangeRate,
    };
  };

  const totalPrice = calculateTotalPrice();

  // Convert money to base currency (USD)
  const convertToBaseCurrency = (money: Money): Money => {
    if (money.currency === BASE_CURRENCY) return money;
    return {
      amount: money.amount / money.exchangeRate,
      currency: BASE_CURRENCY,
      exchangeRate: 1,
    };
  };

  // Check if payment is sufficient
  const isPaymentSufficient = () => {
    if (paymentMethod !== "cash") return true;

    // Convert both amounts to base currency for comparison
    const totalInBase = convertToBaseCurrency(totalPrice);
    const receivedInBase = convertToBaseCurrency(cashReceivedMoney);

    // Calculate change in the payment currency
    const changeAmount = receivedInBase.amount - totalInBase.amount;
    setChange({
      ...cashReceivedMoney,
      amount: changeAmount * cashReceivedMoney.exchangeRate,
    });

    return receivedInBase.amount >= totalInBase.amount;
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

    // Double-check payment is sufficient for cash payments
    if (paymentMethod === "cash" && !isPaymentSufficient()) {
      setError(
        "Payment amount is insufficient. Please enter the correct amount."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const saleId = `sale_${now.getTime()}`;

      const salesDB = await getSalesDB();
      // Calculate total cost and profit
      const totalCost = cartItems.reduce(
        (acc, item) => ({
          ...acc,
          amount: acc.amount + item.costPrice.amount * item.qty,
        }),
        createMoney(0)
      );

      const profit = {
        ...totalPrice,
        amount: totalPrice.amount - totalCost.amount,
      };

      // Update stock levels
      const productsDB = await getProductsDB();
      for (const item of cartItems) {
        const product = products.find((p) => p._id === item.productId);
        if (product) {
          await productsDB.put({
            ...product,
            stockQuantity: (product.stockQuantity || 0) - item.qty,
            updatedAt: now.toISOString(),
          });
        }
      }

      // Save the sale
      const saleDoc = {
        _id: saleId,
        type: "sale",
        items: cartItems,
        totalAmount: totalPrice,
        totalCost: totalCost,
        profit: profit,
        paymentMethod: paymentMethod,
        cashReceived: paymentMethod === "cash" ? cashReceivedMoney : undefined,
        change: paymentMethod === "cash" ? change : undefined,
        timestamp: now.toISOString(),
        status: "pending", // Will be synced later via WhatsApp
      };
      await salesDB.put(saleDoc);

      // Create ledger entry for the sale
      await createSaleEntry(
        saleId,
        totalPrice,
        totalCost,
        paymentMethod,
        now.toISOString()
      );

      // Set receipt data for display
      setReceiptData({
        items: cartItems,
        totalAmount: totalPrice,
        cashReceived: cashReceivedMoney,
        change: change,
        timestamp: now.toISOString(),
        paymentMethod: paymentMethod,
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
            Cart Items ({cartItems.length})
          </Title>

          {/* Mobile-friendly cart items list */}
          <Stack gap="md" mb="lg">
            {cartItems.map((item, index) => (
              <Card key={`${item.productId}_${index}`} withBorder p="sm">
                <Group justify="space-between" mb="xs">
                  <Text fw={700}>{item.productName}</Text>
                  <ActionIcon
                    color="red"
                    variant="light"
                    onClick={() => handleRemoveFromCart(index)}
                  >
                    <IconTrash size="1.125rem" />
                  </ActionIcon>
                </Group>
                <Group justify="space-between" mb="xs">
                  <Text size="sm">Quantity:</Text>
                  <Text fw={500}>{item.qty}</Text>
                </Group>
                <Group justify="space-between" mb="xs">
                  <Text size="sm">Price:</Text>
                  <Text>{formatMoney(item.price)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Total:</Text>
                  <Text fw={700}>{formatMoney(item.total)}</Text>
                </Group>
              </Card>
            ))}
          </Stack>

          {/* Payment Section */}
          <Divider label="Payment" labelPosition="center" size="md" my="lg" />

          <PaymentMethodSelect
            value={paymentMethod}
            onChange={setPaymentMethod}
            className="mb-4"
          />

          {paymentMethod === "cash" && (
            <MoneyInput
              label="Cash Received"
              description="Amount of cash given by customer (can be in any currency)"
              value={cashReceivedMoney}
              onChange={(value) => {
                const newMoney =
                  typeof value === "number"
                    ? { ...cashReceivedMoney, amount: value }
                    : value;
                setCashReceivedMoney(newMoney);
                form.setFieldValue("cashReceived", newMoney.amount);
              }}
            />
          )}

          <Card withBorder p="md" mb="md">
            <Group justify="space-between">
              <Text fw={700} size="lg">
                Total Amount:
              </Text>
              <Text fw={700} size="lg">
                {formatMoney(totalPrice)}
              </Text>
            </Group>

            {paymentMethod === "cash" && (
              <>
                <Group justify="space-between" mt="xs">
                  <Text>Cash Received:</Text>
                  <Text>{formatMoney(cashReceivedMoney)}</Text>
                </Group>
                <Group justify="space-between" mt="xs">
                  <Text>Change:</Text>
                  <Text>{formatMoney(change)}</Text>
                </Group>
              </>
            )}
          </Card>

          <Button
            fullWidth
            color="blue"
            leftSection={<IconShoppingCart size={20} />}
            onClick={handleSaveSale}
            loading={loading}
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
          {cartItems.length > 0 ? "Add More Products" : "Find Products"}
        </Title>

        <Group grow mb="lg">
          <Button
            size="xl"
            leftSection={<IconBarcode size={24} />}
            onClick={() => {
              setShowScanner(!showScanner);
              setShowSpeechRecognition(false);
            }}
            color="blue"
            h={60}
          >
            {showScanner ? "Hide Scanner" : "Scan Barcode"}
          </Button>

          <Button
            size="xl"
            leftSection={<IconMicrophone size={24} />}
            onClick={() => {
              setShowSpeechRecognition(!showSpeechRecognition);
              setShowScanner(false);
            }}
            color="teal"
            h={60}
          >
            {showSpeechRecognition ? "Hide Voice" : "Voice Input"}
          </Button>
        </Group>

        {showScanner && (
          <Box mb="lg">
            <Text size="md" fw={500} mb="xs" ta="center">
              Point camera at barcode
            </Text>
            <BarcodeScanner onScan={handleBarcodeScanned} />
          </Box>
        )}

        {showSpeechRecognition && (
          <Box mb="lg">
            <Text size="md" fw={500} mb="xs" ta="center">
              Say something like "sold 2 bags of rice"
            </Text>
            <SpeechRecognition
              onResult={handleSpeechResult}
              placeholder="Listening for sales..."
              buttonText="Start Voice Input"
              stopButtonText="Stop Voice Input"
            />
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
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    const isSelected = selectedProducts.some(
                      (p) => p._id === product._id
                    );
                    handleProductSelect(product, !isSelected);
                  }}
                >
                  <Group justify="space-between" align="flex-start">
                    <Checkbox
                      checked={selectedProducts.some(
                        (p) => p._id === product._id
                      )}
                      onChange={(e) => {
                        // This will be triggered when clicking directly on the checkbox
                        e.stopPropagation(); // Prevent the card click from firing
                        handleProductSelect(product, e.currentTarget.checked);
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <Text fw={700} size="lg">
                        {product.name}
                      </Text>
                      <Text size="md">Code: {product.code}</Text>
                      <Text size="sm" c="dimmed">
                        Current Stock: {product.stockQuantity || 0} units
                      </Text>
                    </div>
                    <div>
                      <Text fw={700} size="xl">
                        {formatMoney(product.price)}
                      </Text>
                    </div>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Box>

        {selectedProducts.length > 0 && (
          <Button
            fullWidth
            color="green"
            leftSection={<IconShoppingCart size={20} />}
            onClick={() => setQuantityDrawerOpen(true)}
            size="xl"
            mt="lg"
            h={60}
          >
            Add {selectedProducts.length} Selected Product
            {selectedProducts.length > 1 ? "s" : ""} to Cart
          </Button>
        )}
      </Paper>

      {/* Quantity Drawer */}
      <Drawer
        opened={quantityDrawerOpen}
        onClose={() => setQuantityDrawerOpen(false)}
        title={<Title order={3}>Set Quantity</Title>}
        position="bottom"
        size="lg"
      >
        <Stack gap="md">
          {selectedProducts.map((product) => (
            <Card key={product._id} withBorder p="md">
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={700} size="lg">
                    {product.name}
                  </Text>
                  <Text size="sm">Code: {product.code}</Text>
                  <Text size="sm" c="dimmed">
                    Current Stock: {product.stockQuantity || 0} units
                  </Text>
                </div>
                <div>
                  <Text fw={700} size="xl">
                    {formatMoney(product.price)}
                  </Text>
                </div>
              </Group>

              <Group justify="space-between" align="center">
                <Text fw={500}>Quantity:</Text>
                <NumberInput
                  value={form.values.quantity}
                  onChange={(value) =>
                    form.setFieldValue("quantity", Number(value))
                  }
                  min={1}
                  max={product.stockQuantity || 0}
                  size="md"
                  style={{ width: "120px" }}
                />
              </Group>

              {form.values.quantity > 0 && (
                <Group justify="space-between" mt="md">
                  <Text fw={500}>Total:</Text>
                  <Text fw={700}>
                    {formatMoney({
                      ...product.price,
                      amount: product.price.amount * form.values.quantity,
                    })}
                  </Text>
                </Group>
              )}
            </Card>
          ))}
        </Stack>

        <Group mt="xl">
          <Button
            variant="outline"
            onClick={() => setQuantityDrawerOpen(false)}
            style={{ flex: 1 }}
          >
            Cancel
          </Button>
          <Button
            color="green"
            leftSection={<IconShoppingCart size={20} />}
            onClick={handleAddSelectedToCart}
            style={{ flex: 2 }}
            size="lg"
          >
            Add to Cart
          </Button>
        </Group>
      </Drawer>

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
              <Text fw={700}>Total Amount:</Text>
              <Text fw={700}>{formatMoney(receiptData.totalAmount)}</Text>
            </Group>

            <Group justify="space-between">
              <Text fw={700}>Payment Method:</Text>
              <Text fw={700}>{receiptData.paymentMethod}</Text>
            </Group>

            {receiptData.paymentMethod === "cash" && (
              <>
                <Group justify="space-between">
                  <Text>Cash Received:</Text>
                  <Text>{formatMoney(receiptData.cashReceived)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text>Change:</Text>
                  <Text>{formatMoney(receiptData.change)}</Text>
                </Group>
              </>
            )}

            <Divider my="sm" />

            <Text ta="center" c="dimmed" size="sm">
              Sale recorded successfully!
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
