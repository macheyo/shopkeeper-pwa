import { getProductsDB } from "./databases";
import { ProductDoc } from "@/types";
import { createMoney } from "@/types/money";

export interface ParsedTransaction {
  type: "sale" | "purchase";
  productName: string;
  quantity: number;
  matchedProduct?: ProductDoc;
}

/**
 * Parse speech input to extract transaction details
 * Examples:
 * - "sold 2 bags of rice"
 * - "purchased 5 cartons of milk"
 * - "buy 10 boxes of soap"
 * - "sell 3 bottles of water"
 */
export async function parseSpeechToTransaction(
  speech: string
): Promise<ParsedTransaction | null> {
  // Convert to lowercase for easier matching
  const text = speech.toLowerCase().trim();

  // Determine transaction type
  let type: "sale" | "purchase" | null = null;

  if (text.includes("sold") || text.includes("sell") || text.includes("sale")) {
    type = "sale";
  } else if (
    text.includes("purchased") ||
    text.includes("purchase") ||
    text.includes("buy") ||
    text.includes("bought")
  ) {
    type = "purchase";
  }

  if (!type) {
    console.error("Could not determine transaction type from speech:", text);
    return null;
  }

  // Extract quantity
  const quantityMatch = text.match(/\b(\d+)\b/);
  const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;

  // Extract product name - this is more complex
  // We'll look for common patterns and then try to match with existing products
  let productName = "";

  // Common patterns:
  // - "X of Y" (e.g., "bags of rice")
  // - "X Y" (e.g., "soap bars")

  // Try to extract product name after quantity and optional "of"
  const ofMatch = text.match(/\b\d+\s+(?:\w+\s+of\s+)?(.+)$/);
  if (ofMatch) {
    productName = ofMatch[1].trim();

    // Clean up the product name by removing transaction type words
    productName = productName
      .replace(/\b(sold|sell|sale|purchased|purchase|buy|bought)\b/g, "")
      .trim();
  }

  if (!productName) {
    console.error("Could not extract product name from speech:", text);
    return null;
  }

  // Try to match with existing products
  const matchedProduct = await findMatchingProduct(productName);

  return {
    type,
    productName,
    quantity,
    matchedProduct,
  };
}

/**
 * Find a product that matches the spoken product name
 */
async function findMatchingProduct(
  spokenName: string
): Promise<ProductDoc | undefined> {
  try {
    const productsDB = await getProductsDB();
    const result = await productsDB.find({
      selector: {
        type: "product",
      },
    });

    const products = result.docs as ProductDoc[];

    // First try exact match
    let match = products.find(
      (p) => p.name.toLowerCase() === spokenName.toLowerCase()
    );

    // If no exact match, try to find a product where the spoken name is a substring
    if (!match) {
      match = products.find((p) =>
        p.name.toLowerCase().includes(spokenName.toLowerCase())
      );
    }

    // If still no match, try to find a product where the spoken name contains the product name
    if (!match) {
      match = products.find((p) =>
        spokenName.toLowerCase().includes(p.name.toLowerCase())
      );
    }

    return match;
  } catch (error) {
    console.error("Error finding matching product:", error);
    return undefined;
  }
}

/**
 * Create a default product from speech if no match is found
 */
export function createDefaultProduct(
  productName: string,
  isSale: boolean = true
): ProductDoc {
  const now = new Date();
  const productId = `product_${now.getTime()}`;

  return {
    _id: productId,
    type: "product",
    code: productId.substring(0, 8),
    name: productName,
    description: `Auto-created from speech recognition`,
    price: createMoney(0), // Default price, will need to be set
    costPrice: createMoney(0), // Default cost, will need to be set
    stockQuantity: isSale ? 0 : 1, // For sales, assume we have none (will need to be set)
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
