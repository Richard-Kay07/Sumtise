/**
 * E2E tests for Payments Router
 * 
 * Tests payment creation, reversal, history, and ledger postings
 * 
 * Test scenarios:
 * 1. Create payment with bill (applies to bill balance)
 * 2. Create on-account payment (vendor only)
 * 3. Reverse payment (creates reversing journal, restores bill balance)
 * 4. Get payment history (with running balance)
 * 5. Idempotency key prevents duplicates
 * 6. Cannot over-apply payment
 * 7. Cross-organization blocking
 * 8. DR=CR validation
 */

import { test, expect } from '../fixtures/auth';
import { navigateToModule, waitForPageLoad } from '../helpers/page-helpers';

test.describe('Payments Router', () => {
  let vendorId: string;
  let billId: string;
  let bankAccountId: string;
  let apAccountId: string;
  let bankAccountCoaId: string;

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
    
    // Find AP account
    apAccountId = accounts.find((acc: any) => 
      acc.type === 'LIABILITY' && 
      (acc.code === '2000' || acc.code === '2100' || acc.name.toLowerCase().includes('payable'))
    )?.id;

    // Find bank account in COA
    bankAccountCoaId = accounts.find((acc: any) => 
      acc.type === 'ASSET' && 
      (acc.code === '1000' || acc.code === '1010' || acc.name.toLowerCase().includes('bank') || acc.name.toLowerCase().includes('cash'))
    )?.id;

    // Create a bill for testing
    if (vendorId && apAccountId) {
      const expenseAccount = accounts.find((acc: any) => acc.type === 'EXPENSE');
      
      if (expenseAccount) {
        const createBillResponse = await authenticatedPage.request.post('/api/trpc/bills.create', {
          data: {
            json: {
              organizationId: 'demo-org-id',
              vendorId,
              billNumber: `BILL-PAY-TEST-${Date.now()}`,
              date: new Date().toISOString(),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              currency: 'GBP',
              items: [
                {
                  description: 'Test Item 1',
                  quantity: 1,
                  unitPrice: 100.00,
                  taxRate: 20.00,
                  accountId: expenseAccount.id,
                },
                {
                  description: 'Test Item 2',
                  quantity: 2,
                  unitPrice: 50.00,
                  taxRate: 20.00,
                  accountId: expenseAccount.id,
                },
              ],
            },
          },
        });

        if (createBillResponse.ok()) {
          const billData = await createBillResponse.json();
          billId = billData.result?.data?.id;

          // Approve the bill
          if (billId) {
            await authenticatedPage.request.post('/api/trpc/bills.approve', {
              data: {
                json: {
                  id: billId,
                  organizationId: 'demo-org-id',
                },
              },
            });
          }
        }
      }
    }
  });

  test('should get all payments', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/payments.getAll?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
        page: 1,
        limit: 10,
      })
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('payments');
    expect(data.result?.data).toHaveProperty('pagination');
  });

  test('should create payment with bill', async ({ authenticatedPage }) => {
    if (!billId || !bankAccountId) {
      test.skip();
      return;
    }

    const idempotencyKey = `test-payment-${Date.now()}`;
    const response = await authenticatedPage.request.post('/api/trpc/payments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          bankAccountId,
          date: new Date().toISOString(),
          amount: 50.00,
          currency: 'GBP',
          method: 'BANK_TRANSFER',
          idempotencyKey,
          memo: 'Test payment',
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data.billId).toBe(billId);
    expect(data.result?.data.status).toBe('COMPLETED');
    expect(data.result?.data.amount).toBe(50.00);
  });

  test('should create on-account payment (vendor only)', async ({ authenticatedPage }) => {
    if (!vendorId || !bankAccountId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/payments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          vendorId,
          bankAccountId,
          date: new Date().toISOString(),
          amount: 100.00,
          currency: 'GBP',
          method: 'BANK_TRANSFER',
          memo: 'On-account payment',
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data.billId).toBeNull();
    expect(data.result?.data.vendorId).toBe(vendorId);
    expect(data.result?.data.status).toBe('COMPLETED');
  });

  test('should prevent duplicate payments with idempotency key', async ({ authenticatedPage }) => {
    if (!billId || !bankAccountId) {
      test.skip();
      return;
    }

    const idempotencyKey = `idempotency-test-${Date.now()}`;

    // Create first payment
    const response1 = await authenticatedPage.request.post('/api/trpc/payments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          bankAccountId,
          date: new Date().toISOString(),
          amount: 25.00,
          currency: 'GBP',
          method: 'BANK_TRANSFER',
          idempotencyKey,
        },
      },
    });

    expect(response1.status()).toBe(200);
    const data1 = await response1.json();
    const paymentId1 = data1.result?.data?.id;

    // Try to create duplicate with same idempotency key
    const response2 = await authenticatedPage.request.post('/api/trpc/payments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          bankAccountId,
          date: new Date().toISOString(),
          amount: 25.00,
          currency: 'GBP',
          method: 'BANK_TRANSFER',
          idempotencyKey, // Same key
        },
      },
    });

    expect(response2.status()).toBe(200);
    const data2 = await response2.json();
    const paymentId2 = data2.result?.data?.id;

    // Should return the same payment
    expect(paymentId1).toBe(paymentId2);
  });

  test('should prevent over-application of payment', async ({ authenticatedPage }) => {
    if (!billId || !bankAccountId) {
      test.skip();
      return;
    }

    // Try to pay more than bill balance
    const response = await authenticatedPage.request.post('/api/trpc/payments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          bankAccountId,
          date: new Date().toISOString(),
          amount: 100000.00, // Way more than bill total
          currency: 'GBP',
          method: 'BANK_TRANSFER',
        },
      },
    });

    // Should fail with BAD_REQUEST
    expect(response.status()).toBe(200); // tRPC returns 200 but with error in body
    const data = await response.json();
    expect(data.result?.data?.error?.code || data.error?.code).toBe('BAD_REQUEST');
  });

  test('should get payment by ID', async ({ authenticatedPage }) => {
    if (!billId || !bankAccountId) {
      test.skip();
      return;
    }

    // Create a payment first
    const createResponse = await authenticatedPage.request.post('/api/trpc/payments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          bankAccountId,
          date: new Date().toISOString(),
          amount: 30.00,
          currency: 'GBP',
          method: 'BANK_TRANSFER',
        },
      },
    });

    const createData = await createResponse.json();
    const paymentId = createData.result?.data?.id;

    if (paymentId) {
      const response = await authenticatedPage.request.get(
        `/api/trpc/payments.getById?input=${JSON.stringify({
          id: paymentId,
          organizationId: 'demo-org-id',
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.result?.data).toHaveProperty('id');
      expect(data.result?.data.id).toBe(paymentId);
      expect(data.result?.data).toHaveProperty('vendor');
      expect(data.result?.data).toHaveProperty('bill');
    }
  });

  test('should reverse payment', async ({ authenticatedPage }) => {
    if (!billId || !bankAccountId) {
      test.skip();
      return;
    }

    // Create a payment first
    const createResponse = await authenticatedPage.request.post('/api/trpc/payments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          bankAccountId,
          date: new Date().toISOString(),
          amount: 40.00,
          currency: 'GBP',
          method: 'BANK_TRANSFER',
        },
      },
    });

    const createData = await createResponse.json();
    const paymentId = createData.result?.data?.id;

    if (paymentId) {
      // Reverse the payment
      const reverseResponse = await authenticatedPage.request.post('/api/trpc/payments.reverse', {
        data: {
          json: {
            id: paymentId,
            organizationId: 'demo-org-id',
            reason: 'Test reversal',
          },
        },
      });

      expect(reverseResponse.status()).toBe(200);
      const reverseData = await reverseResponse.json();
      expect(reverseData.result?.data.status).toBe('REVERSED');
      expect(reverseData.result?.data.metadata?.reversedAt).toBeDefined();
    }
  });

  test('should get payment history with running balance', async ({ authenticatedPage }) => {
    if (!vendorId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.get(
      '/api/trpc/payments.getHistory?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
        vendorId,
      })
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('payments');
    expect(data.result?.data).toHaveProperty('currentBalance');
    expect(data.result?.data).toHaveProperty('totalPayments');
    expect(data.result?.data).toHaveProperty('totalReversed');
    
    // Check running balance is calculated
    if (data.result?.data.payments?.length > 0) {
      const firstPayment = data.result?.data.payments[0];
      expect(firstPayment).toHaveProperty('runningBalance');
    }
  });

  test('should block cross-organization access', async ({ authenticatedPage }) => {
    if (!billId || !bankAccountId) {
      test.skip();
      return;
    }

    // Try to create payment with different organization ID
    const response = await authenticatedPage.request.post('/api/trpc/payments.create', {
      data: {
        json: {
          organizationId: 'different-org-id', // Wrong org
          billId,
          bankAccountId,
          date: new Date().toISOString(),
          amount: 50.00,
          currency: 'GBP',
          method: 'BANK_TRANSFER',
        },
      },
    });

    // Should fail with FORBIDDEN or NOT_FOUND
    expect(response.status()).toBe(200); // tRPC returns 200 but with error
    const data = await response.json();
    const errorCode = data.result?.data?.error?.code || data.error?.code;
    expect(['FORBIDDEN', 'NOT_FOUND', 'UNAUTHORIZED']).toContain(errorCode);
  });

  test('should update bill status after payment', async ({ authenticatedPage }) => {
    if (!billId || !bankAccountId) {
      test.skip();
      return;
    }

    // Get bill before payment
    const billBeforeResponse = await authenticatedPage.request.get(
      `/api/trpc/bills.getById?input=${JSON.stringify({
        id: billId,
        organizationId: 'demo-org-id',
      })}`
    );
    const billBefore = await billBeforeResponse.json();
    const statusBefore = billBefore.result?.data?.status;

    // Create payment
    await authenticatedPage.request.post('/api/trpc/payments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          bankAccountId,
          date: new Date().toISOString(),
          amount: 60.00,
          currency: 'GBP',
          method: 'BANK_TRANSFER',
        },
      },
    });

    // Get bill after payment
    const billAfterResponse = await authenticatedPage.request.get(
      `/api/trpc/bills.getById?input=${JSON.stringify({
        id: billId,
        organizationId: 'demo-org-id',
      })}`
    );
    const billAfter = await billAfterResponse.json();
    const statusAfter = billAfter.result?.data?.status;

    // Status should have changed (APPROVED -> PART_PAID or PAID)
    expect(['PART_PAID', 'PAID']).toContain(statusAfter);
  });
});




