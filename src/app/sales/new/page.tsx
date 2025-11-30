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
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconSearch,
  IconBarcode,
  IconShoppingCart,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconReceipt,
  IconEdit,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getSalesDB, getProductsDB } from "@/lib/databases";
import { createSaleEntry } from "@/lib/accounting";
import { allocateInventoryFIFO } from "@/lib/inventory";
import { ProductDoc, SaleItem, PaymentMethod } from "@/types";
import { formatMoney, createMoney, BASE_CURRENCY, Money } from "@/types/money";
import { useAuth } from "@/contexts/AuthContext";
import { addShopIdFilter } from "@/lib/queryHelpers";
import MoneyInput from "@/components/MoneyInput";
import { PaymentMethodSelect } from "@/components/PaymentMethodSelect";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
});

export default function NewSalePage() {
  const router = useRouter();
  const { currentUser, shop } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceivedError, setCashReceivedError] = useState<string | null>(
    null
  );
  const [profitabilityError, setProfitabilityError] = useState<string | null>(
    null
  );
  const [showScanner, setShowScanner] = useState(false);
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductDoc[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductDoc[]>([]);
  const [productQuantities, setProductQuantities] = useState<
    Record<string, number>
  >({});
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
  const [editingCartItemIndex, setEditingCartItemIndex] = useState<
    number | null
  >(null);
  const [editCartItemForm, setEditCartItemForm] = useState<{
    quantity: number;
    price: Money;
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
    if (!shop?.shopId) return;

    const fetchData = async () => {
      try {
        const productsDB = await getProductsDB();
        const result = await productsDB.find({
          selector: addShopIdFilter({ type: "product" }, shop.shopId),
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
  }, [shop?.shopId]);

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

  // Check profitability and payment sufficiency when cart items or payment method changes
  useEffect(() => {
    if (cartItems.length > 0) {
      // Check profitability
      const unprofitableItems = cartItems.filter((item) => {
        const costAmount = item.costPrice.amount;
        const sellingAmount = item.price.amount;
        return sellingAmount <= costAmount;
      });

      if (unprofitableItems.length > 0) {
        setProfitabilityError(
          `The following items are not profitable: ${unprofitableItems
            .map((item) => item.productName)
            .join(", ")}`
        );
      } else {
        setProfitabilityError(null);
      }
    } else {
      setProfitabilityError(null);
    }

    // Check payment sufficiency for cash payments
    if (paymentMethod === "cash" && cartItems.length > 0) {
      // Calculate total price inside useEffect to avoid dependency issues
      const currentTotalPrice = calculateTotalPrice();
      const totalInBase = convertToBaseCurrency(currentTotalPrice);
      const receivedInBase = convertToBaseCurrency(cashReceivedMoney);
      const isSufficient = receivedInBase.amount >= totalInBase.amount;

      if (!isSufficient && cashReceivedMoney.amount > 0) {
        setCashReceivedError(
          `Insufficient amount. Total is ${formatMoney(
            currentTotalPrice
          )}, but received ${formatMoney(cashReceivedMoney)}`
        );
      } else {
        setCashReceivedError(null);
      }
    } else {
      setCashReceivedError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, paymentMethod, cashReceivedMoney]);

  const handleProductSelect = (product: ProductDoc, isSelected: boolean) => {
    if (isSelected) {
      setSelectedProducts([...selectedProducts, product]);
      // Initialize quantity for this product
      setProductQuantities({
        ...productQuantities,
        [product._id]: 1,
      });
    } else {
      setSelectedProducts(
        selectedProducts.filter((p) => p._id !== product._id)
      );
      // Remove quantity for this product
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

    // Validate profitability before adding to cart
    const unprofitableItems: string[] = [];
    selectedProducts.forEach((product) => {
      const costAmount = (product.costPrice || createMoney(0)).amount;
      const sellingAmount = product.price.amount;
      if (sellingAmount <= costAmount) {
        unprofitableItems.push(product.name);
      }
    });

    if (unprofitableItems.length > 0) {
      const errorMsg = `The following items are not profitable (selling price must be greater than cost price): ${unprofitableItems.join(
        ", "
      )}`;
      setError(errorMsg);
      setProfitabilityError(errorMsg);
      return;
    }

    setProfitabilityError(null);

    const newItems: SaleItem[] = selectedProducts.map((product) => {
      // Use product-specific quantity, fallback to 1 if not set
      const quantity = productQuantities[product._id] || 1;

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

    // Reset selection and quantities
    setSelectedProducts([]);
    setProductQuantities({});
    setQuantityDrawerOpen(false);
    setSearchTerm("");
    form.reset();
  };

  const handleRemoveFromCart = (index: number) => {
    const newCartItems = [...cartItems];
    newCartItems.splice(index, 1);
    setCartItems(newCartItems);
    // Re-check profitability after removing item
    setTimeout(() => {
      if (newCartItems.length > 0) {
        const unprofitableItems = newCartItems.filter((item) => {
          const costAmount = item.costPrice.amount;
          const sellingAmount = item.price.amount;
          return sellingAmount <= costAmount;
        });
        if (unprofitableItems.length > 0) {
          setProfitabilityError(
            `The following items are not profitable: ${unprofitableItems
              .map((item) => item.productName)
              .join(", ")}`
          );
        } else {
          setProfitabilityError(null);
        }
      } else {
        setProfitabilityError(null);
      }
    }, 0);
  };

  const handleEditCartItem = (index: number) => {
    const item = cartItems[index];
    setEditCartItemForm({
      quantity: item.qty,
      price: item.price,
    });
    setEditingCartItemIndex(index);
  };

  const handleSaveCartItemEdit = () => {
    if (editingCartItemIndex === null || !editCartItemForm) return;

    // Validate profitability
    const item = cartItems[editingCartItemIndex];
    const costAmount = item.costPrice.amount;
    if (editCartItemForm.price.amount <= costAmount) {
      setError("Selling price must be greater than cost price");
      return;
    }

    const itemTotal = {
      ...editCartItemForm.price,
      amount: editCartItemForm.price.amount * editCartItemForm.quantity,
    };

    const updatedItem: SaleItem = {
      ...item,
      qty: editCartItemForm.quantity,
      price: editCartItemForm.price,
      total: itemTotal,
    };

    const newCartItems = [...cartItems];
    newCartItems[editingCartItemIndex] = updatedItem;
    setCartItems(newCartItems);
    setEditingCartItemIndex(null);
    setEditCartItemForm(null);
    setError(null);
    setProfitabilityError(null);

    // Re-check profitability after editing
    setTimeout(() => {
      const unprofitableItems = newCartItems.filter((item) => {
        const costAmount = item.costPrice.amount;
        const sellingAmount = item.price.amount;
        return sellingAmount <= costAmount;
      });
      if (unprofitableItems.length > 0) {
        setProfitabilityError(
          `The following items are not profitable: ${unprofitableItems
            .map((item) => item.productName)
            .join(", ")}`
        );
      } else {
        setProfitabilityError(null);
      }
    }, 0);
    setProfitabilityError(null);

    // Recalculate change if cash payment
    if (paymentMethod === "cash") {
      const totalInBase = convertToBaseCurrency(calculateTotalPrice());
      const receivedInBase = convertToBaseCurrency(cashReceivedMoney);
      const changeAmount = receivedInBase.amount - totalInBase.amount;
      setChange({
        ...cashReceivedMoney,
        amount: Math.max(0, changeAmount * cashReceivedMoney.exchangeRate),
      });
      // Re-check payment sufficiency
      isPaymentSufficient();
    }

    // Re-check profitability
    isSaleProfitable();
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

  // Check if sale is profitable (selling price > cost price for all items)
  const isSaleProfitable = () => {
    const unprofitableItems = cartItems.filter((item) => {
      const costAmount = item.costPrice.amount;
      const sellingAmount = item.price.amount;
      return sellingAmount <= costAmount;
    });

    if (unprofitableItems.length > 0) {
      setProfitabilityError(
        `The following items are not profitable: ${unprofitableItems
          .map((item) => item.productName)
          .join(", ")}`
      );
      return false;
    }

    setProfitabilityError(null);
    return true;
  };

  // Check if payment is sufficient and calculate change
  const isPaymentSufficient = () => {
    if (paymentMethod !== "cash") {
      setCashReceivedError(null);
      return true;
    }

    // Convert both amounts to base currency for comparison
    const totalInBase = convertToBaseCurrency(totalPrice);
    const receivedInBase = convertToBaseCurrency(cashReceivedMoney);

    // Calculate change in the payment currency
    const changeAmount = receivedInBase.amount - totalInBase.amount;

    // Always calculate and set change, even if negative (will show error)
    setChange({
      ...cashReceivedMoney,
      amount: Math.max(0, changeAmount * cashReceivedMoney.exchangeRate),
    });

    const isSufficient = receivedInBase.amount >= totalInBase.amount;

    // Set error state for UI feedback
    if (!isSufficient && cashReceivedMoney.amount > 0) {
      setCashReceivedError(
        `Insufficient amount. Total is ${formatMoney(
          totalPrice
        )}, but received ${formatMoney(cashReceivedMoney)}`
      );
    } else {
      setCashReceivedError(null);
    }

    return isSufficient;
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

    // Validate profitability
    if (!isSaleProfitable()) {
      const errorMsg =
        profitabilityError ||
        "Sale is not profitable. Selling price must be greater than cost price for all items.";
      setError(errorMsg);
      return;
    }

    // Double-check payment is sufficient for cash payments
    if (paymentMethod === "cash" && !isPaymentSufficient()) {
      const errorMsg =
        cashReceivedError ||
        "Payment amount is insufficient. Please enter the correct amount.";
      setError(errorMsg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Recalculate change right before saving to ensure accuracy
      let finalChange: Money | undefined = undefined;
      if (paymentMethod === "cash" && cashReceivedMoney.amount > 0) {
        const totalInBase = convertToBaseCurrency(totalPrice);
        const receivedInBase = convertToBaseCurrency(cashReceivedMoney);
        const changeAmount = receivedInBase.amount - totalInBase.amount;
        // Calculate change in the payment currency
        finalChange = {
          ...cashReceivedMoney,
          amount: Math.max(0, changeAmount * cashReceivedMoney.exchangeRate),
        };
        // Update state as well
        setChange(finalChange);
        console.log("[SALE] Calculated change before save:", {
          totalInBase: totalInBase.amount,
          receivedInBase: receivedInBase.amount,
          changeAmount,
          finalChange: finalChange.amount,
          currency: finalChange.currency,
        });
      } else if (paymentMethod === "cash") {
        // Cash payment but no amount received yet - set change to 0
        finalChange = createMoney(0, cashReceivedMoney.currency || "USD");
        setChange(finalChange);
      }

      const now = new Date();
      const saleId = `sale_${now.getTime()}`;

      const salesDB = await getSalesDB();

      // Allocate inventory using FIFO and track lots used
      const saleItemsWithLots: SaleItem[] = [];
      let totalCostAmount = 0;

      for (const item of cartItems) {
        // Allocate inventory using FIFO
        const lotsUsed = await allocateInventoryFIFO(
          item.productId,
          item.qty,
          shop?.shopId
        );

        // Calculate cost from lots (FIFO cost)
        const itemCost = lotsUsed.reduce((sum, lot) => {
          return sum + lot.costPrice.amount * lot.quantity;
        }, 0);

        totalCostAmount += itemCost;

        // Create sale item with lot tracking
        saleItemsWithLots.push({
          ...item,
          costPrice: {
            ...item.costPrice,
            amount: itemCost / item.qty, // Average cost per unit
          },
          lotsUsed,
        });
      }

      const totalCost = {
        ...totalPrice,
        amount: totalCostAmount,
      };

      const profit = {
        ...totalPrice,
        amount: totalPrice.amount - totalCost.amount,
      };

      // Update stock levels (for backward compatibility)
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

      // Save the sale with lot tracking
      const saleDoc = {
        _id: saleId,
        type: "sale",
        items: saleItemsWithLots,
        totalAmount: totalPrice,
        totalCost: totalCost,
        profit: profit,
        paymentMethod: paymentMethod,
        cashReceived: paymentMethod === "cash" ? cashReceivedMoney : undefined,
        change:
          paymentMethod === "cash" ? finalChange || createMoney(0) : undefined,
        timestamp: now.toISOString(),
        status: "pending", // Will be synced later via WhatsApp
        shopId: shop?.shopId,
        createdBy: currentUser?.userId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      console.log("[SALE] Saving sale document with change:", {
        paymentMethod,
        cashReceived: saleDoc.cashReceived,
        change: saleDoc.change,
      });
      await salesDB.put(saleDoc);

      // Create ledger entry for the sale
      await createSaleEntry(
        saleId,
        totalPrice,
        totalCost,
        paymentMethod,
        now.toISOString(),
        shop?.shopId,
        currentUser?.userId
      );

      // Set receipt data for display - use the final calculated change
      // For cash payments, always include change (even if 0)
      // For non-cash payments, change should be undefined
      setReceiptData({
        items: cartItems,
        totalAmount: totalPrice,
        cashReceived:
          paymentMethod === "cash" ? cashReceivedMoney : createMoney(0),
        change:
          paymentMethod === "cash"
            ? finalChange || createMoney(0)
            : createMoney(0),
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
                  <Group gap="xs">
                    <ActionIcon
                      color="blue"
                      variant="light"
                      onClick={() => handleEditCartItem(index)}
                    >
                      <IconEdit size="1.125rem" />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      variant="light"
                      onClick={() => handleRemoveFromCart(index)}
                    >
                      <IconX size="1.125rem" />
                    </ActionIcon>
                  </Group>
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

                // Auto-calculate change when cash received changes
                if (paymentMethod === "cash") {
                  const totalInBase = convertToBaseCurrency(totalPrice);
                  const receivedInBase = convertToBaseCurrency(newMoney);
                  const changeAmount =
                    receivedInBase.amount - totalInBase.amount;
                  setChange({
                    ...newMoney,
                    amount: Math.max(0, changeAmount * newMoney.exchangeRate),
                  });

                  // Check payment sufficiency in real-time
                  isPaymentSufficient();
                }
              }}
              error={cashReceivedError}
              variant="light"
              size="md"
            />
          )}

          <Card
            withBorder
            p="md"
            mb="md"
            style={{
              borderColor: profitabilityError
                ? "var(--mantine-color-red-6)"
                : undefined,
              borderWidth: profitabilityError ? 2 : undefined,
            }}
          >
            <Group justify="space-between">
              <Text fw={700} size="lg">
                Total Amount:
              </Text>
              <Text fw={700} size="lg">
                {formatMoney(totalPrice)}
              </Text>
            </Group>

            {profitabilityError && (
              <Text size="sm" c="red" mt="xs">
                {profitabilityError}
              </Text>
            )}

            {paymentMethod === "cash" && (
              <>
                <Group justify="space-between" mt="xs">
                  <Text>Cash Received:</Text>
                  <Text
                    c={cashReceivedError ? "red" : undefined}
                    fw={cashReceivedError ? 600 : undefined}
                  >
                    {formatMoney(cashReceivedMoney)}
                  </Text>
                </Group>
                <Group justify="space-between" mt="xs">
                  <Text>Change:</Text>
                  <Text
                    c={cashReceivedError ? "red" : undefined}
                    fw={cashReceivedError ? 600 : undefined}
                  >
                    {formatMoney(change)}
                  </Text>
                </Group>
                {cashReceivedError && (
                  <Text size="sm" c="red" mt="xs">
                    {cashReceivedError}
                  </Text>
                )}
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
        title="Set Quantity"
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
                  value={productQuantities[product._id] || 1}
                  onChange={(value) =>
                    setProductQuantities({
                      ...productQuantities,
                      [product._id]: Number(value) || 1,
                    })
                  }
                  min={1}
                  max={product.stockQuantity || 0}
                  size="md"
                  style={{ width: "120px" }}
                />
              </Group>

              {(productQuantities[product._id] || 1) > 0 && (
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

      {/* Edit Cart Item Drawer */}
      <Drawer
        opened={editingCartItemIndex !== null}
        onClose={() => {
          setEditingCartItemIndex(null);
          setEditCartItemForm(null);
          setError(null);
        }}
        title="Edit Cart Item"
        position="bottom"
        size="lg"
      >
        {editingCartItemIndex !== null && editCartItemForm && (
          <ScrollArea h={400} offsetScrollbars>
            <Stack gap="md">
              <Card withBorder p="md">
                <Text fw={700} size="lg" mb="md">
                  {cartItems[editingCartItemIndex].productName}
                </Text>
                <Text size="sm" c="dimmed" mb="lg">
                  Code: {cartItems[editingCartItemIndex].productCode}
                </Text>

                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Text fw={500}>Quantity:</Text>
                    <NumberInput
                      value={editCartItemForm.quantity}
                      onChange={(value) =>
                        setEditCartItemForm({
                          ...editCartItemForm,
                          quantity: Number(value) || 1,
                        })
                      }
                      min={1}
                      size="md"
                      style={{ width: "120px" }}
                    />
                  </Group>

                  <MoneyInput
                    label="Selling Price"
                    description="Price per unit"
                    value={editCartItemForm.price}
                    onChange={(value) =>
                      setEditCartItemForm({
                        ...editCartItemForm,
                        price:
                          typeof value === "number"
                            ? { ...editCartItemForm.price, amount: value }
                            : value,
                      })
                    }
                    variant="light"
                    size="md"
                  />

                  <Group justify="space-between">
                    <Text fw={500}>Total:</Text>
                    <Text fw={700}>
                      {formatMoney({
                        ...editCartItemForm.price,
                        amount:
                          editCartItemForm.price.amount *
                          editCartItemForm.quantity,
                      })}
                    </Text>
                  </Group>

                  <Group justify="space-between">
                    <Text fw={500}>Cost Price:</Text>
                    <Text c="dimmed">
                      {formatMoney(cartItems[editingCartItemIndex].costPrice)}
                    </Text>
                  </Group>

                  <Group justify="space-between">
                    <Text fw={500}>Profit per Unit:</Text>
                    <Text fw={700} c="green">
                      {formatMoney({
                        ...editCartItemForm.price,
                        amount:
                          editCartItemForm.price.amount -
                          cartItems[editingCartItemIndex].costPrice.amount,
                      })}
                    </Text>
                  </Group>
                </Stack>
              </Card>
            </Stack>
          </ScrollArea>
        )}

        <Group mt="xl">
          <Button
            variant="outline"
            onClick={() => {
              setEditingCartItemIndex(null);
              setEditCartItemForm(null);
              setError(null);
            }}
            style={{ flex: 1 }}
          >
            Cancel
          </Button>
          <Button
            color="green"
            onClick={handleSaveCartItemEdit}
            style={{ flex: 2 }}
            size="lg"
          >
            Save Changes
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
