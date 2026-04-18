import { z } from "zod"

// User schemas
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  image: z.string().optional(),
  emailVerified: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
})

// Organization schemas
export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().optional(),
  website: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.any().optional(),
  settings: z.any().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const createOrganizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  website: z.string().url().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
})

// Chart of Accounts schemas
export const chartOfAccountSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  parentId: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const createChartOfAccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  parentId: z.string().optional(),
})

// Transaction schemas
export const transactionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  accountId: z.string(),
  date: z.date(),
  description: z.string(),
  reference: z.string().optional(),
  debit: z.number(),
  credit: z.number(),
  currency: z.string(),
  exchangeRate: z.number(),
  metadata: z.any().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const createTransactionSchema = z.object({
  accountId: z.string(),
  date: z.date(),
  description: z.string().min(1),
  reference: z.string().optional(),
  debit: z.number().min(0),
  credit: z.number().min(0),
  currency: z.string().default("GBP"),
  exchangeRate: z.number().default(1),
})

// Customer schemas
export const customerSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.any().optional(),
  taxId: z.string().optional(),
  creditLimit: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.any().optional(),
  taxId: z.string().optional(),
  creditLimit: z.number().default(0),
  currency: z.string().default("GBP"),
  paymentTerms: z.number().int().min(0).max(365).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  billingPreferences: z.any().optional(),
})

// Vendor schemas
export const vendorSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  alias: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.any().optional(),
  taxId: z.string().optional(),
  paymentTerms: z.number().optional(),
  bankAccountNumber: z.string().optional(),
  bankSortCode: z.string().optional(),
  bankIBAN: z.string().optional(),
  bankSWIFT: z.string().optional(),
  bankName: z.string().optional(),
  defaultExpenseAccountId: z.string().optional(),
  taxScheme: z.string().optional(),
  currency: z.string().optional(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const createVendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  alias: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.any().optional(),
  taxId: z.string().optional(),
  paymentTerms: z.number().int().min(0).max(365).optional(),
  bankAccountNumber: z.string().optional(),
  bankSortCode: z.string().optional(),
  bankIBAN: z.string().optional(),
  bankSWIFT: z.string().optional(),
  bankName: z.string().optional(),
  defaultExpenseAccountId: z.string().optional(),
  taxScheme: z.string().optional(),
  currency: z.string().optional().default("GBP"),
  tags: z.array(z.string()).default([]),
})

export const updateVendorSchema = createVendorSchema.partial().extend({
  name: z.string().min(1).optional(), // Name can be updated but must still be unique
  isActive: z.boolean().optional(),
})

// Invoice schemas
export const invoiceSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  customerId: z.string(),
  invoiceNumber: z.string(),
  date: z.date(),
  dueDate: z.date(),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]),
  subtotal: z.number(),
  taxAmount: z.number(),
  total: z.number(),
  currency: z.string(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const createInvoiceSchema = z.object({
  customerId: z.string(),
  date: z.date(),
  dueDate: z.date(),
  notes: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    taxRate: z.number().min(0).max(100).default(0),
  })),
  attachments: z.array(fileAttachmentSchema).optional(), // File attachments
})

export const invoiceItemSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  taxRate: z.number(),
})

// Credit Note schemas
export const createCreditNoteSchema = z.object({
  fromInvoiceId: z.string().optional(), // Source invoice (optional for manual creation)
  date: z.date({ required_error: "Credit note date is required" }),
  reason: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().default("GBP"),
  // Manual items (if not from invoice)
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    taxRate: z.number().min(0).max(100).default(0),
  })).optional(),
}).refine(
  (data) => data.fromInvoiceId || (data.items && data.items.length > 0),
  {
    message: "Either fromInvoiceId or items must be provided",
    path: ["fromInvoiceId"],
  }
)

// Debit Note schemas
export const createDebitNoteSchema = z.object({
  fromBillId: z.string().optional(), // Source bill (optional for manual creation)
  vendorId: z.string().min(1, "Vendor ID is required"),
  date: z.date({ required_error: "Debit note date is required" }),
  reason: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().default("GBP"),
  // Manual items (if not from bill)
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    taxRate: z.number().min(0).max(100).default(0),
  })).optional(),
}).refine(
  (data) => data.fromBillId || (data.items && data.items.length > 0),
  {
    message: "Either fromBillId or items must be provided",
    path: ["fromBillId"],
  }
)

// Bill schemas
export const billSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  vendorId: z.string(),
  billNumber: z.string(),
  date: z.date(),
  dueDate: z.date(),
  status: z.enum(["DRAFT", "RECEIVED", "APPROVED", "PART_PAID", "PAID", "OVERDUE", "CANCELLED"]),
  subtotal: z.number(),
  taxAmount: z.number(),
  total: z.number(),
  currency: z.string(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  deletedAt: z.date().nullable(),
  approvedAt: z.date().nullable(),
  approvedBy: z.string().nullable(),
  postedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const billItemSchema = z.object({
  id: z.string(),
  billId: z.string(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  taxRate: z.number(),
  taxCodeId: z.string().optional(),
  accountId: z.string().optional(),
  lineMemo: z.string().optional(),
  trackingCodes: z.any().optional(),
})

export const createBillItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.0001, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
  taxRate: z.number().min(0).max(100).default(0),
  taxCodeId: z.string().optional(),
  accountId: z.string().min(1, "Account ID is required"),
  lineMemo: z.string().optional(),
  trackingCodes: z.any().optional(), // Project codes, cost centers, etc.
})

// File attachment schema
export const fileAttachmentSchema = z.object({
  fileId: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  contentType: z.string(),
  uploadedAt: z.date(),
  uploaderId: z.string(),
})

export const createBillSchema = z.object({
  vendorId: z.string().min(1, "Vendor ID is required"),
  billNumber: z.string().min(1, "Bill number is required"),
  date: z.date({ required_error: "Bill date is required" }),
  dueDate: z.date({ required_error: "Due date is required" }),
  currency: z.string().default("GBP"),
  paymentTerms: z.number().int().min(0).max(365).optional(), // Override vendor default
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  items: z.array(createBillItemSchema).min(1, "At least one item is required"),
  attachments: z.array(fileAttachmentSchema).optional(), // File attachments
})

export const updateBillSchema = z.object({
  billNumber: z.string().min(1).optional(),
  date: z.date().optional(),
  dueDate: z.date().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  items: z.array(createBillItemSchema).optional(),
  attachments: z.array(fileAttachmentSchema).optional(), // File attachments
  // Cannot update vendorId, status, totals after approval
})

// Bank Account schemas
export const bankAccountSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  accountNumber: z.string().optional(),
  sortCode: z.string().optional(),
  iban: z.string().optional(),
  swift: z.string().optional(),
  currency: z.string(),
  openingBalance: z.number(),
  currentBalance: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const createBankAccountSchema = z.object({
  name: z.string().min(1),
  accountNumber: z.string().optional(),
  sortCode: z.string().optional(),
  iban: z.string().optional(),
  swift: z.string().optional(),
  currency: z.string().default("GBP"),
  openingBalance: z.number().default(0),
})

// Report schemas
export const reportSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  type: z.enum(["PROFIT_LOSS", "BALANCE_SHEET", "CASH_FLOW", "AGED_RECEIVABLES", "AGED_PAYABLES", "TRIAL_BALANCE", "CUSTOM"]),
  parameters: z.any().optional(),
  data: z.any().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const createReportSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["PROFIT_LOSS", "BALANCE_SHEET", "CASH_FLOW", "AGED_RECEIVABLES", "AGED_PAYABLES", "TRIAL_BALANCE", "CUSTOM"]),
  parameters: z.any().optional(),
})

// API Response schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
})

export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

// Dashboard schemas
export const dashboardStatsSchema = z.object({
  totalRevenue: z.number(),
  totalExpenses: z.number(),
  netProfit: z.number(),
  cashPosition: z.number(),
  outstandingInvoices: z.number(),
  overdueInvoices: z.number(),
  bankBalances: z.array(z.object({
    accountName: z.string(),
    balance: z.number(),
    currency: z.string(),
  })),
})

// AI Query schemas
export const aiQuerySchema = z.object({
  query: z.string().min(1),
  context: z.any().optional(),
})

export const aiResponseSchema = z.object({
  answer: z.string(),
  data: z.any().optional(),
  suggestions: z.array(z.string()).optional(),
})

// Payment schemas
export const createPaymentSchema = z.object({
  billId: z.string().optional(),
  vendorId: z.string().optional(),
  bankAccountId: z.string().min(1, "Bank account ID is required"),
  date: z.date({ required_error: "Payment date is required" }),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  currency: z.string().default("GBP"),
  fxRate: z.number().min(0.0001).default(1.0).optional(),
  memo: z.string().optional(),
  method: z.enum(["BANK_TRANSFER", "BACS", "FASTER_PAYMENTS", "CHAPS", "CHEQUE", "CARD", "OTHER"]),
  idempotencyKey: z.string().optional(),
  reference: z.string().optional(),
}).refine(
  (data) => data.billId || data.vendorId,
  {
    message: "Either billId or vendorId must be provided",
    path: ["billId"],
  }
)

// Payment Run schemas
export const createPaymentRunSchema = z.object({
  bankAccountId: z.string().min(1, "Bank account ID is required"),
  paymentDate: z.date({ required_error: "Payment date is required" }),
  paymentMethod: z.enum(["BANK_TRANSFER", "BACS", "FASTER_PAYMENTS", "CHAPS", "CHEQUE", "CARD", "OTHER"]),
  currency: z.string().default("GBP"),
  notes: z.string().optional(),
  // Selection criteria (either criteria or explicit billIds)
  vendorIds: z.array(z.string()).optional(),
  dueDateTo: z.date().optional(),
  minAmount: z.number().optional(),
  billIds: z.array(z.string()).optional(), // Explicit bill IDs
}).refine(
  (data) => data.billIds && data.billIds.length > 0 || data.vendorIds || data.dueDateTo || data.minAmount !== undefined,
  {
    message: "Either billIds or selection criteria (vendorIds, dueDateTo, minAmount) must be provided",
    path: ["billIds"],
  }
)
