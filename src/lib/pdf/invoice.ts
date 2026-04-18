/**
 * Invoice PDF Generator
 * 
 * Generates branded PDF invoices using PDFKit with:
 * - Branded header with logo
 * - Invoice details and customer info
 * - Line items with VAT breakdown
 * - Totals and payment advice
 * - Terms and conditions
 * - DRAFT/PAID watermark
 */

import PDFDocument from 'pdfkit'
import { Decimal } from 'decimal.js'
import crypto from 'crypto'

export interface InvoicePDFData {
  // Organization
  organizationName: string
  organizationAddress?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  organizationEmail?: string
  organizationPhone?: string
  organizationWebsite?: string
  organizationLogo?: string // Base64 or URL

  // Invoice
  invoiceNumber: string
  date: Date
  dueDate: Date
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  currency: string

  // Customer
  customerName: string
  customerAddress?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  customerEmail?: string
  customerPhone?: string

  // Items
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    taxRate: number
    total: number
  }>

  // Totals
  subtotal: number
  taxAmount: number
  total: number

  // Additional
  notes?: string
  paymentTerms?: string
  paymentInstructions?: string
}

/**
 * Generate invoice PDF
 * @param data Invoice data
 * @returns PDF buffer
 */
export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        },
      })

      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers)
        resolve(pdfBuffer)
      })
      doc.on('error', reject)

      // Add watermark if DRAFT or PAID
      if (data.status === 'DRAFT') {
        addWatermark(doc, 'DRAFT', 0.3)
      } else if (data.status === 'PAID') {
        addWatermark(doc, 'PAID', 0.1)
      }

      // Header
      addHeader(doc, data)

      // Invoice details
      addInvoiceDetails(doc, data)

      // Customer info
      addCustomerInfo(doc, data)

      // Line items table
      addLineItems(doc, data)

      // Totals
      addTotals(doc, data)

      // Payment advice
      if (data.paymentInstructions || data.paymentTerms) {
        addPaymentAdvice(doc, data)
      }

      // Notes
      if (data.notes) {
        addNotes(doc, data)
      }

      // Footer
      addFooter(doc, data)

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Add watermark
 */
function addWatermark(doc: PDFDocument, text: string, opacity: number) {
  doc.save()
  doc.opacity(opacity)
  doc.fontSize(72)
  doc.font('Helvetica-Bold')
  doc.fillColor('#cccccc')
  
  // Center of page
  const centerX = 300
  const centerY = 400
  
  // Rotate around center
  doc.translate(centerX, centerY)
  doc.rotate(45)
  doc.translate(-centerX, -centerY)
  
  doc.text(text, centerX - 200, centerY - 36, {
    align: 'center',
    width: 400,
  })
  doc.restore()
}

/**
 * Add header with logo and organization info
 */
function addHeader(doc: PDFDocument, data: InvoicePDFData) {
  // Logo placeholder (would load actual logo if provided)
  if (data.organizationLogo) {
    // In production, would load and embed logo image
    // doc.image(logoBuffer, 50, 50, { width: 100, height: 50 })
  }

  // Organization name
  doc.fontSize(24)
  doc.font('Helvetica-Bold')
  doc.fillColor('#000000')
  doc.text(data.organizationName, 50, 50)

  // Organization address
  if (data.organizationAddress) {
    doc.fontSize(10)
    doc.font('Helvetica')
    doc.fillColor('#666666')
    let y = 80
    const address = data.organizationAddress
    if (address.street) {
      doc.text(address.street, 50, y)
      y += 15
    }
    if (address.city || address.state || address.postalCode) {
      const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(', ')
      if (cityLine) {
        doc.text(cityLine, 50, y)
        y += 15
      }
    }
    if (address.country) {
      doc.text(address.country, 50, y)
      y += 15
    }
  }

  // Contact info
  let contactY = 80
  if (data.organizationEmail) {
    doc.text(`Email: ${data.organizationEmail}`, 400, contactY, { align: 'right' })
    contactY += 15
  }
  if (data.organizationPhone) {
    doc.text(`Phone: ${data.organizationPhone}`, 400, contactY, { align: 'right' })
    contactY += 15
  }
  if (data.organizationWebsite) {
    doc.text(`Web: ${data.organizationWebsite}`, 400, contactY, { align: 'right' })
  }

  // Invoice title
  doc.fontSize(32)
  doc.font('Helvetica-Bold')
  doc.fillColor('#000000')
  doc.text('INVOICE', 400, 50, { align: 'right' })
}

/**
 * Add invoice details
 */
function addInvoiceDetails(doc: PDFDocument, data: InvoicePDFData) {
  let y = 180

  doc.fontSize(12)
  doc.font('Helvetica-Bold')
  doc.fillColor('#000000')
  doc.text('Invoice Details', 50, y)

  y += 25

  doc.fontSize(10)
  doc.font('Helvetica')
  doc.fillColor('#333333')

  doc.text('Invoice Number:', 50, y)
  doc.font('Helvetica-Bold')
  doc.text(data.invoiceNumber, 150, y)

  y += 20

  doc.font('Helvetica')
  doc.text('Date:', 50, y)
  doc.font('Helvetica-Bold')
  doc.text(formatDate(data.date), 150, y)

  y += 20

  doc.font('Helvetica')
  doc.text('Due Date:', 50, y)
  doc.font('Helvetica-Bold')
  doc.text(formatDate(data.dueDate), 150, y)

  y += 20

  doc.font('Helvetica')
  doc.text('Status:', 50, y)
  doc.font('Helvetica-Bold')
  doc.fillColor(getStatusColor(data.status))
  doc.text(data.status, 150, y)
  doc.fillColor('#333333')
}

/**
 * Add customer information
 */
function addCustomerInfo(doc: PDFDocument, data: InvoicePDFData) {
  let y = 180

  doc.fontSize(12)
  doc.font('Helvetica-Bold')
  doc.fillColor('#000000')
  doc.text('Bill To', 400, y, { align: 'right', width: 150 })

  y += 25

  doc.fontSize(10)
  doc.font('Helvetica-Bold')
  doc.text(data.customerName, 400, y, { align: 'right', width: 150 })

  y += 20

  if (data.customerAddress) {
    doc.font('Helvetica')
    doc.fillColor('#333333')
    const address = data.customerAddress
    if (address.street) {
      doc.text(address.street, 400, y, { align: 'right', width: 150 })
      y += 15
    }
    if (address.city || address.state || address.postalCode) {
      const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(', ')
      if (cityLine) {
        doc.text(cityLine, 400, y, { align: 'right', width: 150 })
        y += 15
      }
    }
    if (address.country) {
      doc.text(address.country, 400, y, { align: 'right', width: 150 })
      y += 15
    }
  }

  if (data.customerEmail) {
    doc.text(`Email: ${data.customerEmail}`, 400, y, { align: 'right', width: 150 })
    y += 15
  }
  if (data.customerPhone) {
    doc.text(`Phone: ${data.customerPhone}`, 400, y, { align: 'right', width: 150 })
  }
}

/**
 * Add line items table
 */
function addLineItems(doc: PDFDocument, data: InvoicePDFData) {
  let y = 320

  // Table header
  doc.fontSize(10)
  doc.font('Helvetica-Bold')
  doc.fillColor('#000000')
  doc.rect(50, y, 500, 25).fillAndStroke('#f0f0f0', '#cccccc')
  doc.text('Description', 60, y + 8)
  doc.text('Qty', 300, y + 8)
  doc.text('Unit Price', 350, y + 8)
  doc.text('Tax Rate', 420, y + 8)
  doc.text('Total', 480, y + 8, { align: 'right', width: 60 })

  y += 25

  // Table rows
  doc.font('Helvetica')
  doc.fillColor('#333333')

  for (const item of data.items) {
    const rowHeight = Math.max(30, Math.ceil(item.description.length / 60) * 15 + 10)

    // Row background
    doc.rect(50, y, 500, rowHeight).stroke('#cccccc')

    // Description (with wrapping)
    doc.text(item.description, 60, y + 8, {
      width: 230,
      ellipsis: true,
    })

    // Quantity
    doc.text(formatNumber(item.quantity), 300, y + 8)

    // Unit Price
    doc.text(formatCurrency(item.unitPrice, data.currency), 350, y + 8)

    // Tax Rate
    doc.text(`${formatNumber(item.taxRate)}%`, 420, y + 8)

    // Total
    doc.text(formatCurrency(item.total, data.currency), 480, y + 8, {
      align: 'right',
      width: 60,
    })

    y += rowHeight

    // Page break if needed
    if (y > 700) {
      doc.addPage()
      y = 50
    }
  }

  return y
}

/**
 * Add totals section
 */
function addTotals(doc: PDFDocument, data: InvoicePDFData) {
  let y = doc.y + 20

  // Subtotal
  doc.fontSize(10)
  doc.font('Helvetica')
  doc.fillColor('#333333')
  doc.text('Subtotal:', 400, y, { align: 'right', width: 100 })
  doc.font('Helvetica-Bold')
  doc.text(formatCurrency(data.subtotal, data.currency), 500, y, { align: 'right', width: 50 })
  y += 20

  // Tax
  if (data.taxAmount > 0) {
    doc.font('Helvetica')
    doc.text('Tax:', 400, y, { align: 'right', width: 100 })
    doc.font('Helvetica-Bold')
    doc.text(formatCurrency(data.taxAmount, data.currency), 500, y, { align: 'right', width: 50 })
    y += 20
  }

  // Total
  doc.fontSize(14)
  doc.font('Helvetica-Bold')
  doc.fillColor('#000000')
  doc.rect(400, y, 150, 30).stroke('#000000')
  doc.text('Total:', 410, y + 8, { align: 'right', width: 90 })
  doc.text(formatCurrency(data.total, data.currency), 500, y + 8, { align: 'right', width: 50 })
}

/**
 * Add payment advice
 */
function addPaymentAdvice(doc: PDFDocument, data: InvoicePDFData) {
  let y = doc.y + 30

  doc.fontSize(10)
  doc.font('Helvetica-Bold')
  doc.fillColor('#000000')
  doc.text('Payment Instructions', 50, y)
  y += 20

  doc.fontSize(9)
  doc.font('Helvetica')
  doc.fillColor('#333333')

  if (data.paymentInstructions) {
    doc.text(data.paymentInstructions, 50, y, { width: 500 })
    y += 30
  }

  if (data.paymentTerms) {
    doc.font('Helvetica-Bold')
    doc.text('Payment Terms:', 50, y)
    y += 15
    doc.font('Helvetica')
    doc.text(data.paymentTerms, 50, y, { width: 500 })
  }
}

/**
 * Add notes
 */
function addNotes(doc: PDFDocument, data: InvoicePDFData) {
  let y = doc.y + 30

  doc.fontSize(10)
  doc.font('Helvetica-Bold')
  doc.fillColor('#000000')
  doc.text('Notes', 50, y)
  y += 20

  doc.fontSize(9)
  doc.font('Helvetica')
  doc.fillColor('#333333')
  doc.text(data.notes || '', 50, y, { width: 500 })
}

/**
 * Add footer
 */
function addFooter(doc: PDFDocument, data: InvoicePDFData) {
  const pageHeight = doc.page.height
  const footerY = pageHeight - 50

  doc.fontSize(8)
  doc.font('Helvetica')
  doc.fillColor('#999999')
  doc.text(
    `Generated by Sumtise on ${formatDate(new Date())}`,
    50,
    footerY,
    { align: 'center', width: 500 }
  )
}

/**
 * Format date
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format currency
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount)
}

/**
 * Format number
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Get status color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'DRAFT':
      return '#999999'
    case 'SENT':
      return '#0066cc'
    case 'PAID':
      return '#00aa00'
    case 'OVERDUE':
      return '#cc0000'
    case 'CANCELLED':
      return '#666666'
    default:
      return '#333333'
  }
}

/**
 * Generate content hash for PDF
 * @param pdfBuffer PDF buffer
 * @returns SHA-256 hash
 */
export function generatePDFHash(pdfBuffer: Buffer): string {
  return crypto.createHash('sha256').update(pdfBuffer).digest('hex')
}

