/**
 * Invoice PDF Helper Functions
 * 
 * Converts invoice data from database to PDF format
 */

import { InvoicePDFData } from './invoice'
import { Prisma } from '@prisma/client'
type Decimal = Prisma.Decimal

interface InvoiceWithRelations {
  id: string
  invoiceNumber: string
  date: Date
  dueDate: Date
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  subtotal: Decimal
  taxAmount: Decimal
  total: Decimal
  currency: string
  notes?: string | null
  customer: {
    name: string
    email?: string | null
    phone?: string | null
    address?: any
  }
  items: Array<{
    description: string
    quantity: Decimal
    unitPrice: Decimal
    taxRate: Decimal
    total: Decimal
  }>
  organization: {
    name: string
    email?: string | null
    phone?: string | null
    website?: string | null
    logo?: string | null
    address?: any
  }
}

interface OrganizationSettings {
  data?: any
}

/**
 * Convert invoice from database to PDF data format
 */
export async function convertInvoiceToPDFData(
  invoice: InvoiceWithRelations,
  orgSettings?: OrganizationSettings | null
): Promise<InvoicePDFData> {
  // Parse organization address
  const orgAddress = invoice.organization.address
    ? (typeof invoice.organization.address === 'string'
        ? JSON.parse(invoice.organization.address)
        : invoice.organization.address)
    : undefined

  // Parse customer address
  const customerAddress = invoice.customer.address
    ? (typeof invoice.customer.address === 'string'
        ? JSON.parse(invoice.customer.address)
        : invoice.customer.address)
    : undefined

  // Get payment terms from settings or default
  const paymentTerms = orgSettings?.data?.paymentTerms || 'Net 30 days'
  const paymentInstructions = orgSettings?.data?.paymentInstructions || undefined

  return {
    // Organization
    organizationName: invoice.organization.name,
    organizationAddress: orgAddress ? {
      street: orgAddress.street || orgAddress.line1,
      city: orgAddress.city,
      state: orgAddress.state || orgAddress.province,
      postalCode: orgAddress.postalCode || orgAddress.postcode,
      country: orgAddress.country,
    } : undefined,
    organizationEmail: invoice.organization.email || undefined,
    organizationPhone: invoice.organization.phone || undefined,
    organizationWebsite: invoice.organization.website || undefined,
    organizationLogo: invoice.organization.logo || undefined,

    // Invoice
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date,
    dueDate: invoice.dueDate,
    status: invoice.status,
    currency: invoice.currency,

    // Customer
    customerName: invoice.customer.name,
    customerAddress: customerAddress ? {
      street: customerAddress.street || customerAddress.line1,
      city: customerAddress.city,
      state: customerAddress.state || customerAddress.province,
      postalCode: customerAddress.postalCode || customerAddress.postcode,
      country: customerAddress.country,
    } : undefined,
    customerEmail: invoice.customer.email || undefined,
    customerPhone: invoice.customer.phone || undefined,

    // Items
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      taxRate: item.taxRate.toNumber(),
      total: item.total.toNumber(),
    })),

    // Totals
    subtotal: invoice.subtotal.toNumber(),
    taxAmount: invoice.taxAmount.toNumber(),
    total: invoice.total.toNumber(),

    // Additional
    notes: invoice.notes || undefined,
    paymentTerms: typeof paymentTerms === 'string' ? paymentTerms : undefined,
    paymentInstructions,
  }
}




