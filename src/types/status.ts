/**
 * Central Status Enums
 * 
 * All status enums used throughout the Sumtise application.
 * These enums match the Prisma schema definitions and provide
 * type safety and consistency across the codebase.
 */

/**
 * Invoice Status
 * 
 * Tracks the lifecycle of an invoice from creation to payment.
 */
export enum InvoiceStatus {
  /**
   * Invoice is in draft state and has not been sent
   */
  DRAFT = "DRAFT",

  /**
   * Invoice has been sent to the customer
   */
  SENT = "SENT",

  /**
   * Invoice has been fully paid
   */
  PAID = "PAID",

  /**
   * Invoice is past its due date and unpaid
   */
  OVERDUE = "OVERDUE",

  /**
   * Invoice has been cancelled
   */
  CANCELLED = "CANCELLED",
}

/**
 * Bill Status
 * 
 * Tracks the lifecycle of a bill/expense from receipt to payment.
 */
export enum BillStatus {
  /**
   * Bill is in draft state
   */
  DRAFT = "DRAFT",

  /**
   * Bill has been received but not yet approved
   */
  RECEIVED = "RECEIVED",

  /**
   * Bill has been approved for payment
   */
  APPROVED = "APPROVED",

  /**
   * Bill has been fully paid
   */
  PAID = "PAID",

  /**
   * Bill is past its due date and unpaid
   */
  OVERDUE = "OVERDUE",

  /**
   * Bill has been cancelled
   */
  CANCELLED = "CANCELLED",
}

/**
 * Credit Note Status
 * 
 * Tracks the lifecycle of a credit note issued to a customer.
 */
export enum CreditNoteStatus {
  /**
   * Credit note is in draft state
   */
  DRAFT = "DRAFT",

  /**
   * Credit note has been sent to the customer
   */
  SENT = "SENT",

  /**
   * Credit note has been applied to an invoice
   */
  APPLIED = "APPLIED",

  /**
   * Credit note has been cancelled
   */
  CANCELLED = "CANCELLED",
}

/**
 * Debit Note Status
 * 
 * Tracks the lifecycle of a debit note issued to a vendor.
 */
export enum DebitNoteStatus {
  /**
   * Debit note is in draft state
   */
  DRAFT = "DRAFT",

  /**
   * Debit note has been sent to the vendor
   */
  SENT = "SENT",

  /**
   * Debit note has been applied to a bill
   */
  APPLIED = "APPLIED",

  /**
   * Debit note has been cancelled
   */
  CANCELLED = "CANCELLED",
}

/**
 * Payment Status
 * 
 * Tracks the status of individual payment transactions.
 */
export enum PaymentStatus {
  /**
   * Payment is pending processing
   */
  PENDING = "PENDING",

  /**
   * Payment is being processed
   */
  PROCESSING = "PROCESSING",

  /**
   * Payment has been completed successfully
   */
  COMPLETED = "COMPLETED",

  /**
   * Payment processing failed
   */
  FAILED = "FAILED",

  /**
   * Payment has been cancelled
   */
  CANCELLED = "CANCELLED",

  /**
   * Payment has been reversed
   */
  REVERSED = "REVERSED",
}

/**
 * Payment Run Status
 * 
 * Tracks the status of batch payment processing runs.
 */
export enum PaymentRunStatus {
  /**
   * Payment run is pending processing
   */
  PENDING = "PENDING",

  /**
   * Payment run is being processed
   */
  PROCESSING = "PROCESSING",

  /**
   * Payment run has been completed successfully
   */
  COMPLETED = "COMPLETED",

  /**
   * Payment run processing failed
   */
  FAILED = "FAILED",

  /**
   * Payment run has been cancelled
   */
  CANCELLED = "CANCELLED",
}

/**
 * Type definitions for status enums
 */
export type InvoiceStatusType = keyof typeof InvoiceStatus
export type BillStatusType = keyof typeof BillStatus
export type CreditNoteStatusType = keyof typeof CreditNoteStatus
export type DebitNoteStatusType = keyof typeof DebitNoteStatus
export type PaymentStatusType = keyof typeof PaymentStatus
export type PaymentRunStatusType = keyof typeof PaymentRunStatus

/**
 * Status display labels
 */
export const InvoiceStatusLabels: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: "Draft",
  [InvoiceStatus.SENT]: "Sent",
  [InvoiceStatus.PAID]: "Paid",
  [InvoiceStatus.OVERDUE]: "Overdue",
  [InvoiceStatus.CANCELLED]: "Cancelled",
}

export const BillStatusLabels: Record<BillStatus, string> = {
  [BillStatus.DRAFT]: "Draft",
  [BillStatus.RECEIVED]: "Received",
  [BillStatus.APPROVED]: "Approved",
  [BillStatus.PAID]: "Paid",
  [BillStatus.OVERDUE]: "Overdue",
  [BillStatus.CANCELLED]: "Cancelled",
}

export const CreditNoteStatusLabels: Record<CreditNoteStatus, string> = {
  [CreditNoteStatus.DRAFT]: "Draft",
  [CreditNoteStatus.SENT]: "Sent",
  [CreditNoteStatus.APPLIED]: "Applied",
  [CreditNoteStatus.CANCELLED]: "Cancelled",
}

export const DebitNoteStatusLabels: Record<DebitNoteStatus, string> = {
  [DebitNoteStatus.DRAFT]: "Draft",
  [DebitNoteStatus.SENT]: "Sent",
  [DebitNoteStatus.APPLIED]: "Applied",
  [DebitNoteStatus.CANCELLED]: "Cancelled",
}

export const PaymentStatusLabels: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: "Pending",
  [PaymentStatus.PROCESSING]: "Processing",
  [PaymentStatus.COMPLETED]: "Completed",
  [PaymentStatus.FAILED]: "Failed",
  [PaymentStatus.CANCELLED]: "Cancelled",
  [PaymentStatus.REVERSED]: "Reversed",
}

export const PaymentRunStatusLabels: Record<PaymentRunStatus, string> = {
  [PaymentRunStatus.PENDING]: "Pending",
  [PaymentRunStatus.PROCESSING]: "Processing",
  [PaymentRunStatus.COMPLETED]: "Completed",
  [PaymentRunStatus.FAILED]: "Failed",
  [PaymentRunStatus.CANCELLED]: "Cancelled",
}

/**
 * Status color mappings for UI
 */
export const InvoiceStatusColors: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: "gray",
  [InvoiceStatus.SENT]: "blue",
  [InvoiceStatus.PAID]: "green",
  [InvoiceStatus.OVERDUE]: "red",
  [InvoiceStatus.CANCELLED]: "gray",
}

export const BillStatusColors: Record<BillStatus, string> = {
  [BillStatus.DRAFT]: "gray",
  [BillStatus.RECEIVED]: "yellow",
  [BillStatus.APPROVED]: "blue",
  [BillStatus.PAID]: "green",
  [BillStatus.OVERDUE]: "red",
  [BillStatus.CANCELLED]: "gray",
}

export const CreditNoteStatusColors: Record<CreditNoteStatus, string> = {
  [CreditNoteStatus.DRAFT]: "gray",
  [CreditNoteStatus.SENT]: "blue",
  [CreditNoteStatus.APPLIED]: "green",
  [CreditNoteStatus.CANCELLED]: "gray",
}

export const DebitNoteStatusColors: Record<DebitNoteStatus, string> = {
  [DebitNoteStatus.DRAFT]: "gray",
  [DebitNoteStatus.SENT]: "blue",
  [DebitNoteStatus.APPLIED]: "green",
  [DebitNoteStatus.CANCELLED]: "gray",
}

export const PaymentStatusColors: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: "yellow",
  [PaymentStatus.PROCESSING]: "blue",
  [PaymentStatus.COMPLETED]: "green",
  [PaymentStatus.FAILED]: "red",
  [PaymentStatus.CANCELLED]: "gray",
  [PaymentStatus.REVERSED]: "orange",
}

export const PaymentRunStatusColors: Record<PaymentRunStatus, string> = {
  [PaymentRunStatus.PENDING]: "yellow",
  [PaymentRunStatus.PROCESSING]: "blue",
  [PaymentRunStatus.COMPLETED]: "green",
  [PaymentRunStatus.FAILED]: "red",
  [PaymentRunStatus.CANCELLED]: "gray",
}

/**
 * Helper functions to check status
 */

/**
 * Check if invoice is in a final state (cannot be modified)
 */
export function isInvoiceFinal(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.PAID || status === InvoiceStatus.CANCELLED
}

/**
 * Check if invoice is payable (can receive payment)
 */
export function isInvoicePayable(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.SENT || status === InvoiceStatus.OVERDUE
}

/**
 * Check if bill is in a final state (cannot be modified)
 */
export function isBillFinal(status: BillStatus): boolean {
  return status === BillStatus.PAID || status === BillStatus.CANCELLED
}

/**
 * Check if bill is payable (can be paid)
 */
export function isBillPayable(status: BillStatus): boolean {
  return (
    status === BillStatus.RECEIVED ||
    status === BillStatus.APPROVED ||
    status === BillStatus.OVERDUE
  )
}

/**
 * Check if credit note is in a final state
 */
export function isCreditNoteFinal(status: CreditNoteStatus): boolean {
  return status === CreditNoteStatus.APPLIED || status === CreditNoteStatus.CANCELLED
}

/**
 * Check if debit note is in a final state
 */
export function isDebitNoteFinal(status: DebitNoteStatus): boolean {
  return status === DebitNoteStatus.APPLIED || status === DebitNoteStatus.CANCELLED
}

/**
 * Check if payment is in a final state
 */
export function isPaymentFinal(status: PaymentStatus): boolean {
  return (
    status === PaymentStatus.COMPLETED ||
    status === PaymentStatus.FAILED ||
    status === PaymentStatus.CANCELLED ||
    status === PaymentStatus.REVERSED
  )
}

/**
 * Check if payment run is in a final state
 */
export function isPaymentRunFinal(status: PaymentRunStatus): boolean {
  return (
    status === PaymentRunStatus.COMPLETED ||
    status === PaymentRunStatus.FAILED ||
    status === PaymentRunStatus.CANCELLED
  )
}

/**
 * Get status label
 */
export function getStatusLabel(
  status: InvoiceStatus | BillStatus | CreditNoteStatus | DebitNoteStatus | PaymentStatus | PaymentRunStatus
): string {
  if (status in InvoiceStatusLabels) {
    return InvoiceStatusLabels[status as InvoiceStatus]
  }
  if (status in BillStatusLabels) {
    return BillStatusLabels[status as BillStatus]
  }
  if (status in CreditNoteStatusLabels) {
    return CreditNoteStatusLabels[status as CreditNoteStatus]
  }
  if (status in DebitNoteStatusLabels) {
    return DebitNoteStatusLabels[status as DebitNoteStatus]
  }
  if (status in PaymentStatusLabels) {
    return PaymentStatusLabels[status as PaymentStatus]
  }
  if (status in PaymentRunStatusLabels) {
    return PaymentRunStatusLabels[status as PaymentRunStatus]
  }
  return String(status)
}

/**
 * Get status color
 */
export function getStatusColor(
  status: InvoiceStatus | BillStatus | CreditNoteStatus | DebitNoteStatus | PaymentStatus | PaymentRunStatus
): string {
  if (status in InvoiceStatusColors) {
    return InvoiceStatusColors[status as InvoiceStatus]
  }
  if (status in BillStatusColors) {
    return BillStatusColors[status as BillStatus]
  }
  if (status in CreditNoteStatusColors) {
    return CreditNoteStatusColors[status as CreditNoteStatus]
  }
  if (status in DebitNoteStatusColors) {
    return DebitNoteStatusColors[status as DebitNoteStatus]
  }
  if (status in PaymentStatusColors) {
    return PaymentStatusColors[status as PaymentStatus]
  }
  if (status in PaymentRunStatusColors) {
    return PaymentRunStatusColors[status as PaymentRunStatus]
  }
  return "gray"
}

