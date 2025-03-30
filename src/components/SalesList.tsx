"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  Badge,
  Loader,
  Alert,
  Stack,
  Button,
  Text,
  Box,
} from "@mantine/core";
import { IconAlertCircle, IconPlus } from "@tabler/icons-react";
import { getSalesDB, getProductsDB } from "@/lib/databases";
import { SaleDoc, ProductDoc } from "@/types";
import { useRouter } from "next/navigation";

export default function SalesList() {
  const router = useRouter();
  const [sales, setSales] = useState<SaleDoc[]>([]);
  const [products, setProducts] = useState<Map<string, ProductDoc>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cleanup: (() => void) | undefined;

    const init = async () => {
      const fetchSales = async () => {
        setLoading(true);
        setError(null);
        try {
          // Get today's sales
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayISOString = today.toISOString();

          const salesDB = await getSalesDB();
          const result = await salesDB.find({
            selector: {
              type: "sale",
              timestamp: { $gte: todayISOString },
            },
            sort: [{ timestamp: "desc" }],
          });

          // Get all product IDs from sales
          const salesDocs = result.docs as SaleDoc[];
          const productIds = [
            ...new Set(salesDocs.map((sale) => sale.productId)),
          ];

          // Fetch products
          if (productIds.length > 0) {
            const productsDB = await getProductsDB();
            const productResult = await productsDB.allDocs({
              keys: productIds,
              include_docs: true,
            });

            const productMap = new Map<string, ProductDoc>();
            productResult.rows.forEach((row) => {
              if (row && "doc" in row && row.doc && "id" in row) {
                productMap.set(row.id, row.doc as ProductDoc);
              }
            });

            setProducts(productMap);
          }

          setSales(result.docs as SaleDoc[]);
        } catch (err) {
          console.error("Error fetching sales:", err);
          const message = err instanceof Error ? err.message : String(err);
          setError(`Failed to load sales: ${message}`);
        } finally {
          setLoading(false);
        }
      };

      await fetchSales();

      // Set up change listener for real-time updates
      const salesDB = await getSalesDB();
      const changes = salesDB
        .changes({
          since: "now",
          live: true,
          include_docs: true,
        })
        .on("change", (change) => {
          const doc = change.doc as unknown;
          if (
            doc &&
            typeof doc === "object" &&
            "type" in doc &&
            doc.type === "sale"
          ) {
            fetchSales();
          }
        });

      cleanup = () => {
        changes.cancel();
      };
    };

    init();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getProductName = (productId: string) => {
    const product = products.get(productId);
    return product ? product.name : "Unknown Product";
  };

  if (loading) {
    return (
      <Box
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "2rem",
          animation: "pulse 1.5s infinite ease-in-out",
        }}
      >
        <Loader className="tabler-icon icon-spin" />
      </Box>
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
        style={{
          animation: "fadeIn 0.3s ease-out",
        }}
      >
        {error}
      </Alert>
    );
  }

  return (
    <>
      {sales.length === 0 ? (
        <Stack
          align="center"
          py="xl"
          style={{
            animation: "fadeIn 0.5s ease-out",
          }}
        >
          <Text c="dimmed">No sales recorded today</Text>
          <Button
            variant="light"
            onClick={() => router.push("/sales/new")}
            leftSection={
              <IconPlus size={16} className="tabler-icon icon-bounce" />
            }
            style={{
              transition: "all 0.2s ease",
            }}
            className="animated-button"
          >
            Record a Sale
          </Button>
        </Stack>
      ) : (
        <div style={{ animation: "fadeIn 0.5s ease-out" }}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Time</Table.Th>
                <Table.Th>Product</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Price</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sales.map((sale, index) => (
                <Table.Tr
                  key={sale._id}
                  style={{
                    animation: `slideInFromRight 0.3s ease forwards ${
                      index * 0.05
                    }s`,
                    opacity: 0,
                    transform: "translateX(20px)",
                  }}
                  className="animated-row"
                >
                  <Table.Td>{formatDate(sale.timestamp)}</Table.Td>
                  <Table.Td>{getProductName(sale.productId)}</Table.Td>
                  <Table.Td>{sale.qty}</Table.Td>
                  <Table.Td>{sale.price}</Table.Td>
                  <Table.Td>{sale.total}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={sale.status === "synced" ? "green" : "blue"}
                      style={{
                        transition: "all 0.2s ease",
                      }}
                      className="animated-badge"
                    >
                      {sale.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
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

        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse {
          0% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.6;
          }
        }

        .animated-row {
          transition: all 0.2s ease;
        }

        .animated-row:hover {
          background-color: rgba(0, 0, 0, 0.03);
          transform: translateX(5px);
        }

        .animated-badge {
          transition: all 0.2s ease;
        }

        .animated-badge:hover {
          transform: scale(1.1);
        }

        .animated-button {
          transition: all 0.2s ease;
        }

        .animated-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .animated-button:active {
          transform: translateY(0);
        }
      `}</style>
    </>
  );
}
