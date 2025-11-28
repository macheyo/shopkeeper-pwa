"use client"; // This component interacts with browser APIs

import React, { useState, useEffect } from "react";
import {
  Table,
  Button,
  Text,
  Alert,
  Stack,
  Card,
  Group,
  Center,
  Loader,
} from "@mantine/core";
import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { getProductsDB } from "@/lib/databases";
import { ProductDoc } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { addShopIdFilter, filterByShopId } from "@/lib/queryHelpers";
import { formatMoney } from "@/types/money";

export default function ProductManager() {
  const { shop } = useAuth();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMockData, setIsMockData] = useState<boolean>(false);

  // Function to fetch products from the database
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get the products database
      const db = await getProductsDB();

      // Check if the database is initialized
      if (!db) {
        console.error("Products database is not initialized");
        setError("Database not available. Please try again later.");
        setProducts([]);
        setIsMockData(false);
        return;
      }

      // Fetch all products
      const result = await db.allDocs({
        include_docs: true,
      });

      // Map the results to our ProductDoc type
      const allProducts = result.rows
        .map((row) => row.doc as ProductDoc)
        .filter((doc) => doc && doc.type === "product");

      // Filter by shopId for data isolation
      const fetchedProducts = filterByShopId(allProducts, shop?.shopId);

      if (fetchedProducts.length > 0) {
        setProducts(fetchedProducts);
      } else {
        // If no products found, show empty state
        console.log("No products found in database");
        setProducts([]);
        setIsMockData(false);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
      // Show error but don't fallback to mock data
      setProducts([]);
      setIsMockData(false);

      const message = err instanceof Error ? err.message : String(err);
      setError(`Error fetching products: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch products when component mounts or shop changes
  useEffect(() => {
    if (shop?.shopId) {
      fetchProducts();
    }
  }, [shop?.shopId]);

  const handleRefresh = () => {
    fetchProducts();
  };

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert
        icon={
          <IconAlertCircle size="1rem" className="tabler-icon icon-pulse" />
        }
        title="Error"
        color="red"
      >
        {error}
      </Alert>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="xl" fw={700}>
          {isMockData ? "Your Products (Mock Data)" : "Your Products"}
        </Text>
        <Button
          variant="subtle"
          leftSection={<IconRefresh size={16} />}
          onClick={handleRefresh}
        >
          Refresh
        </Button>
      </Group>

      {products.length === 0 ? (
        <Text size="lg" ta="center" py="xl">
          No products found. Add products through the Purchases page.
        </Text>
      ) : (
        <div style={{ maxWidth: "100%", overflowX: "auto" }}>
          {/* For larger screens, show as a table */}
          <Table
            striped
            highlightOnHover
            withTableBorder
            withColumnBorders
            visibleFrom="sm"
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Price</Table.Th>
                <Table.Th>Stock</Table.Th>
                <Table.Th>Barcode</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {products.map((product, index) => (
                <Table.Tr
                  key={product._id}
                  style={{
                    transition: "all 0.2s ease",
                    animation: `fadeIn 0.3s ease forwards ${index * 0.05}s`,
                    opacity: 0,
                  }}
                >
                  <Table.Td>{product.code}</Table.Td>
                  <Table.Td>{product.name}</Table.Td>
                  <Table.Td>{formatMoney(product.price)}</Table.Td>
                  <Table.Td>{product.stockQuantity || 0} units</Table.Td>
                  <Table.Td>{product.barcode || "N/A"}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {/* For mobile, show as cards */}
          <Stack gap="md" hiddenFrom="sm">
            {products.map((product, index) => (
              <Card
                key={product._id}
                withBorder
                padding="md"
                style={{
                  transition: "all 0.2s ease",
                  transform: "translateY(0)",
                  animation: `slideIn 0.3s ease forwards ${index * 0.05}s`,
                  opacity: 0,
                }}
              >
                <Group justify="space-between" mb="xs">
                  <Text fw={700} size="lg">
                    {product.name}
                  </Text>
                  <Text fw={700} size="lg">
                    {formatMoney(product.price)}
                  </Text>
                </Group>
                <Stack gap="xs">
                  <Text size="md">Code: {product.code}</Text>
                  <Text size="md">
                    Stock: {product.stockQuantity || 0} units
                  </Text>
                  {product.barcode && (
                    <Text size="md">Barcode: {product.barcode}</Text>
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>
        </div>
      )}

      {/* Add CSS animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Add hover effects for cards */
        .mantine-Card-root {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .mantine-Card-root:hover {
          transform: translateY(-3px);
          box-shadow: var(--mantine-shadow-sm);
        }

        /* Add hover effects for table rows */
        .mantine-Table-tr {
          transition: background-color 0.2s ease;
        }

        /* Add hover effects for buttons */
        .mantine-Button-root {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .mantine-Button-root:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: var(--mantine-shadow-xs);
        }

        .mantine-Button-root:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>
    </>
  );
}
