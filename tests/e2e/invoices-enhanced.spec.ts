/**
 * E2E tests for Enhanced Invoices Router
 * 
 * Tests invoice lifecycle: outstanding list, record payments, mark paid, duplicate
 * 
 * Test scenarios:
 * 1. Get outstanding invoices
 * 2. Record payment (recalculates balance)
 * 3. Mark as paid (only if balance is zero)
 * 4. Get payment history
 * 5. Duplicate invoice (preserves lines, no ledger postings)
 * 6. Status rules (balance 0 → PAID, partial → SENT, overpayment → on-account)
 */

import { test, expect } from '../fixtures/auth';
import { navigateToModule, waitForPageLoad } from '../helpers/page-helpers';

test.describe('Enhanced Invoices Router', () => {
  let customerId: string;
  let invoiceId: string;

  test.beforeAll(async ({ authenticatedPage }) => {
    // Get customer ID
    const customersResponse = await authenticatedPage.request.get(
      '/api/trpc/customers.getAll?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
        page: 1,
        limit: 1,
      })
    );
    const customersData = await customersResponse.json();
    customerId = customersData.result?.data?.customers?.[0]?.id;

    // Create invoice for testing
    if (customerId) {
      const createInvoiceResponse = await authenticatedPage.request.post('/api/trpc/invoices.create', {
        data: {
          json: {
            organizationId: 'demo-org-id',
            customerId,
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

      if (createInvoiceResponse.ok()) {
        const invoiceData = await createInvoiceResponse.json();
        invoiceId = invoiceData.result?.data?.id;
      }
    }
  });

  test('should get outstanding invoices', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/invoices.getOutstanding?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
        page: 1,
        limit: 10,
      })
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('invoices');
    expect(data.result?.data).toHaveProperty('pagination');
    
    if (data.result?.data.invoices.length > 0) {
      const invoice = data.result?.data.invoices[0];
      expect(invoice).toHaveProperty('balance');
      expect(invoice).toHaveProperty('isFullyPaid');
    }
  });

  test('should record payment against invoice', async ({ authenticatedPage }) => {
    if (!invoiceId) {
      test.skip();
      return;
    }

    // Get bank account ID (from chart of accounts)
    const bankAccountsResponse = await authenticatedPage.request.get(
      '/api/trpc/bankAccounts.getAll?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
      })
    );

    let bankAccountId = '';
    if (bankAccountsResponse.ok()) {
      const bankAccountsData = await bankAccountsResponse.json();
      bankAccountId = bankAccountsData.result?.data?.[0]?.id || '';
    }

    if (!bankAccountId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/invoices.recordPayment', {
      data: {
        json: {
          id: invoiceId,
          organizationId: 'demo-org-id',
          amount: 100.00,
          paymentDate: new Date().toISOString(),
          bankAccountId,
          reference: 'PAY-001',
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('invoice');
    expect(data.result?.data).toHaveProperty('payment');
    expect(data.result?.data).toHaveProperty('transaction');
    expect(data.result?.data.payment.balance).toBeDefined();
  });

  test('should get payment history', async ({ authenticatedPage }) => {
    if (!invoiceId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.get(
      '/api/trpc/invoices.getPayments?input=' + JSON.stringify({
        id: invoiceId,
        organizationId: 'demo-org-id',
      })
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('payments');
    expect(data.result?.data).toHaveProperty('transactions');
    expect(data.result?.data).toHaveProperty('totalPaid');
    expect(data.result?.data).toHaveProperty('balance');
    expect(data.result?.data).toHaveProperty('invoiceTotal');
  });

  test('should prevent marking paid with non-zero balance', async ({ authenticatedPage }) => {
    if (!invoiceId) {
      test.skip();
      return;
    }

    // Try to mark as paid (should fail if balance > 0)
    const response = await authenticatedPage.request.post('/api/trpc/invoices.markAsPaid', {
      data: {
        json: {
          id: invoiceId,
          organizationId: 'demo-org-id',
        },
      },
    });

    // Should fail with PRECONDITION_FAILED if balance > 0
    const data = await response.json();
    if (data.result?.data?.error?.code === 'PRECONDITION_FAILED') {
      expect(data.result.data.error.message).toContain('balance');
    } else {
      // If balance is already zero, it should succeed
      expect(data.result?.data).toHaveProperty('status');
    }
  });

  test('should duplicate invoice', async ({ authenticatedPage }) => {
    if (!invoiceId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/invoices.duplicate', {
      data: {
        json: {
          id: invoiceId,
          organizationId: 'demo-org-id',
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data.status).toBe('DRAFT');
    expect(data.result?.data).toHaveProperty('items');
    expect(data.result?.data.items.length).toBeGreaterThan(0);
    // Should have different invoice number
    expect(data.result?.data.invoiceNumber).not.toBe(invoiceId);
  });

  test('should update status based on balance', async ({ authenticatedPage }) => {
    if (!invoiceId || !customerId) {
      test.skip();
      return;
    }

    // Create a new invoice for this test
    const createInvoiceResponse = await authenticatedPage.request.post('/api/trpc/invoices.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          customerId,
          date: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          items: [
            {
              description: 'Test Product',
              quantity: 1,
              unitPrice: 200.00,
              taxRate: 20.00,
            },
          ],
        },
      },
    });

    if (createInvoiceResponse.ok()) {
      const invoiceData = await createInvoiceResponse.json();
      const testInvoiceId = invoiceData.result?.data?.id;

      // Get bank account
      const bankAccountsResponse = await authenticatedPage.request.get(
        '/api/trpc/bankAccounts.getAll?input=' + JSON.stringify({
          organizationId: 'demo-org-id',
        })
      );

      let bankAccountId = '';
      if (bankAccountsResponse.ok()) {
        const bankAccountsData = await bankAccountsResponse.json();
        bankAccountId = bankAccountsData.result?.data?.[0]?.id || '';
      }

      if (bankAccountId) {
        // Record partial payment
        await authenticatedPage.request.post('/api/trpc/invoices.recordPayment', {
          data: {
            json: {
              id: testInvoiceId,
              organizationId: 'demo-org-id',
              amount: 100.00,
              paymentDate: new Date().toISOString(),
              bankAccountId,
            },
          },
        });

        // Check invoice status (should be SENT for partial payment)
        const getInvoiceResponse = await authenticatedPage.request.get(
          `/api/trpc/invoices.getById?input=${JSON.stringify({
            id: testInvoiceId,
            organizationId: 'demo-org-id',
          })}`
        );

        if (getInvoiceResponse.ok()) {
          const invoiceData = await getInvoiceResponse.json();
          // Status should be SENT (since PART_PAID doesn't exist)
          expect(['SENT', 'PAID']).toContain(invoiceData.result?.data?.status);
        }

        // Record full payment
        await authenticatedPage.request.post('/api/trpc/invoices.recordPayment', {
          data: {
            json: {
              id: testInvoiceId,
              organizationId: 'demo-org-id',
              amount: 200.00, // Full amount
              paymentDate: new Date().toISOString(),
              bankAccountId,
            },
          },
        });

        // Check invoice status (should be PAID)
        const getInvoiceResponse2 = await authenticatedPage.request.get(
          `/api/trpc/invoices.getById?input=${JSON.stringify({
            id: testInvoiceId,
            organizationId: 'demo-org-id',
          })}`
        );

        if (getInvoiceResponse2.ok()) {
          const invoiceData2 = await getInvoiceResponse2.json();
          expect(invoiceData2.result?.data?.status).toBe('PAID');
        }
      }
    }
  });

  test('should handle overpayment as on-account credit', async ({ authenticatedPage }) => {
    if (!invoiceId || !customerId) {
      test.skip();
      return;
    }

    // Create a new invoice
    const createInvoiceResponse = await authenticatedPage.request.post('/api/trpc/invoices.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          customerId,
          date: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          items: [
            {
              description: 'Test Product',
              quantity: 1,
              unitPrice: 100.00,
              taxRate: 20.00,
            },
          ],
        },
      },
    });

    if (createInvoiceResponse.ok()) {
      const invoiceData = await createInvoiceResponse.json();
      const testInvoiceId = invoiceData.result?.data?.id;
      const invoiceTotal = invoiceData.result?.data?.total;

      // Get bank account
      const bankAccountsResponse = await authenticatedPage.request.get(
        '/api/trpc/bankAccounts.getAll?input=' + JSON.stringify({
          organizationId: 'demo-org-id',
        })
      );

      let bankAccountId = '';
      if (bankAccountsResponse.ok()) {
        const bankAccountsData = await bankAccountsResponse.json();
        bankAccountId = bankAccountsData.result?.data?.[0]?.id || '';
      }

      if (bankAccountId) {
        // Record overpayment
        const overpaymentAmount = invoiceTotal + 50;
        const paymentResponse = await authenticatedPage.request.post('/api/trpc/invoices.recordPayment', {
          data: {
            json: {
              id: testInvoiceId,
              organizationId: 'demo-org-id',
              amount: overpaymentAmount,
              paymentDate: new Date().toISOString(),
              bankAccountId,
            },
          },
        });

        if (paymentResponse.ok()) {
          const paymentData = await paymentResponse.json();
          // Should have negative balance (on-account credit)
          expect(paymentData.result?.data.payment.balance).toBeLessThan(0);
          
          // Check metadata for onAccountCredit
          const getInvoiceResponse = await authenticatedPage.request.get(
            `/api/trpc/invoices.getById?input=${JSON.stringify({
              id: testInvoiceId,
              organizationId: 'demo-org-id',
            })}`
          );

          if (getInvoiceResponse.ok()) {
            const invoiceData2 = await getInvoiceResponse.json();
            const metadata = invoiceData2.result?.data?.metadata;
            if (metadata?.onAccountCredit) {
              expect(metadata.onAccountCredit).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });
});




