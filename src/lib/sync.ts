import { salesDB, productsDB } from "./databases";
import { SaleDoc, ProductDoc } from "@/types";
import { Money, formatMoney } from "@/types/money";

/**
 * Generates a URL-encoded daily sales report string for WhatsApp.
 * Fetches pending sales for today, looks up product details, and formats the report.
 * @returns {Promise<string>} A promise that resolves with the URL-encoded report string.
 * @throws {Error} If fetching sales or products fails.
 */
export async function generateDailyReport(): Promise<string> {
  if (typeof window === "undefined") {
    return encodeURIComponent("[REPORT] Not available during server rendering");
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartISO = todayStart.toISOString();

  console.log(`Generating report for sales from ${todayStartISO}...`);

  try {
    // Find sales that are 'pending' and occurred today or later
    // Remove generic from find, assert type later
    const findResult = await salesDB.find({
      selector: {
        status: "pending",
        timestamp: { $gte: todayStartISO },
      },
      // Ensure the index on ['status', 'timestamp'] exists
    });
    // Assert the type of docs
    const pendingSales = findResult.docs as SaleDoc[];

    if (pendingSales.length === 0) {
      console.log("No pending sales found for today.");
      return encodeURIComponent("[REPORT] No pending sales today.");
    }

    console.log(`Found ${pendingSales.length} pending sales.`);

    // Extract unique product IDs to fetch product details efficiently
    // Explicitly type 'sale' parameter
    const productIds = [
      ...new Set(pendingSales.map((sale: SaleDoc) => sale.productId)),
    ];

    // Fetch corresponding product documents using correct options type
    const productResult = await productsDB.allDocs<ProductDoc>({
      keys: productIds, // Now productIds should be string[]
      include_docs: true,
    });
    const productRows = productResult.rows;

    // Create a map for quick product lookup
    const productMap = new Map<string, ProductDoc>();
    productRows.forEach((row) => {
      // Check if the row is not an error and has a doc
      if (row && "doc" in row && row.doc && "id" in row && row.id) {
        productMap.set(row.id, row.doc);
      } else if (row && "error" in row) {
        console.warn(`Error fetching product for key ${row.key}: ${row.error}`);
      }
    });

    // Construct the report string
    // TODO: Get Shop Name from config/settings
    const shopName = "RUIRU"; // Placeholder
    const reportDate = todayStartISO.split("T")[0];
    let report = `[REPORT] SHOP: ${shopName} | DATE: ${reportDate}\n`;
    let totalSalesValue = 0;
    // Aggregate sales by product for a summary view
    const aggregatedSales: {
      [productId: string]: {
        qty: number;
        total: Money;
        code: string;
        price: Money;
      };
    } = {};

    for (const sale of pendingSales) {
      const product = productMap.get(sale.productId);
      if (product) {
        if (!aggregatedSales[sale.productId]) {
          aggregatedSales[sale.productId] = {
            qty: 0,
            total: {
              amount: 0,
              currency: sale.total.currency,
              exchangeRate: sale.total.exchangeRate,
            },
            code: product.code,
            price: product.price,
          };
        }
        aggregatedSales[sale.productId].qty += sale.qty;
        aggregatedSales[sale.productId].total.amount += sale.total.amount;
        totalSalesValue += sale.total.amount;
      } else {
        console.warn(
          `Product details not found for productId: ${sale.productId} in sale ${sale._id}`
        );
        // Optionally include a line in the report indicating missing product data
        report += `UNKNOWN_PRODUCT (ID: ${sale.productId}) x${
          sale.qty
        } = ${formatMoney(sale.total)}\n`;
        totalSalesValue += sale.total.amount;
      }
    }

    // Add aggregated sales to the report
    for (const productId in aggregatedSales) {
      const saleSummary = aggregatedSales[productId];
      report += `${saleSummary.code} x${saleSummary.qty} @${formatMoney(
        saleSummary.price
      )} = ${formatMoney(saleSummary.total)}\n`;
    }

    // TODO: Add Cash Received / Change summary if needed, requires fetching more sale details or storing it differently
    report += `TOTAL: ${formatMoney({
      amount: totalSalesValue,
      currency: "THC",
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
 * Opens the WhatsApp application with a pre-filled message containing the report.
 * @param {string} encodedReport - The URL-encoded report string generated by generateDailyReport.
 * @param {string} [phoneNumber='254712345678'] - The target WhatsApp phone number (including country code).
 */
export function initiateWhatsAppSync(
  encodedReport: string,
  phoneNumber: string = "254712345678"
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
    // Fetch the current revisions of the documents
    const docsToUpdate = await salesDB.bulkGet({
      docs: saleIds.map((id) => ({ id })),
    });

    const updatedDocs: SaleDoc[] = [];
    const errors: { id: string; error: unknown }[] = []; // Use unknown

    docsToUpdate.results.forEach((result) => {
      // bulkGet returns results for each doc ID provided
      const docResult = result.docs[0]; // Access the actual doc or error info
      if (docResult && "ok" in docResult && docResult.ok) {
        // Successfully fetched doc
        const doc = docResult.ok as SaleDoc;
        if (doc.status !== "synced") {
          updatedDocs.push({
            ...doc,
            status: "synced",
          });
        }
      } else if (docResult && "error" in docResult) {
        // Error fetching doc
        errors.push({ id: result.id, error: docResult.error });
        console.error(
          `Error fetching sale doc ${result.id} for update:`,
          docResult.error
        );
      } else {
        // Unexpected result format
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
      const bulkResult = await salesDB.bulkDocs(updatedDocs);
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
