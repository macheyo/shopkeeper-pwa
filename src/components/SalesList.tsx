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
  Accordion,
} from "@mantine/core";
import { IconAlertCircle, IconPlus } from "@tabler/icons-react";
import { getSalesDB } from "@/lib/databases";
import { SaleDoc, SaleItem } from "@/types";
import { formatMoney } from "@/types/money";
import { useRouter } from "next/navigation";

export default function SalesList() {
  const router = useRouter();
  const [sales, setSales] = useState<SaleDoc[]>([]);
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

          // Get all documents
          const result = await salesDB.allDocs({
            include_docs: true,
          });

          // Filter for sales documents and today's sales
          const todayDate = new Date(todayISOString);
          const filteredDocs = result.rows
            .map((row) => row.doc)
            .filter((doc): doc is SaleDoc => {
              // Make sure it's a sale document with a timestamp
              if (
                !doc ||
                typeof doc !== "object" ||
                !("type" in doc) ||
                doc.type !== "sale" ||
                !("timestamp" in doc)
              ) {
                return false;
              }

              // Check if it's from today or later
              const docDate = new Date(doc.timestamp as string);
              return docDate >= todayDate;
            })
            // Sort by timestamp in descending order
            .sort(
              (a, b) =>
                new Date(b.timestamp as string).getTime() -
                new Date(a.timestamp as string).getTime()
            );

          setSales(filteredDocs);
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
          <Accordion>
            {sales.map((sale, index) => (
              <Accordion.Item
                key={sale._id}
                value={sale._id}
                style={{
                  animation: `slideInFromRight 0.3s ease forwards ${
                    index * 0.05
                  }s`,
                  opacity: 0,
                  transform: "translateX(20px)",
                }}
                className="animated-row"
              >
                <Accordion.Control>
                  <Box>
                    <Text fw={700}>Sale at {formatDate(sale.timestamp)}</Text>
                    <Text size="sm">
                      Total: {formatMoney(sale.totalAmount)} | Status:{" "}
                      <Badge
                        color={sale.status === "synced" ? "green" : "blue"}
                        style={{
                          transition: "all 0.2s ease",
                        }}
                        className="animated-badge"
                      >
                        {sale.status}
                      </Badge>
                    </Text>
                  </Box>
                </Accordion.Control>
                <Accordion.Panel>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Product</Table.Th>
                        <Table.Th>Quantity</Table.Th>
                        <Table.Th>Price</Table.Th>
                        <Table.Th>Total</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sale.items &&
                        sale.items.map((item: SaleItem) => (
                          <Table.Tr key={`${sale._id}_${item.productId}`}>
                            <Table.Td>{item.productName}</Table.Td>
                            <Table.Td>{item.qty}</Table.Td>
                            <Table.Td>{formatMoney(item.price)}</Table.Td>
                            <Table.Td>{formatMoney(item.total)}</Table.Td>
                          </Table.Tr>
                        ))}
                    </Table.Tbody>
                    <Table.Tfoot>
                      <Table.Tr>
                        <Table.Th colSpan={3} style={{ textAlign: "right" }}>
                          Total Amount:
                        </Table.Th>
                        <Table.Th>{formatMoney(sale.totalAmount)}</Table.Th>
                      </Table.Tr>
                      {sale.cashReceived && (
                        <Table.Tr>
                          <Table.Th colSpan={3} style={{ textAlign: "right" }}>
                            Cash Received:
                          </Table.Th>
                          <Table.Th>{formatMoney(sale.cashReceived)}</Table.Th>
                        </Table.Tr>
                      )}
                      {sale.change && (
                        <Table.Tr>
                          <Table.Th colSpan={3} style={{ textAlign: "right" }}>
                            Change:
                          </Table.Th>
                          <Table.Th>{formatMoney(sale.change)}</Table.Th>
                        </Table.Tr>
                      )}
                    </Table.Tfoot>
                  </Table>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
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
