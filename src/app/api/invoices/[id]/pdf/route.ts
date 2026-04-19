/**
 * Invoice PDF Download Endpoint
 * 
 * Direct download endpoint for invoice PDFs
 * GET /api/invoices/[id]/pdf
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { handleError, logRequest, addSecurityHeaders } from "@/lib/error-handler"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { auth } from "@clerk/nextjs/server"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    logRequest(request)

    const invoiceId = params.id
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get("organizationId")

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      )
    }

    // Verify authentication
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Verify invoice ownership
    await verifyResourceOwnership("invoice", invoiceId, organizationId)

    // Get invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        items: true,
        organization: true,
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    // Check if PDF exists in metadata
    const metadata = (invoice.metadata as any) || {}
    const pdfMetadata = metadata.pdf

    let pdfBuffer: Buffer

    if (pdfMetadata?.path) {
      // Retrieve existing PDF from storage
      const { createStorageService } = await import("@/lib/storage")
      const storage = createStorageService()
      try {
        pdfBuffer = await storage.get(pdfMetadata.path)
      } catch (error) {
        // PDF not found in storage, generate new one
        pdfBuffer = await generateInvoicePDFBuffer(invoice, organizationId)
      }
    } else {
      // Generate new PDF
      pdfBuffer = await generateInvoicePDFBuffer(invoice, organizationId)
    }

    // Return PDF with correct headers
    const response = new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    })

    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Generate invoice PDF buffer
 */
async function generateInvoicePDFBuffer(invoice: any, organizationId: string): Promise<Buffer> {
  // Get organization settings for payment terms
  const orgSettings = await prisma.organizationSettings.findFirst({
    where: {
      organizationId,
      category: "ACCOUNTING",
    },
  })

  // Convert invoice to PDF data format
  const { convertInvoiceToPDFData } = await import("@/lib/pdf/invoice-helpers")
  const pdfData = await convertInvoiceToPDFData(invoice, orgSettings)

  // Generate PDF
  const { generateInvoicePDF } = await import("@/lib/pdf/invoice")
  return await generateInvoicePDF(pdfData)
}




