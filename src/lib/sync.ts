import { getSalesDB } from "./databases";
import { SaleDoc } from "@/types";
import { formatMoney } from "@/types/money";

/**
 * Generates a URL-encoded sales report string for WhatsApp.
 * Fetches pending sales for the specified date range, looks up product details, and formats the report.
 * @param {Date} startDate - The start date for the report (inclusive)
 * @param {Date} endDate - The end date for the report (exclusive)
 * @returns {Promise<string>} A promise that resolves with the URL-encoded report string.
 * @throws {Error} If fetching sales or products fails.
 */
export async function generateDailyReport(
  startDate?: Date,
  endDate?: Date
): Promise<string> {
  if (typeof window === "undefined") {
    return encodeURIComponent("[REPORT] Not available during server rendering");
  }

  // Default to today if no dates provided
  const reportStartDate = startDate || new Date();
  reportStartDate.setHours(0, 0, 0, 0);

  const reportEndDate = endDate || new Date(reportStartDate);
  reportEndDate.setDate(reportEndDate.getDate() + 1); // Default to next day if no end date

  const startDateISO = reportStartDate.toISOString();
  const endDateISO = reportEndDate.toISOString();

  console.log(
    `Generating report for sales from ${startDateISO} to ${endDateISO}...`
  );

  try {
    // Initialize salesDB before using it
    const db = await getSalesDB();

    // Get all documents
    const result = await db.allDocs({
      include_docs: true,
    });

    // Filter for pending sales documents within the selected date range
    const pendingSales = result.rows
      .map((row) => row.doc as unknown)
      .filter(
        (doc): doc is { type: string; timestamp: string; status: string } => {
          return (
            doc !== null &&
            typeof doc === "object" &&
            "type" in doc &&
            doc.type === "sale" &&
            "timestamp" in doc &&
            typeof doc.timestamp === "string" &&
            "status" in doc &&
            doc.status === "pending"
          );
        }
      )
      .filter((doc) => {
        // Check if it's within the date range
        const docDate = new Date(doc.timestamp);
        return (
          docDate >= new Date(startDateISO) && docDate < new Date(endDateISO)
        );
      })
      .map((doc) => doc as unknown as SaleDoc);

    if (pendingSales.length === 0) {
      console.log(`No pending sales found for the selected date range.`);
      return encodeURIComponent(
        "[REPORT] No pending sales for the selected date range."
      );
    }

    console.log(`Found ${pendingSales.length} pending sales.`);

    // Construct the report string
    // TODO: Get Shop Name from config/settings
    const shopName = "RUIRU"; // Placeholder
    const startDateFormatted = reportStartDate.toISOString().split("T")[0];
    const endDateFormatted = new Date(endDateISO).toISOString().split("T")[0];

    // Format the date range for the report
    const dateRangeText =
      startDateFormatted === endDateFormatted
        ? startDateFormatted
        : `${startDateFormatted} to ${endDateFormatted}`;

    let report = `[REPORT] SHOP: ${shopName} | DATE: ${dateRangeText}\n`;
    let totalSalesValue = 0;

    // Process each sale
    for (const sale of pendingSales) {
      // Add sale header
      report += `\n--- SALE ${formatDate(sale.timestamp)} ---\n`;

      // Add each item in the sale
      if (sale.items && Array.isArray(sale.items)) {
        for (const item of sale.items) {
          report += `${item.productCode} - ${item.productName} x${
            item.qty
          } @${formatMoney(item.price)} = ${formatMoney(item.total)}\n`;
        }
      }

      // Add sale total
      report += `SUBTOTAL: ${formatMoney(sale.totalAmount)}\n`;

      // Add payment details if available
      if (sale.cashReceived) {
        report += `PAID: ${formatMoney(sale.cashReceived)}\n`;
      }

      if (sale.change) {
        report += `CHANGE: ${formatMoney(sale.change)}\n`;
      }

      // Add to total sales value
      totalSalesValue += sale.totalAmount.amount;
    }

    // Add grand total
    report += `\nTOTAL SALES: ${formatMoney({
      amount: totalSalesValue,
      currency: "USD",
      exchangeRate: 1,
    })}`;

    console.log("Generated Report:", report);
    return encodeURIComponent(report);
  } catch (error: unknown) {
    console.error("Error generating daily report:", error);
    const message = error instanceof Error ? error.message : String(error);
    // Re-throw or handle appropriately
    throw new Error(`Failed to generate report: ${message}`);
  }
}

/**
 * Helper function to format a date string to a readable time
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Opens the WhatsApp application with a pre-filled message containing the report.
 * @param {string} encodedReport - The URL-encoded report string generated by generateDailyReport.
 * @param {string} [phoneNumber='254718250097'] - The target WhatsApp phone number (including country code).
 */
export function initiateWhatsAppSync(
  encodedReport: string,
  phoneNumber: string = "254718250097"
): void {
  // TODO: Get phone number from config/settings
  if (!phoneNumber) {
    console.error("WhatsApp phone number is not configured.");
    if (typeof window !== "undefined") {
      alert("WhatsApp phone number is not set up."); // User feedback
    }
    return;
  }
  const url = `https://wa.me/${phoneNumber}?text=${encodedReport}`;
  console.log("Opening WhatsApp URL:", url);

  // Only proceed if running in browser environment
  if (typeof window !== "undefined") {
    // Use window.open for PWAs, especially on mobile
    const newWindow = window.open(url, "_blank", "noopener noreferrer");

    if (
      !newWindow ||
      newWindow.closed ||
      typeof newWindow.closed === "undefined"
    ) {
      // This might happen due to popup blockers
      console.warn(
        "Could not open WhatsApp window. Popup blocker might be active."
      );
      alert(
        "Could not open WhatsApp. Please check your popup blocker settings."
      ); // User feedback
    }
  }
}

/**
 * Marks sales documents as 'synced' in the database.
 * @param {string[]} saleIds - An array of sale document IDs (_id) to update.
 * @returns {Promise<void>} A promise that resolves when updates are complete.
 * @throws {Error} If fetching or updating sales fails.
 */
export async function markSalesAsSynced(saleIds: string[]): Promise<void> {
  if (saleIds.length === 0) {
    console.log("No sale IDs provided to mark as synced.");
    return;
  }
  console.log(`Marking ${saleIds.length} sales as synced:`, saleIds);

  try {
    // Initialize salesDB before using it
    const db = await getSalesDB();

    // Fetch the current revisions of the documents
    const docsToUpdate = await db.bulkGet({
      docs: saleIds.map((id) => ({ id })),
    });

    const updatedDocs: Array<PouchDB.Core.PutDocument<SaleDoc>> = [];
    const errors: { id: string; error: unknown }[] = [];

    docsToUpdate.results.forEach((result) => {
      const docResult = result.docs[0];
      if (docResult && "ok" in docResult && docResult.ok) {
        const doc = docResult.ok as unknown as SaleDoc;
        if (doc.status !== "synced") {
          updatedDocs.push({
            ...doc,
            status: "synced",
            _id: doc._id,
            _rev: doc._rev,
          });
        }
      } else if (docResult && "error" in docResult) {
        errors.push({ id: result.id, error: docResult.error });
        console.error(
          `Error fetching sale doc ${result.id} for update:`,
          docResult.error
        );
      } else {
        console.error(
          `Unexpected result format for sale doc ${result.id}:`,
          docResult
        );
        errors.push({ id: result.id, error: "Unexpected result format" });
      }
    });

    if (errors.length > 0) {
      // Handle fetch errors - maybe retry or log permanently
      console.error(
        "Errors occurred while fetching some sales documents for syncing."
      );
      // Optionally throw an error or return partial success info
    }

    if (updatedDocs.length > 0) {
      console.log(
        `Updating ${updatedDocs.length} documents to 'synced' status.`
      );
      const bulkResult = await db.bulkDocs(updatedDocs);
      console.log("Bulk update result:", bulkResult);

      // Check for conflicts or errors during the bulk update using type guard
      const updateErrors = bulkResult.filter(
        (res): res is PouchDB.Core.Error => !("ok" in res && res.ok)
      );
      if (updateErrors.length > 0) {
        console.error("Errors occurred during bulk update:", updateErrors);
        // Handle update errors (e.g., conflicts) - potentially retry or log
        throw new Error(
          `Failed to mark some sales as synced. Errors: ${JSON.stringify(
            updateErrors
          )}`
        );
      }
      console.log(`${updatedDocs.length} sales successfully marked as synced.`);
    } else {
      console.log("No documents needed updating to 'synced' status.");
    }
  } catch (error: unknown) {
    console.error("Error marking sales as synced:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to mark sales as synced: ${message}`);
  }
}
