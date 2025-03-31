"use client";

import React, { useState } from "react";
import {
  Title,
  Group,
  Text,
  Paper,
  Box,
  Alert,
  Stack,
  Divider,
  Card,
  Badge,
  Textarea,
  Button,
} from "@mantine/core";
import {
  IconSend,
  IconRefresh,
  IconAlertCircle,
  IconCheck,
  IconBrandWhatsapp, // Changed from IconWhatsapp to IconBrandWhatsapp
} from "@tabler/icons-react";
import CollapsibleFab from "@/components/CollapsibleFab";
// Removed unused useRouter import
import {
  generateDailyReport,
  initiateWhatsAppSync,
  markSalesAsSynced,
} from "@/lib/sync";
import { salesDB } from "@/lib/databases";
import { SaleDoc } from "@/types";

export default function ReportsPage() {
  // Removed unused router
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [pendingSales, setPendingSales] = useState<SaleDoc[]>([]);
  const phoneNumber = "254712345678"; // Default phone number, removed unused setter

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setReport(null);

    try {
      if (typeof window === "undefined") {
        throw new Error("Reports can only be generated in the browser");
      }
      // Get pending sales
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISOString = today.toISOString();

      const result = await salesDB.find({
        selector: {
          type: "sale",
          status: "pending",
          timestamp: { $gte: todayISOString },
        },
      });

      const sales = result.docs as SaleDoc[];
      setPendingSales(sales);

      if (sales.length === 0) {
        setSuccess("No pending sales to report.");
        setLoading(false);
        return;
      }

      // Generate report
      const encodedReport = await generateDailyReport();
      // Decode for display
      const decodedReport = decodeURIComponent(encodedReport);
      setReport(decodedReport);
      setSuccess(`Report generated with ${sales.length} sales.`);
    } catch (err) {
      console.error("Error generating report:", err);
      setError(
        `Failed to generate report: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (typeof window === "undefined" || !report) {
      setError("Please generate a report first");
      return;
    }

    try {
      // Get the encoded report again
      const encodedReport = await generateDailyReport();

      // Send via WhatsApp
      initiateWhatsAppSync(encodedReport, phoneNumber);

      // Mark sales as synced
      if (pendingSales.length > 0) {
        const saleIds = pendingSales.map((sale) => sale._id);
        await markSalesAsSynced(saleIds);
        setSuccess("Report sent to WhatsApp and sales marked as synced!");
        // Clear the report after sending
        setReport(null);
        setPendingSales([]);
      }
    } catch (err) {
      console.error("Error sending report:", err);
      setError(
        `Failed to send report: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  return (
    <>
      <Box mb="xl">
        <Group justify="space-between" align="center">
          <Title order={2}>Reports</Title>
          <CollapsibleFab
            icon={<IconRefresh size={16} />}
            text="Generate Report"
            onClick={handleGenerateReport}
            color="violet"
          />
        </Group>
        <Text c="dimmed" mt="xs">
          Generate and send daily sales reports via WhatsApp
        </Text>
      </Box>

      {error && (
        <Alert
          icon={<IconAlertCircle size="1rem" />}
          title="Error"
          color="red"
          mb="md"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          icon={<IconCheck size="1rem" />}
          title="Success"
          color="green"
          mb="md"
          withCloseButton
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      <Paper shadow="xs" p="md" withBorder>
        <Stack gap="md">
          <Group>
            <Text fw={500}>Pending Sales:</Text>
            <Badge color="violet" size="lg">
              {pendingSales.length}
            </Badge>
          </Group>

          <Divider />

          {report ? (
            <>
              <Card withBorder p="md">
                <Text fw={500} mb="sm">
                  Report Preview:
                </Text>
                <Textarea
                  value={report}
                  readOnly
                  minRows={5}
                  maxRows={10}
                  style={{ fontFamily: "monospace" }}
                />
              </Card>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Send this report via WhatsApp to sync your sales
                </Text>
                <Button
                  color="green"
                  leftSection={<IconBrandWhatsapp size={16} />}
                  onClick={handleSendWhatsApp}
                  disabled={!report}
                >
                  Send via WhatsApp
                </Button>
              </Group>
            </>
          ) : (
            <Stack align="center" py="xl">
              <IconSend size={48} opacity={0.3} />
              <Text c="dimmed" ta="center">
                Generate a report to see pending sales
              </Text>
              <Button
                variant="light"
                onClick={handleGenerateReport}
                loading={loading}
                color="violet"
              >
                Generate Now
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
    </>
  );
}
