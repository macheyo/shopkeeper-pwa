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
  IconShoppingBag,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconReceipt,
  IconEdit,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getPurchasesDB, getProductsDB } from "@/lib/databases";
import { createPurchaseEntry, generateTrialBalance } from "@/lib/accounting";
import { createInventoryLots } from "@/lib/inventory";
import { ProductDoc, PurchaseItem, PaymentMethod } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { addShopIdFilter } from "@/lib/queryHelpers";
import {
  formatMoney,
  createMoney,
  Money,
  BASE_CURRENCY,
  CurrencyCode,
  convertMoneyWithRates,
} from "@/types/money";
import MoneyInput from "@/components/MoneyInput";
import { PaymentMethodSelect } from "@/components/PaymentMethodSelect";
import { AccountCode } from "@/types/accounting";
import { getShopSettings } from "@/lib/settingsDB";
import { getLedgerDB } from "@/lib/databases";
import { LedgerEntryDoc } from "@/types/accounting";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
});

export default function NewPurchasePage() {
  const router = useRouter();
  const { currentUser, shop } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [supplierName, setSupplierName] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductDoc[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductDoc[]>([]);
  const [quantityDrawerOpen, setQuantityDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [cartItems, setCartItems] = useState<PurchaseItem[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    items: PurchaseItem[];
    totalAmount: Money;
    timestamp: string;
    paymentMethod: PaymentMethod;
    supplierName: string;
  } | null>(null);
  const [editingCartItemIndex, setEditingCartItemIndex] = useState<
    number | null
  >(null);
  const [editCartItemForm, setEditCartItemForm] = useState<{
    quantity: number;
    costPrice: Money;
    sellingPrice: Money;
  } | null>(null);
  const [paymentMethodError, setPaymentMethodError] = useState<string | null>(
    null
  );

  const form = useForm({
    initialValues: {
      quantity: 1,
      costPrice: 0,
      sellingPrice: 0,
    },
    validate: {
      quantity: (value: number) =>
        value > 0 ? null : "Quantity must be greater than 0",
      costPrice: (value: number) =>
        value > 0 ? null : "Cost price must be greater than 0",
      sellingPrice: (value: number) =>
        value > 0 ? null : "Selling price must be greater than 0",
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

  const [productDetails, setProductDetails] = useState<
    Record<
      string,
      {
        quantity: number;
        costPrice: Money;
        sellingPrice: Money;
      }
    >
  >({});

  const handleProductSelect = (product: ProductDoc, isSelected: boolean) => {
    if (isSelected) {
      setSelectedProducts([...selectedProducts, product]);
      // Initialize details for newly selected product
      setProductDetails({
        ...productDetails,
        [product._id]: {
          quantity: 1,
          costPrice: product.costPrice || createMoney(0),
          sellingPrice: product.price, // Use current selling price as initial value
        },
      });
    } else {
      setSelectedProducts(
        selectedProducts.filter((p) => p._id !== product._id)
      );
      // Remove details for deselected product
      const newDetails = { ...productDetails };
      delete newDetails[product._id];
      setProductDetails(newDetails);
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

  const handleDetailsChange = (
    productId: string,
    field: "quantity" | "costPrice" | "sellingPrice",
    value: number | Money
  ) => {
    setProductDetails({
      ...productDetails,
      [productId]: {
        ...productDetails[productId],
        [field]: value,
      },
    });
  };

  const handleAddSelectedToCart = () => {
    if (selectedProducts.length === 0) return;

    // Validate profitability before adding to cart
    const unprofitableItems: string[] = [];
    selectedProducts.forEach((product) => {
      const details = productDetails[product._id];
      if (details.sellingPrice.amount <= details.costPrice.amount) {
        unprofitableItems.push(product.name);
      }
    });

    if (unprofitableItems.length > 0) {
      setError(
        `The following items are not profitable (selling price must be greater than cost price): ${unprofitableItems.join(
          ", "
        )}`
      );
      return;
    }

    const newItems: PurchaseItem[] = selectedProducts.map((product) => {
      const details = productDetails[product._id];
      const quantity = details.quantity;

      // Calculate total for this item
      const itemTotal = {
        ...details.costPrice,
        amount: details.costPrice.amount * quantity,
      };

      // Calculate expected profit per unit
      const expectedProfit = {
        ...details.sellingPrice,
        amount: details.sellingPrice.amount - details.costPrice.amount,
      };

      return {
        productId: product._id,
        productName: product.name,
        productCode: product.code,
        qty: quantity,
        costPrice: details.costPrice,
        total: itemTotal,
        intendedSellingPrice: details.sellingPrice,
        expectedProfit: expectedProfit,
      };
    });

    // Add to cart
    setCartItems([...cartItems, ...newItems]);

    // Reset selection
    setSelectedProducts([]);
    setProductDetails({});
    setQuantityDrawerOpen(false);
    setSearchTerm("");
  };

  const handleRemoveFromCart = (index: number) => {
    const newCartItems = [...cartItems];
    newCartItems.splice(index, 1);
    setCartItems(newCartItems);
  };

  const handleEditCartItem = (index: number) => {
    const item = cartItems[index];
    setEditCartItemForm({
      quantity: item.qty,
      costPrice: item.costPrice,
      sellingPrice: item.intendedSellingPrice,
    });
    setEditingCartItemIndex(index);
  };

  const handleSaveCartItemEdit = () => {
    if (editingCartItemIndex === null || !editCartItemForm) return;

    // Validate profitability
    if (
      editCartItemForm.sellingPrice.amount <= editCartItemForm.costPrice.amount
    ) {
      setError("Selling price must be greater than cost price");
      return;
    }

    const item = cartItems[editingCartItemIndex];
    const itemTotal = {
      ...editCartItemForm.costPrice,
      amount: editCartItemForm.costPrice.amount * editCartItemForm.quantity,
    };
    const expectedProfit = {
      ...editCartItemForm.sellingPrice,
      amount:
        editCartItemForm.sellingPrice.amount -
        editCartItemForm.costPrice.amount,
    };

    const updatedItem: PurchaseItem = {
      ...item,
      qty: editCartItemForm.quantity,
      costPrice: editCartItemForm.costPrice,
      intendedSellingPrice: editCartItemForm.sellingPrice,
      total: itemTotal,
      expectedProfit: expectedProfit,
    };

    const newCartItems = [...cartItems];
    newCartItems[editingCartItemIndex] = updatedItem;
    setCartItems(newCartItems);
    setEditingCartItemIndex(null);
    setEditCartItemForm(null);
    setError(null);
  };

  // Calculate total price for all items in the cart
  // Convert money to base currency
  const convertToBaseCurrency = (money: Money): Money => {
    if (money.currency === BASE_CURRENCY) return money;
    return {
      amount: money.amount / money.exchangeRate,
      currency: BASE_CURRENCY,
      exchangeRate: 1,
    };
  };

  // Calculate total price in base currency
  const calculateTotalPrice = () => {
    if (cartItems.length === 0) {
      return createMoney(0);
    }

    let totalInBase = 0;

    // Convert each item's total to base currency and sum
    cartItems.forEach((item) => {
      const itemTotalInBase = convertToBaseCurrency(item.total);
      totalInBase += itemTotalInBase.amount;
    });

    // Return total in base currency
    return {
      amount: totalInBase,
      currency: BASE_CURRENCY,
      exchangeRate: 1,
    };
  };

  const totalPrice = calculateTotalPrice();

  // Check if purchase is profitable (selling price > cost price for all items)
  const isPurchaseProfitable = () => {
    return cartItems.every((item) => {
      const costAmount = item.costPrice.amount;
      const sellingAmount = item.intendedSellingPrice.amount;
      return sellingAmount > costAmount;
    });
  };

  // Check if sufficient funds available for non-credit payments
  const hasSufficientFunds = async (): Promise<boolean> => {
    if (paymentMethod === "credit") return true;

    try {
      const settings = await getShopSettings();
      if (!settings) return false;

      const baseCurrency = settings.baseCurrency as CurrencyCode;
      const exchangeRates = settings.currencies.reduce((acc, curr) => {
        acc[curr.code as CurrencyCode] = curr.exchangeRate;
        return acc;
      }, {} as Record<CurrencyCode, number>);
      exchangeRates[baseCurrency] = 1;

      const trialBalance = await generateTrialBalance(
        new Date(0).toISOString(),
        new Date().toISOString()
      );

      // Convert total price to base currency
      const totalInBase = convertMoneyWithRates(
        totalPrice,
        baseCurrency,
        exchangeRates[baseCurrency],
        baseCurrency
      );

      let availableBalance: Money;

      if (paymentMethod === "cash") {
        const cashAccount = trialBalance.accounts[AccountCode.CASH];
        availableBalance = cashAccount
          ? cashAccount.netBalance
          : createMoney(0, baseCurrency, 1);
      } else if (paymentMethod === "bank") {
        // Calculate bank balance from settings + transactions
        let bankOpeningBalance = 0;
        settings.accounts.forEach((account) => {
          if (account.type === "bank") {
            const accountBalance = convertMoneyWithRates(
              {
                amount: account.balance,
                currency: account.currency as CurrencyCode,
                exchangeRate:
                  exchangeRates[account.currency as CurrencyCode] || 1,
              },
              baseCurrency,
              exchangeRates[baseCurrency],
              baseCurrency
            );
            bankOpeningBalance += accountBalance.amount;
          }
        });

        const ledgerDB = await getLedgerDB();
        const ledgerEntries = await ledgerDB.find({
          selector: {
            type: "ledger_entry",
            "metadata.paymentMethod": "bank",
          },
        });

        let bankNetChange = 0;
        (ledgerEntries.docs as LedgerEntryDoc[]).forEach((entry) => {
          const cashLine = entry.lines.find(
            (line) =>
              line.accountCode === AccountCode.CASH ||
              line.accountCode === AccountCode.ACCOUNTS_RECEIVABLE
          );
          if (cashLine && entry.metadata?.paymentMethod === "bank") {
            const debitAmount = convertMoneyWithRates(
              cashLine.debit,
              baseCurrency,
              exchangeRates[baseCurrency],
              baseCurrency
            ).amount;
            const creditAmount = convertMoneyWithRates(
              cashLine.credit,
              baseCurrency,
              exchangeRates[baseCurrency],
              baseCurrency
            ).amount;
            bankNetChange += debitAmount - creditAmount;
          }
        });

        availableBalance = createMoney(
          bankOpeningBalance + bankNetChange,
          baseCurrency,
          1
        );
      } else if (paymentMethod === "mobile_money") {
        // Calculate mobile_money balance from settings + transactions
        let mobileMoneyOpeningBalance = 0;
        settings.accounts.forEach((account) => {
          if (account.type === "mobile_money") {
            const accountBalance = convertMoneyWithRates(
              {
                amount: account.balance,
                currency: account.currency as CurrencyCode,
                exchangeRate:
                  exchangeRates[account.currency as CurrencyCode] || 1,
              },
              baseCurrency,
              exchangeRates[baseCurrency],
              baseCurrency
            );
            mobileMoneyOpeningBalance += accountBalance.amount;
          }
        });

        const ledgerDB = await getLedgerDB();
        const ledgerEntries = await ledgerDB.find({
          selector: {
            type: "ledger_entry",
            "metadata.paymentMethod": "mobile_money",
          },
        });

        let mobileMoneyNetChange = 0;
        (ledgerEntries.docs as LedgerEntryDoc[]).forEach((entry) => {
          const cashLine = entry.lines.find(
            (line) =>
              line.accountCode === AccountCode.CASH ||
              line.accountCode === AccountCode.ACCOUNTS_RECEIVABLE
          );
          if (cashLine && entry.metadata?.paymentMethod === "mobile_money") {
            const debitAmount = convertMoneyWithRates(
              cashLine.debit,
              baseCurrency,
              exchangeRates[baseCurrency],
              baseCurrency
            ).amount;
            const creditAmount = convertMoneyWithRates(
              cashLine.credit,
              baseCurrency,
              exchangeRates[baseCurrency],
              baseCurrency
            ).amount;
            mobileMoneyNetChange += debitAmount - creditAmount;
          }
        });

        availableBalance = createMoney(
          mobileMoneyOpeningBalance + mobileMoneyNetChange,
          baseCurrency,
          1
        );
      } else {
        return true; // Unknown payment method, allow it
      }

      return availableBalance.amount >= totalInBase.amount;
    } catch (err) {
      console.error("Error checking sufficient funds:", err);
      return false;
    }
  };

  const handleSavePurchase = async () => {
    if (typeof window === "undefined") {
      setError("Purchases can only be recorded in the browser");
      return;
    }

    if (!shop?.shopId) {
      setError("Shop information is not available. Please refresh the page.");
      return;
    }

    if (!currentUser?.userId) {
      setError("User information is not available. Please refresh the page.");
      return;
    }

    if (cartItems.length === 0) {
      setError("Please add at least one product to the cart");
      return;
    }

    // Validate profitability
    if (!isPurchaseProfitable()) {
      setError(
        "Purchase is not profitable. Selling price must be greater than cost price for all items."
      );
      return;
    }

    // Validate sufficient funds for non-credit payments
    const hasFunds = await hasSufficientFunds();
    if (!hasFunds) {
      const errorMessage = `Insufficient ${
        paymentMethod === "cash"
          ? "cash"
          : paymentMethod === "bank"
          ? "bank"
          : "mobile money"
      }. Please use credit or add funds.`;
      setError(errorMessage);
      setPaymentMethodError(errorMessage);
      return;
    }

    // Clear payment method error if validation passes
    setPaymentMethodError(null);

    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const purchaseRunId = `purchase_${now.getTime()}`;

      const purchasesDB = await getPurchasesDB();

      // Update stock levels and product details
      const productsDB = await getProductsDB();
      for (const item of cartItems) {
        const product = products.find((p) => p._id === item.productId);
        if (product) {
          await productsDB.put({
            ...product,
            stockQuantity: (product.stockQuantity || 0) + item.qty,
            costPrice: item.costPrice,
            price: item.intendedSellingPrice,
            purchaseDate: now.toISOString(),
            updatedAt: now.toISOString(),
          });
        }
      }

      // Save the purchase
      const purchaseDoc = {
        _id: `${purchaseRunId}`,
        type: "purchase",
        purchaseRunId,
        items: cartItems,
        totalAmount: totalPrice,
        timestamp: now.toISOString(),
        paymentMethod: paymentMethod,
        supplier: supplierName || undefined, // Use supplier to match type definition
        status: "pending", // Will be synced later via WhatsApp
        shopId: shop.shopId,
        createdBy: currentUser.userId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await purchasesDB.put(purchaseDoc);

      // Create inventory lots for FIFO tracking
      await createInventoryLots(
        purchaseRunId,
        now.toISOString(),
        cartItems,
        supplierName || undefined,
        shop.shopId
      );

      // Create ledger entry for the purchase
      await createPurchaseEntry(
        purchaseRunId,
        totalPrice,
        paymentMethod,
        now.toISOString(),
        shop.shopId,
        currentUser.userId
      );

      // Set receipt data for display
      setReceiptData({
        items: cartItems,
        totalAmount: totalPrice,
        timestamp: now.toISOString(),
        paymentMethod: paymentMethod,
        supplierName: supplierName,
      });

      setShowReceipt(true);
      setSuccess(true);

      // Clear errors
      setError(null);
      setPaymentMethodError(null);

      // Clear cart
      setCartItems([]);
      form.reset();
    } catch (err) {
      console.error("Error saving purchase:", err);
      setError(
        `Failed to save purchase: ${
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
    router.push("/purchases");
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
          <Title order={2}>New Purchase</Title>
          <Button
            variant="outline"
            leftSection={<IconArrowLeft size={20} />}
            onClick={() => router.push("/purchases")}
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
          Purchase recorded successfully!
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
                  <Text size="sm">Cost Price:</Text>
                  <Text>{formatMoney(item.costPrice)}</Text>
                </Group>
                <Group justify="space-between" mb="xs">
                  <Text size="sm">Selling Price:</Text>
                  <Text>{formatMoney(item.intendedSellingPrice)}</Text>
                </Group>
                <Group justify="space-between" mb="xs">
                  <Text size="sm">Expected Profit:</Text>
                  <Text c="green">{formatMoney(item.expectedProfit)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Total Cost:</Text>
                  <Text fw={700}>{formatMoney(item.total)}</Text>
                </Group>
              </Card>
            ))}
          </Stack>

          <TextInput
            label="Supplier Name"
            placeholder="Enter supplier name"
            value={supplierName}
            onChange={(e) => setSupplierName(e.currentTarget.value)}
            mb="md"
          />
          <PaymentMethodSelect
            value={paymentMethod}
            onChange={(method) => {
              setPaymentMethod(method);
              // Clear error when payment method changes
              setPaymentMethodError(null);
              setError(null);
            }}
            className="mb-4"
            error={paymentMethodError || undefined}
          />

          <Card withBorder p="md" mb="md">
            <Group justify="space-between">
              <Text fw={700} size="lg">
                Total Cost:
              </Text>
              <Text fw={700} size="lg">
                {formatMoney(totalPrice)}
              </Text>
            </Group>
          </Card>

          <Button
            fullWidth
            color="blue"
            leftSection={<IconShoppingBag size={20} />}
            onClick={handleSavePurchase}
            loading={loading}
            size="xl"
            mt="xl"
            h={60}
          >
            Complete Purchase
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
                      <Text size="sm" c="dimmed">
                        Last Cost Price:{" "}
                        {product.costPrice
                          ? formatMoney(product.costPrice)
                          : "N/A"}
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
            leftSection={<IconShoppingBag size={20} />}
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

      {/* Quantity and Price Drawer */}
      <Drawer
        opened={quantityDrawerOpen}
        onClose={() => setQuantityDrawerOpen(false)}
        title={<Title order={3}>Set Details</Title>}
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
                    <Text size="sm" c="dimmed">
                      Current Stock: {product.stockQuantity || 0} units
                    </Text>
                  </div>
                </Group>

                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Text fw={500}>Quantity:</Text>
                    <NumberInput
                      value={productDetails[product._id]?.quantity || 1}
                      onChange={(value) =>
                        handleDetailsChange(
                          product._id,
                          "quantity",
                          Number(value)
                        )
                      }
                      min={1}
                      size="md"
                      style={{ width: "120px" }}
                    />
                  </Group>

                  <MoneyInput
                    label="Cost Price"
                    description="Price you're paying per unit"
                    value={
                      productDetails[product._id]?.costPrice || createMoney(0)
                    }
                    onChange={(value) =>
                      handleDetailsChange(
                        product._id,
                        "costPrice",
                        typeof value === "number"
                          ? {
                              ...(productDetails[product._id]?.costPrice ||
                                createMoney(0)),
                              amount: value,
                            }
                          : value
                      )
                    }
                    variant="light"
                    size="md"
                  />

                  <MoneyInput
                    label="Intended Selling Price"
                    description="Price you plan to sell at"
                    value={
                      productDetails[product._id]?.sellingPrice || product.price
                    }
                    onChange={(value) =>
                      handleDetailsChange(
                        product._id,
                        "sellingPrice",
                        typeof value === "number"
                          ? {
                              ...(productDetails[product._id]?.sellingPrice ||
                                product.price),
                              amount: value,
                            }
                          : value
                      )
                    }
                    variant="light"
                    size="md"
                  />

                  {productDetails[product._id] && (
                    <>
                      <Group justify="space-between">
                        <Text fw={500}>Total Cost:</Text>
                        <Text fw={700}>
                          {formatMoney({
                            ...productDetails[product._id].costPrice,
                            amount:
                              productDetails[product._id].costPrice.amount *
                              productDetails[product._id].quantity,
                          })}
                        </Text>
                      </Group>

                      <Group justify="space-between">
                        <Text fw={500}>Expected Profit per Unit:</Text>
                        <Text fw={700} c="green">
                          {formatMoney({
                            ...productDetails[product._id].sellingPrice,
                            amount:
                              productDetails[product._id].sellingPrice.amount -
                              productDetails[product._id].costPrice.amount,
                          })}
                        </Text>
                      </Group>
                    </>
                  )}
                </Stack>
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
            leftSection={<IconShoppingBag size={20} />}
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
                    label="Cost Price"
                    description="Price you're paying per unit"
                    value={editCartItemForm.costPrice}
                    onChange={(value) =>
                      setEditCartItemForm({
                        ...editCartItemForm,
                        costPrice:
                          typeof value === "number"
                            ? { ...editCartItemForm.costPrice, amount: value }
                            : value,
                      })
                    }
                    variant="light"
                    size="md"
                  />

                  <MoneyInput
                    label="Intended Selling Price"
                    description="Price you plan to sell at"
                    value={editCartItemForm.sellingPrice}
                    onChange={(value) =>
                      setEditCartItemForm({
                        ...editCartItemForm,
                        sellingPrice:
                          typeof value === "number"
                            ? {
                                ...editCartItemForm.sellingPrice,
                                amount: value,
                              }
                            : value,
                      })
                    }
                    variant="light"
                    size="md"
                  />

                  <Group justify="space-between">
                    <Text fw={500}>Total Cost:</Text>
                    <Text fw={700}>
                      {formatMoney({
                        ...editCartItemForm.costPrice,
                        amount:
                          editCartItemForm.costPrice.amount *
                          editCartItemForm.quantity,
                      })}
                    </Text>
                  </Group>

                  <Group justify="space-between">
                    <Text fw={500}>Expected Profit per Unit:</Text>
                    <Text fw={700} c="green">
                      {formatMoney({
                        ...editCartItemForm.sellingPrice,
                        amount:
                          editCartItemForm.sellingPrice.amount -
                          editCartItemForm.costPrice.amount,
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
              Purchase Receipt
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
                  <Table.Th>Cost Price</Table.Th>
                  <Table.Th>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {receiptData.items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{item.productName}</Table.Td>
                    <Table.Td>{item.qty}</Table.Td>
                    <Table.Td>{formatMoney(item.costPrice)}</Table.Td>
                    <Table.Td>{formatMoney(item.total)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Divider my="sm" />

            <Group justify="space-between">
              <Text fw={700}>Total Cost:</Text>
              <Text fw={700}>{formatMoney(receiptData.totalAmount)}</Text>
            </Group>

            <Group justify="space-between">
              <Text fw={700}>Payment Method:</Text>
              <Text fw={700}>{receiptData.paymentMethod}</Text>
            </Group>

            <Divider my="sm" />

            <Text ta="center" c="dimmed" size="sm">
              Purchase recorded successfully!
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
