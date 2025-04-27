"use client";

import React, { useState, useEffect } from "react";
import {
  Badge,
  Loader,
  Alert,
  Stack,
  Button,
  Text,
  Box,
  Accordion,
  Paper,
  Group,
} from "@mantine/core";
import { IconAlertCircle, IconPlus } from "@tabler/icons-react";
import { getSalesDB } from "@/lib/databases";
import { SaleDoc, SaleItem } from "@/types";
import { formatMoney } from "@/types/money";
import { useRouter } from "next/navigation";
import { useDateFilter } from "@/contexts/DateFilterContext";

export default function SalesList() {
  const router = useRouter();
  const { dateRangeInfo } = useDateFilter();
  const [sales, setSales] = useState<SaleDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      console.log("Not running in browser environment");
      return;
    }

    // Check if we have valid date range info
    if (!dateRangeInfo?.startDate || !dateRangeInfo?.endDate) {
      console.log("Date range not available yet:", dateRangeInfo);
      return;
    }

    console.log("Starting sales fetch with date range:", {
      start: dateRangeInfo.startDate.toISOString(),
      end: dateRangeInfo.endDate.toISOString(),
      label: dateRangeInfo.label,
    });

    let cleanup: (() => void) | undefined;

    const init = async () => {
      const fetchSales = async () => {
        setLoading(true);
        setError(null);
        try {
          console.log("Initializing database...");
          // Initialize the database first
          const salesDB = await getSalesDB().catch((err) => {
            console.error("Database initialization failed:", err);
            throw new Error(
              `Failed to initialize sales database: ${err.message}`
            );
          });
          console.log("Database initialized successfully");

          // Get the date range from context
          const startDateISOString = dateRangeInfo.startDate.toISOString();
          const endDateISOString = dateRangeInfo.endDate.toISOString();

          console.log("Fetching documents...");
          // Get all documents with error handling
          const result = await salesDB.allDocs({
            include_docs: true,
          });

          // Filter for sales documents within the selected date range
          const filteredDocs = result.rows
            .map((row) => row.doc as unknown)
            .filter((doc): doc is { type: string; timestamp: string } => {
              return (
                doc !== null &&
                typeof doc === "object" &&
                "type" in doc &&
                doc.type === "sale" &&
                "timestamp" in doc &&
                typeof doc.timestamp === "string"
              );
            })
            .filter((doc) => {
              // Check if it's within the date range
              const docDate = new Date(doc.timestamp);
              return (
                docDate >= new Date(startDateISOString) &&
                docDate < new Date(endDateISOString)
              );
            })
            .map((doc) => doc as unknown as SaleDoc)
            // Sort by timestamp in descending order
            .sort(
              (a, b) =>
                new Date(b.timestamp as string).getTime() -
                new Date(a.timestamp as string).getTime()
            );

          console.log("Filtered sales:", filteredDocs);
          setSales(filteredDocs);
        } catch (err) {
          console.error("Error fetching sales:", err);
          const message = err instanceof Error ? err.message : String(err);
          setError(`Failed to load sales: ${message}`);
          setSales([]); // Reset sales on error
        } finally {
          // Ensure loading state is reset even if there's an error
          setTimeout(() => {
            console.log("Resetting loading state");
            setLoading(false);
          }, 0);
        }
      };

      // Initial fetch
      await fetchSales().catch((err) => {
        console.error("Initial fetch failed:", err);
        setError(`Initial data load failed: ${err.message}`);
      });

      // Only set up changes listener if initial fetch was successful
      if (!error)
        try {
          // Set up change listener for real-time updates
          const salesDB = await getSalesDB().catch((err) => {
            throw new Error(
              `Failed to initialize sales database for changes: ${err.message}`
            );
          });

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
                fetchSales().catch((err) => {
                  console.error("Error fetching sales after change:", err);
                  setError(`Failed to refresh sales: ${err.message}`);
                });
              }
            })
            .on("error", (err) => {
              console.error("Changes feed error:", err);
              setError(`Real-time updates error: ${err.message}`);
            });

          cleanup = () => {
            changes.cancel();
          };
        } catch (err) {
          console.error("Error setting up changes listener:", err);
          const message = err instanceof Error ? err.message : String(err);
          setError(`Failed to set up real-time updates: ${message}`);
        }
    };

    init();

    return () => {
      if (cleanup) cleanup();
    };
  }, [dateRangeInfo]); // Re-fetch when date range changes

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
          <Text c="dimmed">
            No sales found for {dateRangeInfo.label.toLowerCase()}
          </Text>
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
                    <Group gap="xs">
                      <Text size="sm">
                        Total: {formatMoney(sale.totalAmount)}
                      </Text>
                      <Text size="sm" c="green">
                        Profit: {formatMoney(sale.profit)}
                      </Text>
                      <Badge
                        color={sale.status === "synced" ? "green" : "blue"}
                        style={{
                          transition: "all 0.2s ease",
                        }}
                        className="animated-badge"
                      >
                        {sale.status}
                      </Badge>
                    </Group>
                  </Box>
                </Accordion.Control>
                <Accordion.Panel>
                  {/* Mobile-friendly layout for sale items */}
                  <Box className="sale-items-container">
                    {/* Sale items */}
                    {sale.items &&
                      sale.items.map((item: SaleItem) => (
                        <Paper
                          key={`${sale._id}_${item.productId}`}
                          p="xs"
                          mb="xs"
                          withBorder
                          className="sale-item-card"
                        >
                          <Text fw={600} size="sm" mb={5}>
                            {item.productName}
                          </Text>
                          <Box className="sale-item-details">
                            <Text size="xs" c="dimmed">
                              Qty: {item.qty}
                            </Text>
                            <Text size="xs" c="dimmed">
                              Price: {formatMoney(item.price)}
                            </Text>
                            <Text size="sm" fw={500}>
                              Total: {formatMoney(item.total)}
                            </Text>
                          </Box>
                        </Paper>
                      ))}

                    {/* Sale summary */}
                    <Paper p="sm" withBorder mt="md" className="sale-summary">
                      <Stack gap="xs">
                        <Group justify="apart">
                          <Text fw={600}>Total Amount:</Text>
                          <Text fw={700}>{formatMoney(sale.totalAmount)}</Text>
                        </Group>

                        <Group justify="apart">
                          <Text>Cost of Goods:</Text>
                          <Text>{formatMoney(sale.totalCost)}</Text>
                        </Group>

                        <Group justify="apart">
                          <Text fw={600}>Profit:</Text>
                          <Text fw={700} c="green">
                            {formatMoney(sale.profit)}
                          </Text>
                        </Group>

                        {sale.cashReceived && (
                          <Group justify="apart">
                            <Text>Cash Received:</Text>
                            <Text>{formatMoney(sale.cashReceived)}</Text>
                          </Group>
                        )}

                        {sale.change && (
                          <Group justify="apart">
                            <Text>Change:</Text>
                            <Text>{formatMoney(sale.change)}</Text>
                          </Group>
                        )}
                      </Stack>
                    </Paper>
                  </Box>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </div>
      )}

      {/* Add CSS animations and mobile styles */}
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
          background-color: var(--mantine-color-default-hover);
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
          box-shadow: var(--mantine-shadow-sm);
        }

        .animated-button:active {
          transform: translateY(0);
        }

        /* Mobile-friendly styles */
        .sale-items-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 100%;
          overflow-x: hidden;
        }

        .sale-item-card {
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .sale-item-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--mantine-shadow-xs);
        }

        .sale-item-details {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: space-between;
          align-items: center;
          margin-top: 4px;
        }

        .sale-summary {
          border-radius: 8px;
          background-color: var(--mantine-color-default-hover);
        }

        /* Responsive adjustments */
        @media (max-width: 600px) {
          .sale-item-details {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .sale-item-details > *:last-child {
            align-self: flex-end;
            margin-top: 4px;
          }
        }
      `}</style>
    </>
  );
}
