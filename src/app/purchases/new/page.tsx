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
  IconTrash,
  IconReceipt,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getPurchasesDB, getProductsDB } from "@/lib/databases";
import { createPurchaseEntry } from "@/lib/accounting";
import { ProductDoc, PurchaseItem, PaymentMethod } from "@/types";
import { formatMoney, createMoney, Money, BASE_CURRENCY } from "@/types/money";
import MoneyInput from "@/components/MoneyInput";
import { PaymentMethodSelect } from "@/components/PaymentMethodSelect";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
});

export default function NewPurchasePage() {
  const router = useRouter();
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

    const newItems: PurchaseItem[] = selectedProducts.map((product) => {
      const details = productDetails[product._id];
      const quantity = details.quantity;

      // Calculate total for this item
      const itemTotal = {
        ...details.costPrice,
        amount: details.costPrice.amount * quantity,
      };

      // Calculate expected profit per unit with currency conversion
      // Convert both to base currency for accurate profit calculation
      const costPriceInBase = convertToBaseCurrency(details.costPrice);
      const sellingPriceInBase = convertToBaseCurrency(details.sellingPrice);

      // Calculate profit in base currency
      const profitInBase = sellingPriceInBase.amount - costPriceInBase.amount;

      // Convert profit back to selling price currency for display
      const expectedProfit = {
        ...details.sellingPrice,
        amount: profitInBase * details.sellingPrice.exchangeRate,
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

  const handleSavePurchase = async () => {
    if (typeof window === "undefined") {
      setError("Purchases can only be recorded in the browser");
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
        supplierName: supplierName,
        status: "pending", // Will be synced later via WhatsApp
      };
      await purchasesDB.put(purchaseDoc);

      // Create ledger entry for the purchase
      await createPurchaseEntry(
        purchaseRunId,
        totalPrice,
        paymentMethod,
        now.toISOString()
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
                  <Text size="sm">Cost Price:</Text>
                  <Stack gap={0}>
                    <Text>{formatMoney(item.costPrice)}</Text>
                    {item.costPrice.currency !== BASE_CURRENCY && (
                      <Text size="xs" c="dimmed">
                        ({formatMoney(convertToBaseCurrency(item.costPrice))})
                      </Text>
                    )}
                  </Stack>
                </Group>
                <Group justify="space-between" mb="xs">
                  <Text size="sm">Selling Price:</Text>
                  <Stack gap={0}>
                    <Text>{formatMoney(item.intendedSellingPrice)}</Text>
                    {item.intendedSellingPrice.currency !== BASE_CURRENCY && (
                      <Text size="xs" c="dimmed">
                        (
                        {formatMoney(
                          convertToBaseCurrency(item.intendedSellingPrice)
                        )}
                        )
                      </Text>
                    )}
                  </Stack>
                </Group>
                <Group justify="space-between" mb="xs">
                  <Text size="sm">Expected Profit:</Text>
                  <Stack gap={0}>
                    <Text c="green">{formatMoney(item.expectedProfit)}</Text>
                    {item.expectedProfit.currency !== BASE_CURRENCY && (
                      <Text size="xs" c="dimmed">
                        (
                        {formatMoney(
                          convertToBaseCurrency(item.expectedProfit)
                        )}
                        )
                      </Text>
                    )}
                  </Stack>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Total Cost:</Text>
                  <Stack gap={0}>
                    <Text fw={700}>{formatMoney(item.total)}</Text>
                    {item.total.currency !== BASE_CURRENCY && (
                      <Text size="xs" c="dimmed">
                        ({formatMoney(convertToBaseCurrency(item.total))})
                      </Text>
                    )}
                  </Stack>
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
            onChange={setPaymentMethod}
            className="mb-4"
          />

          <Card withBorder p="md" mb="md">
            <Group justify="space-between">
              <Text fw={700} size="lg">
                Total Cost:
              </Text>
              <Stack gap={0}>
                <Text fw={700} size="lg">
                  {formatMoney(totalPrice)}
                </Text>
                {totalPrice.currency !== BASE_CURRENCY && (
                  <Text size="xs" c="dimmed">
                    ({formatMoney(convertToBaseCurrency(totalPrice))})
                  </Text>
                )}
              </Stack>
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
                      <Stack gap={0}>
                        <Text fw={700} size="xl">
                          {formatMoney(product.price)}
                        </Text>
                        {product.price.currency !== BASE_CURRENCY && (
                          <Text size="xs" c="dimmed">
                            ({formatMoney(convertToBaseCurrency(product.price))}
                            )
                          </Text>
                        )}
                      </Stack>
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
                          : value // Pass the entire Money object when currency changes
                      )
                    }
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
                          : value // Pass the entire Money object when currency changes
                      )
                    }
                  />

                  {productDetails[product._id] && (
                    <>
                      <Group justify="space-between">
                        <Text fw={500}>Total Cost:</Text>
                        <Stack gap={0}>
                          {(() => {
                            const totalCost = {
                              ...productDetails[product._id].costPrice,
                              amount:
                                productDetails[product._id].costPrice.amount *
                                productDetails[product._id].quantity,
                            };

                            return (
                              <>
                                <Text fw={700}>{formatMoney(totalCost)}</Text>
                                {totalCost.currency !== BASE_CURRENCY && (
                                  <Text size="xs" c="dimmed">
                                    (
                                    {formatMoney(
                                      convertToBaseCurrency(totalCost)
                                    )}
                                    )
                                  </Text>
                                )}
                              </>
                            );
                          })()}
                        </Stack>
                      </Group>

                      <Group justify="space-between">
                        <Text fw={500}>Expected Profit per Unit:</Text>
                        <Stack gap={0}>
                          {(() => {
                            // Calculate expected profit with currency conversion
                            const costPrice =
                              productDetails[product._id].costPrice;
                            const sellingPrice =
                              productDetails[product._id].sellingPrice;

                            // Convert both to base currency for accurate profit calculation
                            const costPriceInBase =
                              convertToBaseCurrency(costPrice);
                            const sellingPriceInBase =
                              convertToBaseCurrency(sellingPrice);

                            // Calculate profit in base currency
                            const profitInBase =
                              sellingPriceInBase.amount -
                              costPriceInBase.amount;

                            // Convert profit back to selling price currency for display
                            const profitInSellingCurrency = {
                              ...sellingPrice,
                              amount: profitInBase * sellingPrice.exchangeRate,
                            };

                            // Create profit in base currency for display
                            const profitInBaseCurrency = {
                              amount: profitInBase,
                              currency: BASE_CURRENCY,
                              exchangeRate: 1,
                            };

                            return (
                              <>
                                <Text fw={700} c="green">
                                  {formatMoney(profitInSellingCurrency)}
                                </Text>
                                {sellingPrice.currency !== BASE_CURRENCY && (
                                  <Text size="xs" c="dimmed">
                                    ({formatMoney(profitInBaseCurrency)})
                                  </Text>
                                )}
                              </>
                            );
                          })()}
                        </Stack>
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
                    <Table.Td>
                      <Stack gap={0}>
                        <Text>{formatMoney(item.costPrice)}</Text>
                        {item.costPrice.currency !== BASE_CURRENCY && (
                          <Text size="xs" c="dimmed">
                            (
                            {formatMoney(convertToBaseCurrency(item.costPrice))}
                            )
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text>{formatMoney(item.total)}</Text>
                        {item.total.currency !== BASE_CURRENCY && (
                          <Text size="xs" c="dimmed">
                            ({formatMoney(convertToBaseCurrency(item.total))})
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Divider my="sm" />

            <Group justify="space-between">
              <Text fw={700}>Total Cost:</Text>
              <Stack gap={0}>
                <Text fw={700}>{formatMoney(receiptData.totalAmount)}</Text>
                {receiptData.totalAmount.currency !== BASE_CURRENCY && (
                  <Text size="xs" c="dimmed">
                    (
                    {formatMoney(
                      convertToBaseCurrency(receiptData.totalAmount)
                    )}
                    )
                  </Text>
                )}
              </Stack>
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
