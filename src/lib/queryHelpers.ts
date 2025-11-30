"use client";

/**
 * Helper function to add shopId filtering to PouchDB selectors
 * This ensures data isolation between shops in a multi-user environment
 */
export function addShopIdFilter<T extends Record<string, unknown>>(
  selector: T,
  shopId?: string
): T {
  if (!shopId) {
    // If no shopId, return selector as-is (for backward compatibility)
    // In production, you might want to throw an error or return empty results
    return selector;
  }

  return {
    ...selector,
    shopId: shopId,
  };
}

/**
 * Helper function to filter documents by shopId in memory
 * Use this when using allDocs() or other methods that don't support selector filtering
 */
export function filterByShopId<T extends { shopId?: string }>(
  docs: T[],
  shopId?: string
): T[] {
  if (!shopId) {
    // If no shopId, return empty array for safety
    return [];
  }

  return docs.filter((doc) => doc.shopId === shopId);
}


