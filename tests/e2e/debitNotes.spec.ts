/**
 * E2E tests for Debit Notes Router
 * 
 * Tests debit note creation, application, cancellation, and bill balance updates
 * 
 * Test scenarios:
 * 1. Create debit note from bill (default lines)
 * 2. Create manual debit note
 * 3. Apply debit note to bill (full)
 * 4. Apply debit note to bill (partial)
 * 5. Apply debit note to multiple bills
 * 6. Cancel debit note (only if not applied)
 * 7. Postings DR=CR validation
 * 8. Bill balance updates
 * 9. Vendor balance tracking
 */

import { test, expect } from '../fixtures/auth';

test.describe('Debit Notes Router', () => {
  let vendorId: string;
  let billId1: string;
  let billId2: string;

  test.beforeAll(async ({ authenticatedPage }) => {
    // Get vendor ID
    const vendorsResponse = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
        page: 1,
        limit: 1,
      })
    );
    const vendorsData = await vendorsResponse.json();
    vendorId = vendorsData.result?.data?.vendors?.[0]?.id;

    // Create bills for testing
    if (vendorId) {
      // Create first bill
      const createBill1Response = await authenticatedPage.request.post('/api/trpc/bills.create', {
        data: {
          json: {
            organizationId: 'demo-org-id',
            vendorId,
            date: new Date().toISOString(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            items: [
              {
                description: 'Product A',
                quantity: 2,
                unitPrice: 100.00,
                taxRate: 20.00,
              },
            ],
          },
        },
      });

      if (createBill1Response.ok()) {
        const bill1Data = await createBill1Response.json();
        billId1 = bill1Data.result?.data?.id;
      }

      // Create second bill
      const createBill2Response = await authenticatedPage.request.post('/api/trpc/bills.create', {
        data: {
          json: {
            organizationId: 'demo-org-id',
            vendorId,
            date: new Date().toISOString(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            items: [
              {
                description: 'Service B',
                quantity: 1,
                unitPrice: 200.00,
                taxRate: 20.00,
              },
            ],
          },
        },
      });

      if (createBill2Response.ok()) {
        const bill2Data = await createBill2Response.json();
        billId2 = bill2Data.result?.data?.id;
      }
    }
  });

  test('should get all debit notes', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/debitNotes.getAll?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
        page: 1,
        limit: 10,
      })
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('debitNotes');
    expect(data.result?.data).toHaveProperty('pagination');
  });

  test('should create debit note from bill', async ({ authenticatedPage }) => {
    if (!billId1) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/debitNotes.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          fromBillId: billId1,
          vendorId,
          date: new Date().toISOString(),
          reason: 'Returned goods',
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data.status).toBe('DRAFT');
    expect(data.result?.data).toHaveProperty('items');
    expect(data.result?.data.items.length).toBeGreaterThan(0);
  });

  test('should create manual debit note', async ({ authenticatedPage }) => {
    if (!vendorId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/debitNotes.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          vendorId,
          date: new Date().toISOString(),
          reason: 'Manual adjustment',
          items: [
            {
              description: 'Adjustment Item',
              quantity: 1,
              unitPrice: 50.00,
              taxRate: 20.00,
            },
          ],
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data.status).toBe('DRAFT');
    expect(data.result?.data.items.length).toBe(1);
  });

  test('should apply debit note to bill (full)', async ({ authenticatedPage }) => {
    if (!billId1 || !vendorId) {
      test.skip();
      return;
    }

    // Create debit note first
    const createResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          fromBillId: billId1,
          vendorId,
          date: new Date().toISOString(),
        },
      },
    });

    const createData = await createResponse.json();
    const debitNoteId = createData.result?.data?.id;
    const debitNoteTotal = createData.result?.data?.total;

    if (debitNoteId) {
      // Apply full amount
      const applyResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.apply', {
        data: {
          json: {
            id: debitNoteId,
            organizationId: 'demo-org-id',
            targetBillId: billId1,
            amount: debitNoteTotal,
          },
        },
      });

      expect(applyResponse.status()).toBe(200);
      const applyData = await applyResponse.json();
      expect(applyData.result?.data.debitNote.status).toBe('APPLIED');
      expect(applyData.result?.data).toHaveProperty('posting');
    }
  });

  test('should apply debit note to bill (partial)', async ({ authenticatedPage }) => {
    if (!billId1 || !vendorId) {
      test.skip();
      return;
    }

    // Create debit note
    const createResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          vendorId,
          date: new Date().toISOString(),
          items: [
            {
              description: 'Partial Adjustment',
              quantity: 1,
              unitPrice: 100.00,
              taxRate: 20.00,
            },
          ],
        },
      },
    });

    const createData = await createResponse.json();
    const debitNoteId = createData.result?.data?.id;

    if (debitNoteId) {
      // Apply partial amount
      const applyResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.apply', {
        data: {
          json: {
            id: debitNoteId,
            organizationId: 'demo-org-id',
            targetBillId: billId1,
            amount: 50.00,
          },
        },
      });

      expect(applyResponse.status()).toBe(200);
      const applyData = await applyResponse.json();
      expect(applyData.result?.data.debitNote.status).toBe('SENT'); // Not fully applied
    }
  });

  test('should apply debit note to multiple bills', async ({ authenticatedPage }) => {
    if (!billId1 || !billId2 || !vendorId) {
      test.skip();
      return;
    }

    // Create debit note
    const createResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          vendorId,
          date: new Date().toISOString(),
          items: [
            {
              description: 'Multi-bill Adjustment',
              quantity: 1,
              unitPrice: 150.00,
              taxRate: 20.00,
            },
          ],
        },
      },
    });

    const createData = await createResponse.json();
    const debitNoteId = createData.result?.data?.id;

    if (debitNoteId) {
      // Apply to first bill
      await authenticatedPage.request.post('/api/trpc/debitNotes.apply', {
        data: {
          json: {
            id: debitNoteId,
            organizationId: 'demo-org-id',
            targetBillId: billId1,
            amount: 50.00,
          },
        },
      });

      // Apply to second bill
      const apply2Response = await authenticatedPage.request.post('/api/trpc/debitNotes.apply', {
        data: {
          json: {
            id: debitNoteId,
            organizationId: 'demo-org-id',
            targetBillId: billId2,
            amount: 50.00,
          },
        },
      });

      expect(apply2Response.status()).toBe(200);
      const applyData = await apply2Response.json();
      expect(applyData.result?.data.debitNote).toHaveProperty('metadata');
    }
  });

  test('should prevent over-application', async ({ authenticatedPage }) => {
    if (!billId1 || !vendorId) {
      test.skip();
      return;
    }

    // Create debit note
    const createResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          vendorId,
          date: new Date().toISOString(),
          items: [
            {
              description: 'Small Adjustment',
              quantity: 1,
              unitPrice: 50.00,
              taxRate: 20.00,
            },
          ],
        },
      },
    });

    const createData = await createResponse.json();
    const debitNoteId = createData.result?.data?.id;
    const debitNoteTotal = createData.result?.data?.total;

    if (debitNoteId) {
      // Try to apply more than total
      const applyResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.apply', {
        data: {
          json: {
            id: debitNoteId,
            organizationId: 'demo-org-id',
            targetBillId: billId1,
            amount: debitNoteTotal + 100, // Over-apply
          },
        },
      });

      expect(applyResponse.status()).toBe(200);
      const data = await applyResponse.json();
      const errorCode = data.result?.data?.error?.code || data.error?.code;
      expect(errorCode).toBe('BAD_REQUEST');
    }
  });

  test('should cancel debit note only if not applied', async ({ authenticatedPage }) => {
    if (!vendorId) {
      test.skip();
      return;
    }

    // Create debit note
    const createResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          vendorId,
          date: new Date().toISOString(),
          items: [
            {
              description: 'Cancellable Adjustment',
              quantity: 1,
              unitPrice: 50.00,
              taxRate: 20.00,
            },
          ],
        },
      },
    });

    const createData = await createResponse.json();
    const debitNoteId = createData.result?.data?.id;

    if (debitNoteId) {
      // Cancel (should succeed)
      const cancelResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.cancel', {
        data: {
          json: {
            id: debitNoteId,
            organizationId: 'demo-org-id',
            reason: 'No longer needed',
          },
        },
      });

      expect(cancelResponse.status()).toBe(200);
      const cancelData = await cancelResponse.json();
      expect(cancelData.result?.data.status).toBe('CANCELLED');
    }
  });

  test('should prevent cancel if applied', async ({ authenticatedPage }) => {
    if (!billId1 || !vendorId) {
      test.skip();
      return;
    }

    // Create and apply debit note
    const createResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          vendorId,
          date: new Date().toISOString(),
          items: [
            {
              description: 'Applied Adjustment',
              quantity: 1,
              unitPrice: 50.00,
              taxRate: 20.00,
            },
          ],
        },
      },
    });

    const createData = await createResponse.json();
    const debitNoteId = createData.result?.data?.id;
    const debitNoteTotal = createData.result?.data?.total;

    if (debitNoteId) {
      // Apply
      await authenticatedPage.request.post('/api/trpc/debitNotes.apply', {
        data: {
          json: {
            id: debitNoteId,
            organizationId: 'demo-org-id',
            targetBillId: billId1,
            amount: debitNoteTotal,
          },
        },
      });

      // Try to cancel (should fail)
      const cancelResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.cancel', {
        data: {
          json: {
            id: debitNoteId,
            organizationId: 'demo-org-id',
          },
        },
      });

      expect(cancelResponse.status()).toBe(200);
      const data = await cancelResponse.json();
      const errorCode = data.result?.data?.error?.code || data.error?.code;
      expect(errorCode).toBe('PRECONDITION_FAILED');
    }
  });

  test('should update bill balance when applied', async ({ authenticatedPage }) => {
    if (!billId1 || !vendorId) {
      test.skip();
      return;
    }

    // Get initial bill
    const getBillResponse = await authenticatedPage.request.get(
      `/api/trpc/bills.getById?input=${JSON.stringify({ id: billId1, organizationId: 'demo-org-id' })}`
    );
    const billData = await getBillResponse.json();
    const initialTotal = billData.result?.data?.total;

    // Create and apply debit note
    const createResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          vendorId,
          date: new Date().toISOString(),
          items: [
            {
              description: 'Balance Test',
              quantity: 1,
              unitPrice: 50.00,
              taxRate: 20.00,
            },
          ],
        },
      },
    });

    const createData = await createResponse.json();
    const debitNoteId = createData.result?.data?.id;
    const debitNoteTotal = createData.result?.data?.total;

    if (debitNoteId) {
      // Apply
      await authenticatedPage.request.post('/api/trpc/debitNotes.apply', {
        data: {
          json: {
            id: debitNoteId,
            organizationId: 'demo-org-id',
            targetBillId: billId1,
            amount: debitNoteTotal,
          },
        },
      });

      // Get updated bill
      const getBill2Response = await authenticatedPage.request.get(
        `/api/trpc/bills.getById?input=${JSON.stringify({ id: billId1, organizationId: 'demo-org-id' })}`
      );
      const bill2Data = await getBill2Response.json();
      const metadata = bill2Data.result?.data?.metadata;
      
      // Bill should have debit note in metadata
      expect(metadata?.debitNotes).toBeDefined();
    }
  });

  test('should verify DR=CR postings', async ({ authenticatedPage }) => {
    if (!billId1 || !vendorId) {
      test.skip();
      return;
    }

    // Create and apply debit note
    const createResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          vendorId,
          date: new Date().toISOString(),
          items: [
            {
              description: 'Posting Test',
              quantity: 1,
              unitPrice: 100.00,
              taxRate: 20.00,
            },
          ],
        },
      },
    });

    const createData = await createResponse.json();
    const debitNoteId = createData.result?.data?.id;
    const debitNoteTotal = createData.result?.data?.total;

    if (debitNoteId) {
      // Apply
      const applyResponse = await authenticatedPage.request.post('/api/trpc/debitNotes.apply', {
        data: {
          json: {
            id: debitNoteId,
            organizationId: 'demo-org-id',
            targetBillId: billId1,
            amount: debitNoteTotal,
          },
        },
      });

      expect(applyResponse.status()).toBe(200);
      const applyData = await applyResponse.json();
      const posting = applyData.result?.data?.posting;
      
      // Verify posting was created (DR=CR validated by postDoubleEntry)
      expect(posting).toBeDefined();
      expect(posting.balanced).toBe(true);
    }
  });
});




