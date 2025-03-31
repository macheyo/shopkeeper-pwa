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
import { IconAlertCircle } from "@tabler/icons-react";
import { getProductsDB } from "@/lib/databases";
import { ProductDoc } from "@/types";
import { formatMoney, createMoney, BASE_CURRENCY } from "@/types/money";

// Mock data for fallback
const mockProducts: ProductDoc[] = [
  {
    _id: "product-1",
    _rev: "1-abc123",
    type: "product",
    name: "Product 1",
    code: "P001",
    price: createMoney(10.99, BASE_CURRENCY, 1),
    barcode: "123456789",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "product-2",
    _rev: "1-def456",
    type: "product",
    name: "Product 2",
    code: "P002",
    price: createMoney(24.99, BASE_CURRENCY, 1),
    barcode: "987654321",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "product-3",
    _rev: "1-ghi789",
    type: "product",
    name: "Product 3",
    code: "P003",
    price: createMoney(5.99, BASE_CURRENCY, 1),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function ProductManager() {
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMockData, setIsMockData] = useState<boolean>(false);

  // Fetch products from the database
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get the products database
        const db = await getProductsDB();

        // Check if the database is initialized
        if (!db) {
          console.error("Products database is not initialized");
          setError("Database not available. Using mock data.");
          setProducts(mockProducts);
          setIsMockData(true);
          return;
        }

        // Fetch all products
        const result = await db.allDocs({
          include_docs: true,
          startkey: "product:",
          endkey: "product:\ufff0",
        });

        // Map the results to our ProductDoc type
        const fetchedProducts = result.rows
          .map((row) => row.doc as ProductDoc)
          .filter((doc) => doc && doc.type === "product");

        if (fetchedProducts.length > 0) {
          setProducts(fetchedProducts);
        } else {
          // If no products found, use mock data
          console.log("No products found in database, using mock data");
          setProducts(mockProducts);
          setIsMockData(true);
        }
      } catch (err) {
        console.error("Error fetching products:", err);
        // Fallback to mock data on error
        setProducts(mockProducts);
        setIsMockData(true);

        const message = err instanceof Error ? err.message : String(err);
        setError(`Error fetching products: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleDelete = (id: string) => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Are you sure you want to delete this product?")
    ) {
      try {
        // Filter out the product with the given id
        setProducts(products.filter((product) => product._id !== id));
        console.log(`Product ${id} deleted.`);
      } catch (err) {
        console.error("Error deleting product:", err);
        const message = err instanceof Error ? err.message : String(err);
        setError(`Failed to delete product ${id}. Error: ${message}`);
      }
    }
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
      <Text size="xl" fw={700} mb="lg" ta="center">
        {isMockData ? "Your Products (Mock Data)" : "Your Products"}
      </Text>

      {products.length === 0 ? (
        <Text size="lg" ta="center" py="xl">
          No products found. Add some products to get started.
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
                <Table.Th>Barcode</Table.Th>
                <Table.Th>Actions</Table.Th>
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
                  <Table.Td>{product.barcode || "N/A"}</Table.Td>
                  <Table.Td>
                    <Button
                      color="red"
                      size="sm"
                      onClick={() => handleDelete(product._id!)}
                      disabled={!product._id}
                      style={{
                        transition: "all 0.2s ease",
                      }}
                    >
                      Delete
                    </Button>
                  </Table.Td>
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
                <Text size="md" mb="xs">
                  Code: {product.code}
                </Text>
                {product.barcode && (
                  <Text size="md" mb="xs">
                    Barcode: {product.barcode}
                  </Text>
                )}
                <Button
                  color="red"
                  size="md"
                  fullWidth
                  mt="md"
                  onClick={() => handleDelete(product._id!)}
                  disabled={!product._id}
                  style={{
                    transition: "all 0.2s ease",
                  }}
                >
                  Delete Product
                </Button>
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
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .mantine-Button-root:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>
    </>
  );
}
