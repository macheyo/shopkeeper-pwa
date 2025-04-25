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
  ActionIcon,
  Modal,
  Table,
  Checkbox,
  Drawer,
  ScrollArea,
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
  IconTrash,
  IconReceipt,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getSalesDB, getProductsDB } from "@/lib/databases";
import { ProductDoc, SaleItem, SaleDoc } from "@/types";
import {
  formatMoney,
  createMoney,
  BASE_CURRENCY,
  Money,
  CurrencyCode,
} from "@/types/money";
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
  const [selectedProducts, setSelectedProducts] = useState<ProductDoc[]>([]);
  const [quantityDrawerOpen, setQuantityDrawerOpen] = useState(false);
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

  // State for sales target
  const [currentTarget, setCurrentTarget] = useState<{
    amount: number;
    currency: string;
    date: string;
    achieved: boolean;
  } | null>(null);
  const [todayRevenue, setTodayRevenue] = useState<Money | null>(null);

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

  // Function to convert a money value to the customer's selected payment currency
  const convertToPaymentCurrency = (money: Money): Money => {
    if (money.currency === cashReceivedMoney.currency) {
      return money; // Already in the same currency
    }

    // First convert to base currency (USD)
    const valueInBaseCurrency = convertToBaseCurrency(money);

    // Then convert from base currency to payment currency
    const valueInPaymentCurrency = convertFromBaseCurrency(
      valueInBaseCurrency,
      cashReceivedMoney.currency,
      cashReceivedMoney.exchangeRate
    );

    return {
      amount: valueInPaymentCurrency,
      currency: cashReceivedMoney.currency,
      exchangeRate: cashReceivedMoney.exchangeRate,
    };
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

    // Convert all items to the target currency and sum them up
    cartItems.forEach((item) => {
      if (item.total.currency === targetCurrency) {
        // If the item is already in the target currency, add directly
        totalAmount += item.total.amount;
      } else {
        // First convert to base currency (USD)
        const valueInBaseCurrency = convertToBaseCurrency(item.total);

        // Then convert from base currency to target currency
        const valueInTargetCurrency = convertFromBaseCurrency(
          valueInBaseCurrency,
          targetCurrency,
          targetExchangeRate
        );

        totalAmount += valueInTargetCurrency;
      }
    });

    return {
      amount: totalAmount,
      currency: targetCurrency,
      exchangeRate: targetExchangeRate,
    };
  };

  const totalPrice = calculateTotalPrice();

  // Update cash received money when cart changes
  // useEffect(() => {
  //   if (cartItems.length > 0) {
  //     setCashReceivedMoney({
  //       amount: totalPrice.amount,
  //       currency: totalPrice.currency,
  //       exchangeRate: totalPrice.exchangeRate,
  //     });
  //     form.setFieldValue("cashReceived", totalPrice.amount);
  //   }
  // }, [cartItems, totalPrice.amount]);

  // Convert a money value to the base currency (USD)
  const convertToBaseCurrency = (money: Money): number => {
    if (money.currency === BASE_CURRENCY) {
      return money.amount; // Already in USD
    }

    // For other currencies, convert to USD using the exchange rate
    // The exchange rate is defined as 1 USD = X of this currency
    return money.amount / money.exchangeRate;
  };

  // Convert a value in base currency (USD) to a specific currency
  const convertFromBaseCurrency = (
    amount: number,
    currency: CurrencyCode,
    exchangeRate: number
  ): number => {
    if (currency === BASE_CURRENCY) {
      return amount; // Already in USD
    }

    // For other currencies, convert from USD using the exchange rate
    // The exchange rate is defined as 1 USD = X of this currency
    return amount * exchangeRate;
  };

  // Convert cash received to product currency for comparison
  const convertCashToProductCurrency = () => {
    if (cartItems.length === 0) return 0;

    // If currencies match, no conversion needed
    if (cashReceivedMoney.currency === totalPrice.currency) {
      return cashReceivedMoney.amount;
    }

    // Convert both to base currency first
    const cashInBaseCurrency = convertToBaseCurrency(cashReceivedMoney);

    // Then convert from base currency to product currency
    return convertFromBaseCurrency(
      cashInBaseCurrency,
      totalPrice.currency,
      totalPrice.exchangeRate
    );
  };

  // Check if payment is sufficient
  const isPaymentSufficient = () => {
    if (cartItems.length === 0) return false;

    // Convert both to base currency for comparison
    const totalInBaseCurrency = convertToBaseCurrency(totalPrice);
    const cashInBaseCurrency = convertToBaseCurrency(cashReceivedMoney);

    // Add a small buffer for floating point comparison (0.01)
    return cashInBaseCurrency >= totalInBaseCurrency - 0.01;
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

    // Convert both to base currency
    const totalInBaseCurrency = convertToBaseCurrency(totalPrice);
    const cashInBaseCurrency = convertToBaseCurrency(cashReceivedMoney);

    // Calculate change in base currency
    const changeInBaseCurrency = cashInBaseCurrency - totalInBaseCurrency;

    // Convert change to payment currency
    const changeInPaymentCurrency = convertFromBaseCurrency(
      changeInBaseCurrency,
      cashReceivedMoney.currency,
      cashReceivedMoney.exchangeRate
    );

    // Return change in payment currency
    return {
      ...cashReceivedMoney,
      amount: changeInPaymentCurrency,
    };
  };

  const change = calculateChange();

  // Function to fetch today's sales data and target
  const fetchTodaySalesData = async () => {
    if (typeof window === "undefined") return;

    try {
      // Get today's sales
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISOString = today.toISOString();

      const salesDB = await getSalesDB();
      const salesResult = await salesDB.find({
        selector: {
          type: "sale",
          timestamp: { $gte: todayISOString },
        },
      });

      const todaySales = salesResult.docs as SaleDoc[];

      // Calculate total revenue
      if (todaySales.length > 0) {
        let totalAmount = 0;
        const currency = BASE_CURRENCY;
        const exchangeRate = 1;

        // Sum up all sales and convert to base currency
        todaySales.forEach((sale) => {
          if (sale.totalAmount.currency === BASE_CURRENCY) {
            totalAmount += sale.totalAmount.amount;
          } else {
            // Convert to base currency
            const valueInBaseCurrency =
              sale.totalAmount.amount / sale.totalAmount.exchangeRate;
            totalAmount += valueInBaseCurrency;
          }
        });

        setTodayRevenue({
          amount: totalAmount,
          currency,
          exchangeRate,
        });
      } else {
        setTodayRevenue(createMoney(0));
      }

      // Load current target from localStorage
      const targetJson = localStorage.getItem("currentSalesTarget");
      if (targetJson) {
        const target = JSON.parse(targetJson);
        setCurrentTarget(target);
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
    }
  };

  // Calculate how much more is needed to reach the target
  const calculateRemainingToTarget = () => {
    if (!todayRevenue || !currentTarget) return null;

    const remaining = currentTarget.amount - todayRevenue.amount;
    if (remaining <= 0) return 0; // Target already reached

    return remaining;
  };

  // Check if adding a product would help reach the target
  const wouldHelpReachTarget = (product: ProductDoc) => {
    if (!todayRevenue || !currentTarget || currentTarget.achieved) return false;

    const remaining = calculateRemainingToTarget();
    if (remaining === null || remaining <= 0) return false;

    // Convert product price to base currency if needed
    let productPriceInBaseCurrency = product.price.amount;
    if (product.price.currency !== BASE_CURRENCY) {
      productPriceInBaseCurrency = convertToBaseCurrency(product.price);
    }

    // Check if this product would get us closer to the target
    return productPriceInBaseCurrency > 0;
  };

  // Get motivational message for a product
  const getProductMotivationalMessage = (product: ProductDoc) => {
    if (!todayRevenue || !currentTarget || currentTarget.achieved) return null;

    const remaining = calculateRemainingToTarget();
    if (remaining === null || remaining <= 0) return null;

    // Convert product price to base currency if needed
    let productPriceInBaseCurrency = product.price.amount;
    if (product.price.currency !== BASE_CURRENCY) {
      productPriceInBaseCurrency = convertToBaseCurrency(product.price);
    }

    // Calculate how many of this product would reach the target
    const neededQuantity = Math.ceil(remaining / productPriceInBaseCurrency);

    if (neededQuantity === 1) {
      return {
        message: `🎯 Sell just 1 of this item to reach your target today! 🎉`,
        color: "teal",
      };
    } else if (neededQuantity <= 3) {
      return {
        message: `🚀 Sell exactly ${neededQuantity} of these to reach your target today! 💪`,
        color: "cyan",
      };
    } else if (neededQuantity <= 5) {
      return {
        message: `⭐ Sell ${neededQuantity} of these to complete your daily target! 🏆`,
        color: "indigo",
      };
    } else {
      return {
        message: `✨ This product will help you get closer to your daily target! 📈`,
        color: "blue",
      };
    }
  };

  // Fetch all products and sales data on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const fetchData = async () => {
      try {
        // Fetch products
        const productsDB = await getProductsDB();
        const result = await productsDB.find({
          selector: { type: "product" },
        });
        setProducts(result.docs as ProductDoc[]);
        setFilteredProducts(result.docs as ProductDoc[]);

        // Fetch sales data and target
        await fetchTodaySalesData();
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

    // Set up interval to refresh sales data every minute
    const intervalId = setInterval(fetchTodaySalesData, 60000);
    return () => clearInterval(intervalId);
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

  const [productQuantities, setProductQuantities] = useState<
    Record<string, number>
  >({});

  const handleProductSelect = (product: ProductDoc, isSelected: boolean) => {
    if (isSelected) {
      setSelectedProducts([...selectedProducts, product]);
      // Initialize quantity to 1 for newly selected product
      setProductQuantities({
        ...productQuantities,
        [product._id]: 1,
      });
    } else {
      setSelectedProducts(
        selectedProducts.filter((p) => p._id !== product._id)
      );
      // Remove quantity for deselected product
      const newQuantities = { ...productQuantities };
      delete newQuantities[product._id];
      setProductQuantities(newQuantities);
    }
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
        // Add to selected products if not already selected
        if (!selectedProducts.some((p) => p._id === product._id)) {
          handleProductSelect(product, true);
        } else {
          // If already selected, increment quantity
          setProductQuantities({
            ...productQuantities,
            [product._id]: (productQuantities[product._id] || 0) + 1,
          });
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

  const handleQuantityChange = (productId: string, quantity: number) => {
    setProductQuantities({
      ...productQuantities,
      [productId]: quantity,
    });
  };

  const handleAddSelectedToCart = () => {
    if (selectedProducts.length === 0) return;

    // Check stock levels
    const insufficientStock = selectedProducts.find((product) => {
      const quantity = productQuantities[product._id] || 1;
      return (product.stockQuantity || 0) < quantity;
    });

    if (insufficientStock) {
      setError(
        `Insufficient stock for ${insufficientStock.name}. Available: ${
          insufficientStock.stockQuantity || 0
        }`
      );
      return;
    }

    const newItems: SaleItem[] = selectedProducts.map((product) => {
      const quantity = productQuantities[product._id] || 1;

      // Calculate total for this item
      const itemTotal = {
        ...product.price,
        amount: product.price.amount * quantity,
      };

      // Create a new sale item with cost price and purchase date for profit tracking
      return {
        productId: product._id,
        productName: product.name,
        productCode: product.code,
        qty: quantity,
        price: product.price,
        total: itemTotal,
        costPrice: product.purchasePrice || createMoney(0), // Use purchase price for profit calculation
        purchaseDate: product.purchaseDate || new Date().toISOString(), // Use current date if no purchase date
      };
    });

    // Add to cart
    setCartItems([...cartItems, ...newItems]);

    // Reset selection
    setSelectedProducts([]);
    setProductQuantities({});
    setQuantityDrawerOpen(false);
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

    // Double-check payment is sufficient
    if (!isPaymentSufficient()) {
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
      await salesDB.put({
        _id: saleId,
        type: "sale",
        items: cartItems,
        totalAmount: totalPrice,
        totalCost: totalCost,
        profit: profit,
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
                {cashReceivedMoney.currency !== item.price.currency && (
                  <Group justify="space-between" mb="xs">
                    <Text size="sm">Price ({cashReceivedMoney.currency}):</Text>
                    <Text>
                      {formatMoney(convertToPaymentCurrency(item.price))}
                    </Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Text size="sm">Total:</Text>
                  <Text fw={700}>{formatMoney(item.total)}</Text>
                </Group>
                {cashReceivedMoney.currency !== item.total.currency && (
                  <Group justify="space-between">
                    <Text size="sm">Total ({cashReceivedMoney.currency}):</Text>
                    <Text fw={700}>
                      {formatMoney(convertToPaymentCurrency(item.total))}
                    </Text>
                  </Group>
                )}
              </Card>
            ))}
          </Stack>

          <Card withBorder p="md" mb="md">
            <Group justify="space-between">
              <Text fw={700} size="lg">
                Total:
              </Text>
              <Text fw={700} size="lg">
                {formatMoney(totalPrice)}
              </Text>
            </Group>
            {cashReceivedMoney.currency !== totalPrice.currency && (
              <Group justify="space-between" mt="xs">
                <Text size="md">Total ({cashReceivedMoney.currency}):</Text>
                <Text size="md">
                  {formatMoney(convertToPaymentCurrency(totalPrice))}
                </Text>
              </Group>
            )}
          </Card>

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

              // Show expected amount when currency changes
              if (value.currency !== totalPrice.currency) {
                // First convert total price to base currency (USD)
                const totalInBaseCurrency = convertToBaseCurrency(totalPrice);

                // Then convert from base currency to the selected payment currency
                const totalInPaymentCurrency = convertFromBaseCurrency(
                  totalInBaseCurrency,
                  value.currency,
                  value.exchangeRate
                );

                // Update the amount to the expected amount in the selected currency
                // setCashReceivedMoney({
                //   ...value,
                //   amount: totalInPaymentCurrency,
                // });
                form.setFieldValue("cashReceived", totalInPaymentCurrency);
              }
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
          {cartItems.length > 0 ? "Add More Products" : "Find Products"}
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
                    cursor:
                      (product.stockQuantity || 0) > 0
                        ? "pointer"
                        : "not-allowed",
                    opacity: (product.stockQuantity || 0) > 0 ? 1 : 0.6,
                    backgroundColor:
                      (product.stockQuantity || 0) === 0
                        ? "var(--mantine-color-red-0)"
                        : undefined,
                  }}
                  onClick={() => {
                    if ((product.stockQuantity || 0) > 0) {
                      const isSelected = selectedProducts.some(
                        (p) => p._id === product._id
                      );
                      handleProductSelect(product, !isSelected);
                    }
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
                      <Group justify="space-between">
                        <Text fw={700} size="lg">
                          {product.name}
                        </Text>
                        {(product.stockQuantity || 0) === 0 && (
                          <Badge color="red">Out of Stock</Badge>
                        )}
                      </Group>
                      <Text size="md">Code: {product.code}</Text>
                      <Text size="sm" c="dimmed">
                        Stock: {product.stockQuantity || 0} units
                      </Text>

                      {/* Target-related motivational message */}
                      {wouldHelpReachTarget(product) && (
                        <Alert
                          color={
                            getProductMotivationalMessage(product)?.color ||
                            "blue"
                          }
                          variant="light"
                          radius="md"
                          mt="xs"
                          p="xs"
                          withCloseButton={false}
                        >
                          {getProductMotivationalMessage(product)?.message}
                        </Alert>
                      )}
                    </div>
                    <div>
                      <Text fw={700} size="xl">
                        {formatMoney(product.price)}
                      </Text>
                      {cashReceivedMoney.currency !== product.price.currency &&
                        cashReceivedMoney.amount > 0 && (
                          <Text size="sm" c="dimmed">
                            {formatMoney(
                              convertToPaymentCurrency(product.price)
                            )}
                          </Text>
                        )}
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
        title={<Title order={3}>Set Quantities</Title>}
        position="bottom"
        size="lg"
      >
        <ScrollArea h={400} offsetScrollbars>
          <Stack gap="md">
            {selectedProducts.map((product) => (
              <Card key={product._id} withBorder p="md">
                <Group justify="space-between" mb="md">
                  <div>
                    <Text fw={700} size="lg">
                      {product.name}
                    </Text>
                    <Text size="sm">Code: {product.code}</Text>
                    <Text size="sm">
                      Unit Price: {formatMoney(product.price)}
                      {cashReceivedMoney.currency !== product.price.currency &&
                        cashReceivedMoney.amount > 0 && (
                          <Text span ml="xs" c="dimmed">
                            (
                            {formatMoney(
                              convertToPaymentCurrency(product.price)
                            )}
                            )
                          </Text>
                        )}
                    </Text>

                    {/* Target-related motivational message */}
                    {wouldHelpReachTarget(product) && (
                      <Alert
                        color={
                          getProductMotivationalMessage(product)?.color ||
                          "blue"
                        }
                        variant="light"
                        radius="md"
                        mt="xs"
                        p="xs"
                        withCloseButton={false}
                      >
                        {getProductMotivationalMessage(product)?.message}
                      </Alert>
                    )}
                  </div>
                </Group>

                <Group justify="space-between" align="center">
                  <Text fw={500}>Quantity:</Text>
                  <NumberInput
                    value={productQuantities[product._id] || 1}
                    onChange={(value) =>
                      handleQuantityChange(product._id, Number(value))
                    }
                    min={1}
                    size="md"
                    style={{ width: "120px" }}
                  />
                </Group>

                <Group justify="space-between" mt="md">
                  <Text fw={500}>Total:</Text>
                  <Text fw={700}>
                    {formatMoney({
                      ...product.price,
                      amount:
                        product.price.amount *
                        (productQuantities[product._id] || 1),
                    })}
                  </Text>
                </Group>
              </Card>
            ))}
          </Stack>
        </ScrollArea>

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
                {receiptData.items.map((item, index) => {
                  // Convert price and total to payment currency if different
                  const showConversion =
                    receiptData.cashReceived.currency !== item.price.currency;

                  // Convert price to payment currency
                  const priceInPaymentCurrency = showConversion
                    ? {
                        amount: convertFromBaseCurrency(
                          convertToBaseCurrency(item.price),
                          receiptData.cashReceived.currency,
                          receiptData.cashReceived.exchangeRate
                        ),
                        currency: receiptData.cashReceived.currency,
                        exchangeRate: receiptData.cashReceived.exchangeRate,
                      }
                    : null;

                  // Convert total to payment currency
                  const totalInPaymentCurrency = showConversion
                    ? {
                        amount: convertFromBaseCurrency(
                          convertToBaseCurrency(item.total),
                          receiptData.cashReceived.currency,
                          receiptData.cashReceived.exchangeRate
                        ),
                        currency: receiptData.cashReceived.currency,
                        exchangeRate: receiptData.cashReceived.exchangeRate,
                      }
                    : null;

                  return (
                    <Table.Tr key={index}>
                      <Table.Td>{item.productName}</Table.Td>
                      <Table.Td>{item.qty}</Table.Td>
                      <Table.Td>
                        {formatMoney(item.price)}
                        {showConversion && priceInPaymentCurrency && (
                          <Text size="xs" c="dimmed" mt={2}>
                            {formatMoney(priceInPaymentCurrency)}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {formatMoney(item.total)}
                        {showConversion && totalInPaymentCurrency && (
                          <Text size="xs" c="dimmed" mt={2}>
                            {formatMoney(totalInPaymentCurrency)}
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            <Divider my="sm" />

            <Group justify="space-between">
              <Text fw={700}>Total:</Text>
              <Text fw={700}>{formatMoney(receiptData.totalAmount)}</Text>
            </Group>

            {receiptData.cashReceived.currency !==
              receiptData.totalAmount.currency && (
              <Group justify="space-between">
                <Text>Total ({receiptData.cashReceived.currency}):</Text>
                <Text>
                  {formatMoney({
                    amount: convertFromBaseCurrency(
                      convertToBaseCurrency(receiptData.totalAmount),
                      receiptData.cashReceived.currency,
                      receiptData.cashReceived.exchangeRate
                    ),
                    currency: receiptData.cashReceived.currency,
                    exchangeRate: receiptData.cashReceived.exchangeRate,
                  })}
                </Text>
              </Group>
            )}

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
