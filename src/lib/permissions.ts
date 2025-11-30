import { UserDoc, UserRole } from "@/types";

export enum Permission {
  // Products
  VIEW_PRODUCTS = "view_products",
  CREATE_PRODUCTS = "create_products",
  EDIT_PRODUCTS = "edit_products",
  DELETE_PRODUCTS = "delete_products",

  // Sales
  VIEW_SALES = "view_sales",
  CREATE_SALES = "create_sales",
  EDIT_SALES = "edit_sales",
  DELETE_SALES = "delete_sales",

  // Purchases
  VIEW_PURCHASES = "view_purchases",
  CREATE_PURCHASES = "create_purchases",
  EDIT_PURCHASES = "edit_purchases",
  DELETE_PURCHASES = "delete_purchases",

  // Reports
  VIEW_REPORTS = "view_reports",
  EXPORT_REPORTS = "export_reports",

  // Settings
  VIEW_SETTINGS = "view_settings",
  EDIT_SETTINGS = "edit_settings",

  // Users
  VIEW_USERS = "view_users",
  INVITE_USERS = "invite_users",
  MANAGE_USERS = "manage_users",

  // Cash Management
  VIEW_CASH = "view_cash",
  MANAGE_CASH = "manage_cash",
  COMPLETE_EOD = "complete_eod",
  VERIFY_EOD = "verify_eod",
  VIEW_EOD_HISTORY = "view_eod_history",
}

// Role-based permissions
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: Object.values(Permission), // All permissions
  manager: [
    Permission.VIEW_PRODUCTS,
    Permission.CREATE_PRODUCTS,
    Permission.EDIT_PRODUCTS,
    Permission.VIEW_SALES,
    Permission.CREATE_SALES,
    Permission.EDIT_SALES,
    Permission.VIEW_PURCHASES,
    Permission.CREATE_PURCHASES,
    Permission.EDIT_PURCHASES,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_USERS,
    Permission.VIEW_CASH,
    Permission.MANAGE_CASH,
    Permission.COMPLETE_EOD,
    Permission.VERIFY_EOD,
    Permission.VIEW_EOD_HISTORY,
  ],
  employee: [
    Permission.VIEW_PRODUCTS,
    Permission.VIEW_SALES,
    Permission.CREATE_SALES,
    Permission.VIEW_PURCHASES,
    Permission.VIEW_CASH,
    Permission.COMPLETE_EOD,
  ],
};

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  user: UserDoc | null,
  permission: Permission
): boolean {
  if (!user || user.status !== "active") {
    return false;
  }

  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(
  user: UserDoc | null,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(
  user: UserDoc | null,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(user, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
