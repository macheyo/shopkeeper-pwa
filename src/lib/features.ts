"use client";

/**
 * Feature Flags System
 * Defines all available features in the ShopKeeper application
 */

export type Feature =
  | "products_management"
  | "sales_management"
  | "purchases_management"
  | "inventory_tracking"
  | "accounting_ledger"
  | "financial_reports"
  | "cash_management"
  | "multi_currency"
  | "sales_targets"
  | "user_management"
  | "couchdb_sync"
  | "barcode_scanning"
  | "pwa_offline"
  | "biometric_auth"
  | "advanced_reports"
  | "api_access"
  | "custom_branding"
  | "priority_support";

/**
 * Feature metadata with descriptions
 */
export const FEATURE_METADATA: Record<
  Feature,
  { name: string; description: string; category: string }
> = {
  products_management: {
    name: "Products Management",
    description: "Add, edit, and manage products with barcode support",
    category: "Core",
  },
  sales_management: {
    name: "Sales Management",
    description: "Create sales transactions with multiple payment methods",
    category: "Core",
  },
  purchases_management: {
    name: "Purchases Management",
    description: "Create purchase runs and track supplier purchases",
    category: "Core",
  },
  inventory_tracking: {
    name: "Inventory Tracking",
    description: "FIFO inventory tracking with lot management",
    category: "Core",
  },
  accounting_ledger: {
    name: "Accounting & Ledger",
    description: "Double-entry accounting system with ledger entries",
    category: "Core",
  },
  financial_reports: {
    name: "Financial Reports",
    description: "Sales, purchase, and profit/loss reports",
    category: "Core",
  },
  cash_management: {
    name: "Cash Management",
    description: "Cash in hand tracking and reconciliation",
    category: "Core",
  },
  multi_currency: {
    name: "Multi-Currency Support",
    description: "Multiple currency support with exchange rates",
    category: "Core",
  },
  sales_targets: {
    name: "Sales Targets",
    description: "Daily, weekly, and monthly sales target tracking",
    category: "Core",
  },
  user_management: {
    name: "User Management",
    description: "Multi-user support with role-based access control",
    category: "Core",
  },
  couchdb_sync: {
    name: "Cloud Sync",
    description: "Offline-first architecture with CouchDB synchronization",
    category: "Core",
  },
  barcode_scanning: {
    name: "Barcode Scanning",
    description: "Camera-based barcode scanning for products",
    category: "Core",
  },
  pwa_offline: {
    name: "PWA & Offline",
    description: "Installable app with offline support",
    category: "Core",
  },
  biometric_auth: {
    name: "Biometric Authentication",
    description: "WebAuthn biometric authentication support",
    category: "Security",
  },
  advanced_reports: {
    name: "Advanced Reports",
    description: "Enhanced reporting with custom date ranges and filters",
    category: "Premium",
  },
  api_access: {
    name: "API Access",
    description: "REST API access for integrations",
    category: "Premium",
  },
  custom_branding: {
    name: "Custom Branding",
    description: "Customize app branding and appearance",
    category: "Premium",
  },
  priority_support: {
    name: "Priority Support",
    description: "Priority customer support and assistance",
    category: "Premium",
  },
};

/**
 * All core features (always available for owner role)
 */
export const CORE_FEATURES: Feature[] = [
  "products_management",
  "sales_management",
  "purchases_management",
  "inventory_tracking",
  "accounting_ledger",
  "financial_reports",
  "cash_management",
  "multi_currency",
  "sales_targets",
  "user_management",
  "couchdb_sync",
  "barcode_scanning",
  "pwa_offline",
  "biometric_auth",
];

/**
 * Premium features (optional, can be enabled/disabled)
 */
export const PREMIUM_FEATURES: Feature[] = [
  "advanced_reports",
  "api_access",
  "custom_branding",
  "priority_support",
];

/**
 * All available features
 */
export const ALL_FEATURES: Feature[] = [...CORE_FEATURES, ...PREMIUM_FEATURES];

/**
 * Default features for owner role (all core + premium)
 */
export const OWNER_DEFAULT_FEATURES: Feature[] = ALL_FEATURES;

/**
 * Default features for manager role (all core, no premium)
 */
export const MANAGER_DEFAULT_FEATURES: Feature[] = CORE_FEATURES;

/**
 * Default features for employee role (limited core features)
 */
export const EMPLOYEE_DEFAULT_FEATURES: Feature[] = [
  "products_management",
  "sales_management",
  "barcode_scanning",
  "pwa_offline",
];

/**
 * Get features for a role
 */
export function getDefaultFeaturesForRole(
  role: "owner" | "manager" | "employee"
): Feature[] {
  switch (role) {
    case "owner":
      return OWNER_DEFAULT_FEATURES;
    case "manager":
      return MANAGER_DEFAULT_FEATURES;
    case "employee":
      return EMPLOYEE_DEFAULT_FEATURES;
    default:
      return EMPLOYEE_DEFAULT_FEATURES;
  }
}

/**
 * Format feature name for display
 */
export function formatFeatureName(feature: Feature): string {
  return FEATURE_METADATA[feature]?.name || feature;
}

/**
 * Get feature description
 */
export function getFeatureDescription(feature: Feature): string {
  return FEATURE_METADATA[feature]?.description || "";
}

/**
 * Get feature category
 */
export function getFeatureCategory(feature: Feature): string {
  return FEATURE_METADATA[feature]?.category || "Other";
}
