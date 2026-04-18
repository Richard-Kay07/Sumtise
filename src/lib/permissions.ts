/**
 * Permissions and Role-Based Access Control (RBAC)
 * 
 * Defines roles, permissions, and access control for the Sumtise application.
 * All permissions are organization-scoped.
 */

import { TRPCError } from "@trpc/server"
import { prisma } from "@/lib/prisma"
import type { Session } from "next-auth"

/**
 * User roles in the system
 */
export enum UserRole {
  /**
   * Organization owner - full access
   */
  OWNER = "OWNER",

  /**
   * Administrator - full access except organization settings
   */
  ADMIN = "ADMIN",

  /**
   * Finance/Accountant - financial operations access
   */
  ACCOUNTANT = "ACCOUNTANT",

  /**
   * Bookkeeper - data entry and basic operations
   */
  BOOKKEEPER = "BOOKKEEPER",

  /**
   * Viewer - read-only access
   */
  VIEWER = "VIEWER",
}

/**
 * Permission types
 */
export enum Permission {
  // Organization
  ORGANIZATION_VIEW = "ORGANIZATION_VIEW",
  ORGANIZATION_EDIT = "ORGANIZATION_EDIT",
  ORGANIZATION_DELETE = "ORGANIZATION_DELETE",
  ORGANIZATION_SETTINGS = "ORGANIZATION_SETTINGS",

  // Users & Members
  MEMBERS_VIEW = "MEMBERS_VIEW",
  MEMBERS_INVITE = "MEMBERS_INVITE",
  MEMBERS_EDIT = "MEMBERS_EDIT",
  MEMBERS_REMOVE = "MEMBERS_REMOVE",

  // Chart of Accounts
  CHART_OF_ACCOUNTS_VIEW = "CHART_OF_ACCOUNTS_VIEW",
  CHART_OF_ACCOUNTS_CREATE = "CHART_OF_ACCOUNTS_CREATE",
  CHART_OF_ACCOUNTS_EDIT = "CHART_OF_ACCOUNTS_EDIT",
  CHART_OF_ACCOUNTS_DELETE = "CHART_OF_ACCOUNTS_DELETE",

  // Transactions
  TRANSACTIONS_VIEW = "TRANSACTIONS_VIEW",
  TRANSACTIONS_CREATE = "TRANSACTIONS_CREATE",
  TRANSACTIONS_EDIT = "TRANSACTIONS_EDIT",
  TRANSACTIONS_DELETE = "TRANSACTIONS_DELETE",

  // Invoices
  INVOICES_VIEW = "INVOICES_VIEW",
  INVOICES_CREATE = "INVOICES_CREATE",
  INVOICES_EDIT = "INVOICES_EDIT",
  INVOICES_DELETE = "INVOICES_DELETE",
  INVOICES_SEND = "INVOICES_SEND",
  INVOICES_MARK_PAID = "INVOICES_MARK_PAID",

  // Credit Notes
  CREDIT_NOTES_VIEW = "CREDIT_NOTES_VIEW",
  CREDIT_NOTES_CREATE = "CREDIT_NOTES_CREATE",
  CREDIT_NOTES_EDIT = "CREDIT_NOTES_EDIT",
  CREDIT_NOTES_DELETE = "CREDIT_NOTES_DELETE",

  // Bills/Expenses
  BILLS_VIEW = "BILLS_VIEW",
  BILLS_CREATE = "BILLS_CREATE",
  BILLS_EDIT = "BILLS_EDIT",
  BILLS_DELETE = "BILLS_DELETE",
  BILLS_APPROVE = "BILLS_APPROVE",
  BILLS_MARK_PAID = "BILLS_MARK_PAID",

  // Debit Notes
  DEBIT_NOTES_VIEW = "DEBIT_NOTES_VIEW",
  DEBIT_NOTES_CREATE = "DEBIT_NOTES_CREATE",
  DEBIT_NOTES_EDIT = "DEBIT_NOTES_EDIT",
  DEBIT_NOTES_DELETE = "DEBIT_NOTES_DELETE",

  // Payments
  PAYMENTS_VIEW = "PAYMENTS_VIEW",
  PAYMENTS_CREATE = "PAYMENTS_CREATE",
  PAYMENTS_EDIT = "PAYMENTS_EDIT",
  PAYMENTS_DELETE = "PAYMENTS_DELETE",
  PAYMENTS_PROCESS = "PAYMENTS_PROCESS",

  // Payment Runs
  PAYMENT_RUNS_VIEW = "PAYMENT_RUNS_VIEW",
  PAYMENT_RUNS_CREATE = "PAYMENT_RUNS_CREATE",
  PAYMENT_RUNS_PROCESS = "PAYMENT_RUNS_PROCESS",
  PAYMENT_RUNS_DELETE = "PAYMENT_RUNS_DELETE",

  // Customers
  CUSTOMERS_VIEW = "CUSTOMERS_VIEW",
  CUSTOMERS_CREATE = "CUSTOMERS_CREATE",
  CUSTOMERS_EDIT = "CUSTOMERS_EDIT",
  CUSTOMERS_DELETE = "CUSTOMERS_DELETE",

  // Vendors
  VENDORS_VIEW = "VENDORS_VIEW",
  VENDORS_CREATE = "VENDORS_CREATE",
  VENDORS_EDIT = "VENDORS_EDIT",
  VENDORS_DELETE = "VENDORS_DELETE",

  // Bank Accounts
  BANK_ACCOUNTS_VIEW = "BANK_ACCOUNTS_VIEW",
  BANK_ACCOUNTS_CREATE = "BANK_ACCOUNTS_CREATE",
  BANK_ACCOUNTS_EDIT = "BANK_ACCOUNTS_EDIT",
  BANK_ACCOUNTS_DELETE = "BANK_ACCOUNTS_DELETE",
  BANK_ACCOUNTS_RECONCILE = "BANK_ACCOUNTS_RECONCILE",

  // Reports
  REPORTS_VIEW = "REPORTS_VIEW",
  REPORTS_EXPORT = "REPORTS_EXPORT",

  // Settings
  SETTINGS_VIEW = "SETTINGS_VIEW",
  SETTINGS_EDIT = "SETTINGS_EDIT",

  // Payroll
  PAYROLL_VIEW = "PAYROLL_VIEW",
  PAYROLL_CREATE = "PAYROLL_CREATE",
  PAYROLL_EDIT = "PAYROLL_EDIT",
  PAYROLL_DELETE = "PAYROLL_DELETE",
  PAYROLL_APPROVE = "PAYROLL_APPROVE",

  // Audit
  AUDIT_VIEW = "AUDIT_VIEW",
}

/**
 * Role-Permission Matrix
 * 
 * Defines which permissions each role has
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    // Owner has all permissions
    ...Object.values(Permission),
  ],

  [UserRole.ADMIN]: [
    // Organization (except delete)
    Permission.ORGANIZATION_VIEW,
    Permission.ORGANIZATION_EDIT,
    Permission.ORGANIZATION_SETTINGS,

    // Members
    Permission.MEMBERS_VIEW,
    Permission.MEMBERS_INVITE,
    Permission.MEMBERS_EDIT,
    Permission.MEMBERS_REMOVE,

    // Chart of Accounts
    Permission.CHART_OF_ACCOUNTS_VIEW,
    Permission.CHART_OF_ACCOUNTS_CREATE,
    Permission.CHART_OF_ACCOUNTS_EDIT,
    Permission.CHART_OF_ACCOUNTS_DELETE,

    // Transactions
    Permission.TRANSACTIONS_VIEW,
    Permission.TRANSACTIONS_CREATE,
    Permission.TRANSACTIONS_EDIT,
    Permission.TRANSACTIONS_DELETE,

    // Invoices
    Permission.INVOICES_VIEW,
    Permission.INVOICES_CREATE,
    Permission.INVOICES_EDIT,
    Permission.INVOICES_DELETE,
    Permission.INVOICES_SEND,
    Permission.INVOICES_MARK_PAID,

    // Credit Notes
    Permission.CREDIT_NOTES_VIEW,
    Permission.CREDIT_NOTES_CREATE,
    Permission.CREDIT_NOTES_EDIT,
    Permission.CREDIT_NOTES_DELETE,

    // Bills
    Permission.BILLS_VIEW,
    Permission.BILLS_CREATE,
    Permission.BILLS_EDIT,
    Permission.BILLS_DELETE,
    Permission.BILLS_APPROVE,
    Permission.BILLS_MARK_PAID,

    // Debit Notes
    Permission.DEBIT_NOTES_VIEW,
    Permission.DEBIT_NOTES_CREATE,
    Permission.DEBIT_NOTES_EDIT,
    Permission.DEBIT_NOTES_DELETE,

    // Payments
    Permission.PAYMENTS_VIEW,
    Permission.PAYMENTS_CREATE,
    Permission.PAYMENTS_EDIT,
    Permission.PAYMENTS_DELETE,
    Permission.PAYMENTS_PROCESS,

    // Payment Runs
    Permission.PAYMENT_RUNS_VIEW,
    Permission.PAYMENT_RUNS_CREATE,
    Permission.PAYMENT_RUNS_PROCESS,
    Permission.PAYMENT_RUNS_DELETE,

    // Customers
    Permission.CUSTOMERS_VIEW,
    Permission.CUSTOMERS_CREATE,
    Permission.CUSTOMERS_EDIT,
    Permission.CUSTOMERS_DELETE,

    // Vendors
    Permission.VENDORS_VIEW,
    Permission.VENDORS_CREATE,
    Permission.VENDORS_EDIT,
    Permission.VENDORS_DELETE,

    // Bank Accounts
    Permission.BANK_ACCOUNTS_VIEW,
    Permission.BANK_ACCOUNTS_CREATE,
    Permission.BANK_ACCOUNTS_EDIT,
    Permission.BANK_ACCOUNTS_DELETE,
    Permission.BANK_ACCOUNTS_RECONCILE,

    // Reports
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT,

    // Settings
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_EDIT,

    // Payroll
    Permission.PAYROLL_VIEW,
    Permission.PAYROLL_CREATE,
    Permission.PAYROLL_EDIT,
    Permission.PAYROLL_APPROVE,

    // Audit
    Permission.AUDIT_VIEW,
  ],

  [UserRole.ACCOUNTANT]: [
    // Organization (view only)
    Permission.ORGANIZATION_VIEW,

    // Chart of Accounts
    Permission.CHART_OF_ACCOUNTS_VIEW,
    Permission.CHART_OF_ACCOUNTS_CREATE,
    Permission.CHART_OF_ACCOUNTS_EDIT,

    // Transactions
    Permission.TRANSACTIONS_VIEW,
    Permission.TRANSACTIONS_CREATE,
    Permission.TRANSACTIONS_EDIT,

    // Invoices
    Permission.INVOICES_VIEW,
    Permission.INVOICES_CREATE,
    Permission.INVOICES_EDIT,
    Permission.INVOICES_SEND,
    Permission.INVOICES_MARK_PAID,

    // Credit Notes
    Permission.CREDIT_NOTES_VIEW,
    Permission.CREDIT_NOTES_CREATE,
    Permission.CREDIT_NOTES_EDIT,

    // Bills
    Permission.BILLS_VIEW,
    Permission.BILLS_CREATE,
    Permission.BILLS_EDIT,
    Permission.BILLS_APPROVE,
    Permission.BILLS_MARK_PAID,

    // Debit Notes
    Permission.DEBIT_NOTES_VIEW,
    Permission.DEBIT_NOTES_CREATE,
    Permission.DEBIT_NOTES_EDIT,

    // Payments
    Permission.PAYMENTS_VIEW,
    Permission.PAYMENTS_CREATE,
    Permission.PAYMENTS_EDIT,
    Permission.PAYMENTS_PROCESS,

    // Payment Runs
    Permission.PAYMENT_RUNS_VIEW,
    Permission.PAYMENT_RUNS_CREATE,
    Permission.PAYMENT_RUNS_PROCESS,

    // Customers
    Permission.CUSTOMERS_VIEW,
    Permission.CUSTOMERS_CREATE,
    Permission.CUSTOMERS_EDIT,

    // Vendors
    Permission.VENDORS_VIEW,
    Permission.VENDORS_CREATE,
    Permission.VENDORS_EDIT,

    // Bank Accounts
    Permission.BANK_ACCOUNTS_VIEW,
    Permission.BANK_ACCOUNTS_CREATE,
    Permission.BANK_ACCOUNTS_EDIT,
    Permission.BANK_ACCOUNTS_RECONCILE,

    // Reports
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT,

    // Settings (view only)
    Permission.SETTINGS_VIEW,

    // Payroll
    Permission.PAYROLL_VIEW,
    Permission.PAYROLL_CREATE,
    Permission.PAYROLL_EDIT,

    // Audit
    Permission.AUDIT_VIEW,
  ],

  [UserRole.BOOKKEEPER]: [
    // Organization (view only)
    Permission.ORGANIZATION_VIEW,

    // Chart of Accounts (view only)
    Permission.CHART_OF_ACCOUNTS_VIEW,

    // Transactions
    Permission.TRANSACTIONS_VIEW,
    Permission.TRANSACTIONS_CREATE,

    // Invoices
    Permission.INVOICES_VIEW,
    Permission.INVOICES_CREATE,
    Permission.INVOICES_EDIT,

    // Credit Notes
    Permission.CREDIT_NOTES_VIEW,
    Permission.CREDIT_NOTES_CREATE,

    // Bills
    Permission.BILLS_VIEW,
    Permission.BILLS_CREATE,
    Permission.BILLS_EDIT,

    // Debit Notes
    Permission.DEBIT_NOTES_VIEW,
    Permission.DEBIT_NOTES_CREATE,

    // Payments (view only)
    Permission.PAYMENTS_VIEW,

    // Customers
    Permission.CUSTOMERS_VIEW,
    Permission.CUSTOMERS_CREATE,
    Permission.CUSTOMERS_EDIT,

    // Vendors
    Permission.VENDORS_VIEW,
    Permission.VENDORS_CREATE,
    Permission.VENDORS_EDIT,

    // Bank Accounts (view only)
    Permission.BANK_ACCOUNTS_VIEW,

    // Reports (view only)
    Permission.REPORTS_VIEW,
  ],

  [UserRole.VIEWER]: [
    // View-only permissions
    Permission.ORGANIZATION_VIEW,
    Permission.CHART_OF_ACCOUNTS_VIEW,
    Permission.TRANSACTIONS_VIEW,
    Permission.INVOICES_VIEW,
    Permission.CREDIT_NOTES_VIEW,
    Permission.BILLS_VIEW,
    Permission.DEBIT_NOTES_VIEW,
    Permission.PAYMENTS_VIEW,
    Permission.PAYMENT_RUNS_VIEW,
    Permission.CUSTOMERS_VIEW,
    Permission.VENDORS_VIEW,
    Permission.BANK_ACCOUNTS_VIEW,
    Permission.REPORTS_VIEW,
    Permission.SETTINGS_VIEW,
  ],
}

/**
 * Get user's role in an organization
 */
export async function getUserRole(
  userId: string,
  organizationId: string
): Promise<UserRole | null> {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    select: {
      role: true,
    },
  })

  return membership?.role as UserRole | null
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<boolean> {
  const role = await getUserRole(userId, organizationId)

  if (!role) {
    return false
  }

  const permissions = ROLE_PERMISSIONS[role]
  return permissions.includes(permission)
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  organizationId: string,
  permissions: Permission[]
): Promise<boolean> {
  const role = await getUserRole(userId, organizationId)

  if (!role) {
    return false
  }

  const userPermissions = ROLE_PERMISSIONS[role]
  return permissions.some((permission) => userPermissions.includes(permission))
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  organizationId: string,
  permissions: Permission[]
): Promise<boolean> {
  const role = await getUserRole(userId, organizationId)

  if (!role) {
    return false
  }

  const userPermissions = ROLE_PERMISSIONS[role]
  return permissions.every((permission) => userPermissions.includes(permission))
}

/**
 * Require a specific permission (throws if not granted)
 */
export async function requirePermission(
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<void> {
  const hasAccess = await hasPermission(userId, organizationId, permission)

  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You do not have permission to perform this action. Required: ${permission}`,
    })
  }
}

/**
 * Require any of the specified permissions (throws if none granted)
 */
export async function requireAnyPermission(
  userId: string,
  organizationId: string,
  permissions: Permission[]
): Promise<void> {
  const hasAccess = await hasAnyPermission(userId, organizationId, permissions)

  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You do not have permission to perform this action. Required: ${permissions.join(" or ")}`,
    })
  }
}

/**
 * Require all of the specified permissions (throws if any missing)
 */
export async function requireAllPermissions(
  userId: string,
  organizationId: string,
  permissions: Permission[]
): Promise<void> {
  const hasAccess = await hasAllPermissions(userId, organizationId, permissions)

  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You do not have permission to perform this action. Required: ${permissions.join(" and ")}`,
    })
  }
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean
  role: UserRole | null
  permissions: Permission[]
  reason?: string
}

/**
 * Check permissions with detailed result
 */
export async function checkPermissions(
  userId: string,
  organizationId: string,
  requiredPermissions: Permission[]
): Promise<PermissionCheckResult> {
  const role = await getUserRole(userId, organizationId)

  if (!role) {
    return {
      allowed: false,
      role: null,
      permissions: [],
      reason: "User is not a member of this organization",
    }
  }

  const userPermissions = ROLE_PERMISSIONS[role]
  const hasAll = requiredPermissions.every((permission) =>
    userPermissions.includes(permission)
  )

  return {
    allowed: hasAll,
    role,
    permissions: userPermissions,
    reason: hasAll
      ? undefined
      : `Missing permissions: ${requiredPermissions
          .filter((p) => !userPermissions.includes(p))
          .join(", ")}`,
  }
}

