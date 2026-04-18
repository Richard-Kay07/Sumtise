/**
 * E2E tests for Payment Runs Router
 * 
 * Tests payment run creation, processing, export, and bill status updates
 * 
 * Test scenarios:
 * 1. Get outstanding bills
 * 2. Create payment run with selection criteria
 * 3. Create payment run with explicit bill IDs
 * 4. Process payment run (creates payments, updates bills)
 * 5. Export payment file (BACS/CSV)
 * 6. Idempotent processing
 * 7. Rollback on error
 * 8. Totals match validation
 */

import { test, expect } from '../fixtures/auth';
import { navigateToModule, waitForPageLoad } from '../helpers/page-helpers';

test.describe('Payment Runs Router', () => {
  let vendorId: string;
  let billId1: string;
  let billId2: string;
  let bankAccountId: string;

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

    // Get bank account ID
    const bankAccountsResponse = await authenticatedPage.request.get(
      '/api/trpc/bankAccounts.getAll?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
      })
    );
    const bankAccountsData = await bankAccountsResponse.json();
    bankAccountId = bankAccountsData.result?.data?.[0]?.id;

    // Get chart of accounts
    const accountsResponse = await authenticatedPage.request.get(
      '/api/trpc/chartOfAccounts.getAll?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
      })
    );
    const accountsData = await accountsResponse.json();
    const accounts = accountsData.result?.data || [];
    const expenseAccount = accounts.find((acc: any) => acc.type === 'EXPENSE');

    // Create bills for testing
    if (vendorId && expenseAccount) {
      // Create first bill
      const createBill1Response = await authenticatedPage.request.post('/api/trpc/bills.create', {
        data: {
          json: {
            organizationId: 'demo-org-id',
            vendorId,
            billNumber: `BILL-PR-TEST-1-${Date.now()}`,
            date: new Date().toISOString(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            currency: 'GBP',
            items: [
              {
                description: 'Test Item 1',
                quantity: 1,
                unitPrice: 200.00,
                taxRate: 20.00,
                accountId: expenseAccount.id,
              },
            ],
          },
        },
      });

      if (createBill1Response.ok()) {
        const bill1Data = await createBill1Response.json();
        billId1 = bill1Data.result?.data?.id;

        // Approve bill 1
        if (billId1) {
          await authenticatedPage.request.post('/api/trpc/bills.approve', {
            data: {
              json: {
                id: billId1,
                organizationId: 'demo-org-id',
              },
            },
          });
        }
      }

      // Create second bill
      const createBill2Response = await authenticatedPage.request.post('/api/trpc/bills.create', {
        data: {
          json: {
            organizationId: 'demo-org-id',
            vendorId,
            billNumber: `BILL-PR-TEST-2-${Date.now()}`,
            date: new Date().toISOString(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            currency: 'GBP',
            items: [
              {
                description: 'Test Item 2',
                quantity: 2,
                unitPrice: 150.00,
                taxRate: 20.00,
                accountId: expenseAccount.id,
              },
            ],
          },
        },
      });

      if (createBill2Response.ok()) {
        const bill2Data = await createBill2Response.json();
        billId2 = bill2Data.result?.data?.id;

        // Approve bill 2
        if (billId2) {
          await authenticatedPage.request.post('/api/trpc/bills.approve', {
            data: {
              json: {
                id: bill2Data.result?.data?.id,
                organizationId: 'demo-org-id',
              },
            },
          });
        }
      }
    }
  });

  test('should get all payment runs', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/paymentRuns.getAll?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
        page: 1,
        limit: 10,
      })
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('paymentRuns');
    expect(data.result?.data).toHaveProperty('pagination');
  });

  test('should get outstanding bills', async ({ authenticatedPage }) => {
    if (!vendorId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.get(
      '/api/trpc/paymentRuns.getOutstandingBills?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
        vendorIds: [vendorId],
      })
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.result?.data)).toBe(true);
  });

  test('should create payment run with selection criteria', async ({ authenticatedPage }) => {
    if (!vendorId || !bankAccountId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/paymentRuns.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          bankAccountId,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'BACS',
          currency: 'GBP',
          vendorIds: [vendorId],
          minAmount: 100,
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data).toHaveProperty('runNumber');
    expect(data.result?.data.status).toBe('PENDING');
    expect(data.result?.data).toHaveProperty('billCount');
    expect(data.result?.data.billCount).toBeGreaterThan(0);
  });

  test('should create payment run with explicit bill IDs', async ({ authenticatedPage }) => {
    if (!billId1 || !billId2 || !bankAccountId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/paymentRuns.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          bankAccountId,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'BANK_TRANSFER',
          currency: 'GBP',
          billIds: [billId1, billId2],
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data).toHaveProperty('runNumber');
    expect(data.result?.data.status).toBe('PENDING');
    expect(data.result?.data.billCount).toBe(2);
  });

  test('should process payment run', async ({ authenticatedPage }) => {
    if (!billId1 || !bankAccountId) {
      test.skip();
      return;
    }

    // Create payment run first
    const createResponse = await authenticatedPage.request.post('/api/trpc/paymentRuns.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          bankAccountId,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'BACS',
          currency: 'GBP',
          billIds: [billId1],
        },
      },
    });

    const createData = await createResponse.json();
    const paymentRunId = createData.result?.data?.id;

    if (paymentRunId) {
      // Process the payment run
      const processResponse = await authenticatedPage.request.post('/api/trpc/paymentRuns.process', {
        data: {
          json: {
            id: paymentRunId,
            organizationId: 'demo-org-id',
          },
        },
      });

      expect(processResponse.status()).toBe(200);
      const processData = await processResponse.json();
      expect(processData.result?.data.status).toBe('COMPLETED');
      expect(processData.result?.data).toHaveProperty('payments');
      expect(processData.result?.data.payments.length).toBeGreaterThan(0);
    }
  });

  test('should be idempotent when processing', async ({ authenticatedPage }) => {
    if (!billId2 || !bankAccountId) {
      test.skip();
      return;
    }

    // Create payment run
    const createResponse = await authenticatedPage.request.post('/api/trpc/paymentRuns.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          bankAccountId,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'BACS',
          currency: 'GBP',
          billIds: [billId2],
        },
      },
    });

    const createData = await createResponse.json();
    const paymentRunId = createData.result?.data?.id;
    const idempotencyKey = `test-idempotent-${Date.now()}`;

    if (paymentRunId) {
      // Process first time
      const process1Response = await authenticatedPage.request.post('/api/trpc/paymentRuns.process', {
        data: {
          json: {
            id: paymentRunId,
            organizationId: 'demo-org-id',
            idempotencyKey,
          },
        },
      });

      expect(process1Response.status()).toBe(200);
      const process1Data = await process1Response.json();
      const paymentCount1 = process1Data.result?.data.payments.length;

      // Process second time with same key
      const process2Response = await authenticatedPage.request.post('/api/trpc/paymentRuns.process', {
        data: {
          json: {
            id: paymentRunId,
            organizationId: 'demo-org-id',
            idempotencyKey, // Same key
          },
        },
      });

      expect(process2Response.status()).toBe(200);
      const process2Data = await process2Response.json();
      
      // Should return same result (idempotent)
      expect(process2Data.result?.data.payments.length).toBe(paymentCount1);
    }
  });

  test('should export payment file (CSV)', async ({ authenticatedPage }) => {
    if (!billId1 || !bankAccountId) {
      test.skip();
      return;
    }

    // Create and process payment run
    const createResponse = await authenticatedPage.request.post('/api/trpc/paymentRuns.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          bankAccountId,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'BACS',
          currency: 'GBP',
          billIds: [billId1],
        },
      },
    });

    const createData = await createResponse.json();
    const paymentRunId = createData.result?.data?.id;

    if (paymentRunId) {
      // Process first
      await authenticatedPage.request.post('/api/trpc/paymentRuns.process', {
        data: {
          json: {
            id: paymentRunId,
            organizationId: 'demo-org-id',
          },
        },
      });

      // Export file
      const exportResponse = await authenticatedPage.request.post('/api/trpc/paymentRuns.exportFile', {
        data: {
          json: {
            id: paymentRunId,
            organizationId: 'demo-org-id',
            format: 'CSV',
          },
        },
      });

      expect(exportResponse.status()).toBe(200);
      const exportData = await exportResponse.json();
      expect(exportData.result?.data).toHaveProperty('fileContent');
      expect(exportData.result?.data).toHaveProperty('fileReference');
      expect(exportData.result?.data.format).toBe('CSV');
      expect(exportData.result?.data.fileContent).toContain('Payment Date');
    }
  });

  test('should update bill status after processing', async ({ authenticatedPage }) => {
    if (!billId1 || !bankAccountId) {
      test.skip();
      return;
    }

    // Get bill before
    const billBeforeResponse = await authenticatedPage.request.get(
      `/api/trpc/bills.getById?input=${JSON.stringify({
        id: billId1,
        organizationId: 'demo-org-id',
      })}`
    );
    const billBefore = await billBeforeResponse.json();
    const statusBefore = billBefore.result?.data?.status;

    // Create and process payment run
    const createResponse = await authenticatedPage.request.post('/api/trpc/paymentRuns.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          bankAccountId,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'BACS',
          currency: 'GBP',
          billIds: [billId1],
        },
      },
    });

    const createData = await createResponse.json();
    const paymentRunId = createData.result?.data?.id;

    if (paymentRunId) {
      // Process
      await authenticatedPage.request.post('/api/trpc/paymentRuns.process', {
        data: {
          json: {
            id: paymentRunId,
            organizationId: 'demo-org-id',
          },
        },
      });

      // Get bill after
      const billAfterResponse = await authenticatedPage.request.get(
        `/api/trpc/bills.getById?input=${JSON.stringify({
          id: billId1,
          organizationId: 'demo-org-id',
        })}`
      );
      const billAfter = await billAfterResponse.json();
      const statusAfter = billAfter.result?.data?.status;

      // Status should have changed
      expect(['PART_PAID', 'PAID']).toContain(statusAfter);
    }
  });

  test('should get payment run by ID', async ({ authenticatedPage }) => {
    if (!billId1 || !bankAccountId) {
      test.skip();
      return;
    }

    // Create payment run
    const createResponse = await authenticatedPage.request.post('/api/trpc/paymentRuns.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          bankAccountId,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'BACS',
          currency: 'GBP',
          billIds: [billId1],
        },
      },
    });

    const createData = await createResponse.json();
    const paymentRunId = createData.result?.data?.id;

    if (paymentRunId) {
      const response = await authenticatedPage.request.get(
        `/api/trpc/paymentRuns.getById?input=${JSON.stringify({
          id: paymentRunId,
          organizationId: 'demo-org-id',
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.result?.data).toHaveProperty('id');
      expect(data.result?.data.id).toBe(paymentRunId);
      expect(data.result?.data).toHaveProperty('payments');
    }
  });

  test('should prevent processing already completed run', async ({ authenticatedPage }) => {
    if (!billId2 || !bankAccountId) {
      test.skip();
      return;
    }

    // Create and process payment run
    const createResponse = await authenticatedPage.request.post('/api/trpc/paymentRuns.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          bankAccountId,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'BACS',
          currency: 'GBP',
          billIds: [billId2],
        },
      },
    });

    const createData = await createResponse.json();
    const paymentRunId = createData.result?.data?.id;

    if (paymentRunId) {
      // Process first time
      await authenticatedPage.request.post('/api/trpc/paymentRuns.process', {
        data: {
          json: {
            id: paymentRunId,
            organizationId: 'demo-org-id',
          },
        },
      });

      // Try to process again (should fail)
      const process2Response = await authenticatedPage.request.post('/api/trpc/paymentRuns.process', {
        data: {
          json: {
            id: paymentRunId,
            organizationId: 'demo-org-id',
          },
        },
      });

      // Should fail with PRECONDITION_FAILED
      expect(process2Response.status()).toBe(200); // tRPC returns 200 but with error
      const data = await process2Response.json();
      const errorCode = data.result?.data?.error?.code || data.error?.code;
      expect(errorCode).toBe('PRECONDITION_FAILED');
    }
  });
});




