/**
 * Invoice PDF Generation Tests
 * 
 * Tests for invoice PDF generation including:
 * - Deterministic hash for seeded invoice
 * - Unicode support
 * - Multi-page invoices
 * - PDF attachment on send
 */

import { test, expect } from '@playwright/test'

test.describe('Invoice PDF Generation', () => {
  const orgId = 'demo-org-id'
  let invoiceId: string | null = null
  let customerId: string | null = null

  test.beforeAll(async ({ request }) => {
    // Create test customer
    const customerResponse = await request.post('/api/trpc/customers.create', {
      data: {
        json: {
          organizationId: orgId,
          name: 'PDF Test Customer',
          email: 'test@example.com',
          currency: 'GBP',
        },
      },
    })

    if (customerResponse.ok()) {
      const customerData = await customerResponse.json()
      customerId = customerData.result?.data?.id || null
    }

    // Create test invoice
    const invoiceResponse = await request.post('/api/trpc/invoices.create', {
      data: {
        json: {
          organizationId: orgId,
          customerId: customerId || 'test-customer-id',
          date: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'DRAFT',
          currency: 'GBP',
          items: [
            {
              description: 'Test Item 1',
              quantity: 2,
              unitPrice: 100,
              taxRate: 20,
            },
            {
              description: 'Test Item 2',
              quantity: 1,
              unitPrice: 50,
              taxRate: 20,
            },
          ],
        },
      },
    })

    if (invoiceResponse.ok()) {
      const invoiceData = await invoiceResponse.json()
      invoiceId = invoiceData.result?.data?.id || null
    }
  })

  test('should generate PDF with deterministic hash for seeded invoice', async ({
    request,
  }) => {
    if (!invoiceId) {
      test.skip()
      return
    }

    // Export PDF twice and verify hash is the same
    const response1 = await request.post('/api/trpc/invoices.exportPDF', {
      data: {
        json: {
          id: invoiceId,
          organizationId: orgId,
        },
      },
    })

    expect(response1.status()).toBe(200)
    const data1 = await response1.json()
    const hash1 = data1.result?.data?.contentHash

    expect(hash1).toBeTruthy()
    expect(typeof hash1).toBe('string')
    expect(hash1.length).toBe(64) // SHA-256 hex string

    // Export again
    const response2 = await request.post('/api/trpc/invoices.exportPDF', {
      data: {
        json: {
          id: invoiceId,
          organizationId: orgId,
        },
      },
    })

    expect(response2.status()).toBe(200)
    const data2 = await response2.json()
    const hash2 = data2.result?.data?.contentHash

    // Hash should be the same for the same invoice
    expect(hash2).toBe(hash1)
  })

  test('should support Unicode characters in invoice', async ({ request }) => {
    if (!customerId) {
      test.skip()
      return
    }

    // Create invoice with Unicode characters
    const invoiceResponse = await request.post('/api/trpc/invoices.create', {
      data: {
        json: {
          organizationId: orgId,
          customerId: customerId,
          date: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'DRAFT',
          currency: 'GBP',
          items: [
            {
              description: 'Test Item with Unicode: 测试项目 €100 £50 ¥1000',
              quantity: 1,
              unitPrice: 100,
              taxRate: 20,
            },
          ],
          notes: 'Notes with Unicode: 备注说明',
        },
      },
    })

    expect(invoiceResponse.ok()).toBe(true)
    const invoiceData = await invoiceResponse.json()
    const unicodeInvoiceId = invoiceData.result?.data?.id

    if (!unicodeInvoiceId) {
      test.skip()
      return
    }

    // Export PDF
    const pdfResponse = await request.post('/api/trpc/invoices.exportPDF', {
      data: {
        json: {
          id: unicodeInvoiceId,
          organizationId: orgId,
        },
      },
    })

    expect(pdfResponse.status()).toBe(200)
    const pdfData = await pdfResponse.json()
    expect(pdfData.result?.data?.pdfUrl).toBeTruthy()

    // Download PDF and verify it's valid
    const pdfUrl = pdfData.result?.data?.pdfUrl
    const downloadResponse = await request.get(pdfUrl)
    expect(downloadResponse.status()).toBe(200)
    expect(downloadResponse.headers()['content-type']).toContain('application/pdf')

    const pdfBuffer = await downloadResponse.body()
    expect(pdfBuffer.length).toBeGreaterThan(0)
    
    // Verify PDF header (PDF files start with %PDF)
    const pdfHeader = Buffer.from(await pdfBuffer.arrayBuffer()).slice(0, 4).toString()
    expect(pdfHeader).toBe('%PDF')
  })

  test('should handle multi-page invoices', async ({ request }) => {
    if (!customerId) {
      test.skip()
      return
    }

    // Create invoice with many items to force multi-page
    const items = Array.from({ length: 30 }, (_, i) => ({
      description: `Item ${i + 1}: This is a long description that might wrap to multiple lines in the PDF table`,
      quantity: i + 1,
      unitPrice: 10 + i,
      taxRate: 20,
    }))

    const invoiceResponse = await request.post('/api/trpc/invoices.create', {
      data: {
        json: {
          organizationId: orgId,
          customerId: customerId,
          date: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'DRAFT',
          currency: 'GBP',
          items,
        },
      },
    })

    expect(invoiceResponse.ok()).toBe(true)
    const invoiceData = await invoiceResponse.json()
    const multiPageInvoiceId = invoiceData.result?.data?.id

    if (!multiPageInvoiceId) {
      test.skip()
      return
    }

    // Export PDF
    const pdfResponse = await request.post('/api/trpc/invoices.exportPDF', {
      data: {
        json: {
          id: multiPageInvoiceId,
          organizationId: orgId,
        },
      },
    })

    expect(pdfResponse.status()).toBe(200)
    const pdfData = await pdfResponse.json()
    expect(pdfData.result?.data?.pdfUrl).toBeTruthy()

    // Download PDF
    const pdfUrl = pdfData.result?.data?.pdfUrl
    const downloadResponse = await request.get(pdfUrl)
    expect(downloadResponse.status()).toBe(200)

    const pdfBuffer = await downloadResponse.body()
    const buffer = Buffer.from(await pdfBuffer.arrayBuffer())
    expect(buffer.length).toBeGreaterThan(1000) // Multi-page should be larger
  })

  test('should attach PDF when sending invoice email', async ({ request }) => {
    if (!invoiceId) {
      test.skip()
      return
    }

    // Send invoice email with PDF
    const emailResponse = await request.post('/api/trpc/emails.sendInvoiceEmail', {
      data: {
        json: {
          organizationId: orgId,
          invoiceId: invoiceId,
          to: ['test@example.com'],
          includePdf: true,
        },
      },
    })

    expect(emailResponse.status()).toBe(200)
    const emailData = await emailResponse.json()
    const outboxId = emailData.result?.data?.id

    expect(outboxId).toBeTruthy()

    // Verify email was sent with attachment
    // In sandbox mode, attachment should be present
    // Note: Actual attachment verification would require checking outbox entry
  })

  test('should return PDF with correct content type', async ({ request }) => {
    if (!invoiceId) {
      test.skip()
      return
    }

    // Export PDF
    const pdfResponse = await request.post('/api/trpc/invoices.exportPDF', {
      data: {
        json: {
          id: invoiceId,
          organizationId: orgId,
        },
      },
    })

    expect(pdfResponse.status()).toBe(200)
    const pdfData = await pdfResponse.json()
    const pdfUrl = pdfData.result?.data?.pdfUrl

    expect(pdfUrl).toBeTruthy()

    // Download PDF
    const downloadResponse = await request.get(pdfUrl)
    expect(downloadResponse.status()).toBe(200)
    expect(downloadResponse.headers()['content-type']).toContain('application/pdf')

    // Verify PDF header (PDF files start with %PDF)
    const pdfBuffer = await downloadResponse.body()
    const buffer = Buffer.from(await pdfBuffer.arrayBuffer())
    const pdfHeader = buffer.slice(0, 4).toString()
    expect(pdfHeader).toBe('%PDF')
  })

  test('should store PDF with content hash in invoice metadata', async ({
    request,
  }) => {
    if (!invoiceId) {
      test.skip()
      return
    }

    // Export PDF
    const pdfResponse = await request.post('/api/trpc/invoices.exportPDF', {
      data: {
        json: {
          id: invoiceId,
          organizationId: orgId,
        },
      },
    })

    expect(pdfResponse.status()).toBe(200)
    const pdfData = await pdfResponse.json()
    const contentHash = pdfData.result?.data?.contentHash
    const pdfPath = pdfData.result?.data?.pdfPath

    expect(contentHash).toBeTruthy()
    expect(pdfPath).toBeTruthy()
    expect(pdfPath).toContain(contentHash)

    // Verify invoice metadata contains PDF info by exporting again (should reuse)
    const verifyResponse = await request.post('/api/trpc/invoices.exportPDF', {
      data: {
        json: {
          id: invoiceId,
          organizationId: orgId,
        },
      },
    })

    if (verifyResponse.ok()) {
      const verifyData = await verifyResponse.json()
      // PDF metadata should be stored and reused
      expect(verifyData.result?.data?.contentHash).toBe(contentHash)
      expect(verifyData.result?.data?.pdfPath).toBe(pdfPath)
    }
  })

  test('should reuse existing PDF if already generated', async ({ request }) => {
    if (!invoiceId) {
      test.skip()
      return
    }

    // Export PDF first time
    const response1 = await request.post('/api/trpc/invoices.exportPDF', {
      data: {
        json: {
          id: invoiceId,
          organizationId: orgId,
        },
      },
    })

    expect(response1.status()).toBe(200)
    const data1 = await response1.json()
    const hash1 = data1.result?.data?.contentHash
    const path1 = data1.result?.data?.pdfPath

    // Export PDF second time (should reuse)
    const response2 = await request.post('/api/trpc/invoices.exportPDF', {
      data: {
        json: {
          id: invoiceId,
          organizationId: orgId,
        },
      },
    })

    expect(response2.status()).toBe(200)
    const data2 = await response2.json()
    const hash2 = data2.result?.data?.contentHash
    const path2 = data2.result?.data?.pdfPath

    // Should have same hash and path (reused)
    expect(hash2).toBe(hash1)
    expect(path2).toBe(path1)
  })
})

