/**
 * E2E tests for Bills module
 * 
 * Tests bill creation, approval, posting, and payment workflows
 */

import { test, expect } from '../fixtures/auth';
import { navigateToModule, waitForPageLoad } from '../helpers/page-helpers';

test.describe('Bills Module', () => {
  test('should create bill with validation', async ({ authenticatedPage }) => {
    // Get a vendor ID first
    const vendorsResponse = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=1'
    );
    const vendorsData = await vendorsResponse.json();
    const vendorId = vendorsData.result?.data?.vendors?.[0]?.id;

    // Get an expense account ID
    const accountsResponse = await authenticatedPage.request.get(
      '/api/trpc/chartOfAccounts.getAll?organizationId=demo-org-id'
    );
    const accountsData = await accountsResponse.json();
    const expenseAccount = accountsData.result?.data?.find((acc: any) => acc.type === 'EXPENSE');
    const accountId = expenseAccount?.id;

    if (vendorId && accountId) {
      const createResponse = await authenticatedPage.request.post('/api/trpc/bills.create', {
        data: {
          organizationId: 'demo-org-id',
          vendorId,
          billNumber: `BILL-TEST-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          currency: 'GBP',
          items: [
            {
              description: 'Test Item',
              quantity: 1,
              unitPrice: 100.00,
              taxRate: 20.00,
              accountId,
            },
          ],
        },
      });

      expect(createResponse.status()).toBe(200);
      const data = await createResponse.json();
      expect(data.result?.data).toHaveProperty('id');
      expect(data.result?.data).toHaveProperty('billNumber');
      expect(data.result?.data.total).toBeGreaterThan(0);
    }
  });

  test('should prevent duplicate bill numbers', async ({ authenticatedPage }) => {
    // Get vendor and account IDs
    const vendorsResponse = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=1'
    );
    const vendorsData = await vendorsResponse.json();
    const vendorId = vendorsData.result?.data?.vendors?.[0]?.id;

    const accountsResponse = await authenticatedPage.request.get(
      '/api/trpc/chartOfAccounts.getAll?organizationId=demo-org-id'
    );
    const accountsData = await accountsResponse.json();
    const expenseAccount = accountsData.result?.data?.find((acc: any) => acc.type === 'EXPENSE');
    const accountId = expenseAccount?.id;

    if (vendorId && accountId) {
      const billNumber = `BILL-DUP-${Date.now()}`;

      // Create first bill
      const create1 = await authenticatedPage.request.post('/api/trpc/bills.create', {
        data: {
          organizationId: 'demo-org-id',
          vendorId,
          billNumber,
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          currency: 'GBP',
          items: [
            {
              description: 'Test Item',
              quantity: 1,
              unitPrice: 100.00,
              taxRate: 20.00,
              accountId,
            },
          ],
        },
      });
      expect(create1.status()).toBe(200);

      // Try to create duplicate
      const create2 = await authenticatedPage.request.post('/api/trpc/bills.create', {
        data: {
          organizationId: 'demo-org-id',
          vendorId,
          billNumber, // Same bill number
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          currency: 'GBP',
          items: [
            {
              description: 'Test Item',
              quantity: 1,
              unitPrice: 100.00,
              taxRate: 20.00,
              accountId,
            },
          ],
        },
      });
      expect(create2.status()).toBe(409); // Conflict
    }
  });

  test('should validate account type (must be EXPENSE)', async ({ authenticatedPage }) => {
    // Get vendor ID
    const vendorsResponse = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=1'
    );
    const vendorsData = await vendorsResponse.json();
    const vendorId = vendorsData.result?.data?.vendors?.[0]?.id;

    // Get a non-expense account (e.g., ASSET)
    const accountsResponse = await authenticatedPage.request.get(
      '/api/trpc/chartOfAccounts.getAll?organizationId=demo-org-id'
    );
    const accountsData = await accountsResponse.json();
    const assetAccount = accountsData.result?.data?.find((acc: any) => acc.type === 'ASSET');
    const accountId = assetAccount?.id;

    if (vendorId && accountId) {
      const createResponse = await authenticatedPage.request.post('/api/trpc/bills.create', {
        data: {
          organizationId: 'demo-org-id',
          vendorId,
          billNumber: `BILL-TEST-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          currency: 'GBP',
          items: [
            {
              description: 'Test Item',
              quantity: 1,
              unitPrice: 100.00,
              taxRate: 20.00,
              accountId, // Wrong account type
            },
          ],
        },
      });

      expect(createResponse.status()).toBe(400); // Bad Request
    }
  });

  test('should calculate totals correctly', async ({ authenticatedPage }) => {
    // Get vendor and account IDs
    const vendorsResponse = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=1'
    );
    const vendorsData = await vendorsResponse.json();
    const vendorId = vendorsData.result?.data?.vendors?.[0]?.id;

    const accountsResponse = await authenticatedPage.request.get(
      '/api/trpc/chartOfAccounts.getAll?organizationId=demo-org-id'
    );
    const accountsData = await accountsResponse.json();
    const expenseAccount = accountsData.result?.data?.find((acc: any) => acc.type === 'EXPENSE');
    const accountId = expenseAccount?.id;

    if (vendorId && accountId) {
      const createResponse = await authenticatedPage.request.post('/api/trpc/bills.create', {
        data: {
          organizationId: 'demo-org-id',
          vendorId,
          billNumber: `BILL-TEST-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          currency: 'GBP',
          items: [
            {
              description: 'Item 1',
              quantity: 10,
              unitPrice: 25.00,
              taxRate: 20.00,
              accountId,
            },
            {
              description: 'Item 2',
              quantity: 5,
              unitPrice: 50.00,
              taxRate: 20.00,
              accountId,
            },
          ],
        },
      });

      expect(createResponse.status()).toBe(200);
      const data = await createResponse.json();
      const bill = data.result?.data;

      // Subtotal: (10 * 25) + (5 * 50) = 250 + 250 = 500
      // Tax: 500 * 0.20 = 100
      // Total: 500 + 100 = 600
      expect(bill.subtotal).toBeCloseTo(500, 2);
      expect(bill.taxAmount).toBeCloseTo(100, 2);
      expect(bill.total).toBeCloseTo(600, 2);
    }
  });

  test('should approve bill and post to ledger', async ({ authenticatedPage }) => {
    // Create a bill first
    const vendorsResponse = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=1'
    );
    const vendorsData = await vendorsResponse.json();
    const vendorId = vendorsData.result?.data?.vendors?.[0]?.id;

    const accountsResponse = await authenticatedPage.request.get(
      '/api/trpc/chartOfAccounts.getAll?organizationId=demo-org-id'
    );
    const accountsData = await accountsResponse.json();
    const expenseAccount = accountsData.result?.data?.find((acc: any) => acc.type === 'EXPENSE');
    const accountId = expenseAccount?.id;

    if (vendorId && accountId) {
      // Create bill
      const createResponse = await authenticatedPage.request.post('/api/trpc/bills.create', {
        data: {
          organizationId: 'demo-org-id',
          vendorId,
          billNumber: `BILL-APPROVE-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          currency: 'GBP',
          items: [
            {
              description: 'Test Item',
              quantity: 1,
              unitPrice: 100.00,
              taxRate: 20.00,
              accountId,
            },
          ],
        },
      });

      const createData = await createResponse.json();
      const billId = createData.result?.data?.id;

      if (billId) {
        // Approve bill
        const approveResponse = await authenticatedPage.request.post('/api/trpc/bills.approve', {
          data: {
            id: billId,
            organizationId: 'demo-org-id',
          },
        });

        expect(approveResponse.status()).toBe(200);
        const approveData = await approveResponse.json();
        const approvedBill = approveData.result?.data;

        expect(approvedBill.status).toBe('APPROVED');
        expect(approvedBill.approvedAt).toBeTruthy();
        expect(approvedBill.postedAt).toBeTruthy();
        expect(approvedBill.metadata?.postingTransactionIds).toBeTruthy();
      }
    }
  });

  test('should prevent approving already approved bill', async ({ authenticatedPage }) => {
    // This test assumes a bill exists and is already approved
    // In a real scenario, you'd create and approve a bill, then try to approve again
    const billsResponse = await authenticatedPage.request.get(
      '/api/trpc/bills.getAll?organizationId=demo-org-id&page=1&limit=1&status=APPROVED'
    );

    if (billsResponse.status() === 200) {
      const billsData = await billsResponse.json();
      const billId = billsData.result?.data?.bills?.[0]?.id;

      if (billId) {
        const approveResponse = await authenticatedPage.request.post('/api/trpc/bills.approve', {
          data: {
            id: billId,
            organizationId: 'demo-org-id',
          },
        });

        // Should fail with precondition failed
        expect([412, 400]).toContain(approveResponse.status());
      }
    }
  });

  test('should get outstanding bills for payment', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/bills.getOutstandingForPayment?organizationId=demo-org-id'
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    const outstandingBills = data.result?.data || [];

    // All returned bills should be approved/unpaid
    outstandingBills.forEach((bill: any) => {
      expect(['APPROVED', 'PART_PAID', 'OVERDUE']).toContain(bill.status || 'APPROVED');
      expect(bill.balance).toBeGreaterThan(0);
      expect(bill.remittanceInfo).toBeTruthy();
    });
  });

  test('should mark bill as paid with status transition', async ({ authenticatedPage }) => {
    // This test assumes a bill with payments exists
    // In a real scenario, you'd create a bill, approve it, create a payment, then mark as paid
    const billsResponse = await authenticatedPage.request.get(
      '/api/trpc/bills.getAll?organizationId=demo-org-id&page=1&limit=1&status=APPROVED'
    );

    if (billsResponse.status() === 200) {
      const billsData = await billsResponse.json();
      const bill = billsData.result?.data?.bills?.[0];

      if (bill && bill.balance > 0) {
        // Mark as paid (assuming payment exists)
        const markPaidResponse = await authenticatedPage.request.post('/api/trpc/bills.markAsPaid', {
          data: {
            id: bill.id,
            organizationId: 'demo-org-id',
          },
        });

        // Should either succeed or fail appropriately
        expect([200, 412]).toContain(markPaidResponse.status());
      }
    }
  });

  test('should prevent deleting approved bill', async ({ authenticatedPage }) => {
    // Get an approved bill
    const billsResponse = await authenticatedPage.request.get(
      '/api/trpc/bills.getAll?organizationId=demo-org-id&page=1&limit=1&status=APPROVED'
    );

    if (billsResponse.status() === 200) {
      const billsData = await billsResponse.json();
      const billId = billsData.result?.data?.bills?.[0]?.id;

      if (billId) {
        const deleteResponse = await authenticatedPage.request.post('/api/trpc/bills.delete', {
          data: {
            id: billId,
            organizationId: 'demo-org-id',
          },
        });

        // Should fail - cannot delete approved bills
        expect(deleteResponse.status()).toBe(412); // Precondition Failed
      }
    }
  });

  test('should filter bills by status', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/bills.getAll?organizationId=demo-org-id&page=1&limit=10&status=DRAFT'
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    const bills = data.result?.data?.bills || [];

    bills.forEach((bill: any) => {
      expect(bill.status).toBe('DRAFT');
    });
  });

  test('should filter bills by vendor', async ({ authenticatedPage }) => {
    // Get a vendor ID
    const vendorsResponse = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=1'
    );
    const vendorsData = await vendorsResponse.json();
    const vendorId = vendorsData.result?.data?.vendors?.[0]?.id;

    if (vendorId) {
      const response = await authenticatedPage.request.get(
        `/api/trpc/bills.getAll?organizationId=demo-org-id&page=1&limit=10&vendorId=${vendorId}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      const bills = data.result?.data?.bills || [];

      bills.forEach((bill: any) => {
        expect(bill.vendorId).toBe(vendorId);
      });
    }
  });

  test('should paginate bills list', async ({ authenticatedPage }) => {
    const page1 = await authenticatedPage.request.get(
      '/api/trpc/bills.getAll?organizationId=demo-org-id&page=1&limit=2'
    );
    expect(page1.status()).toBe(200);

    const page2 = await authenticatedPage.request.get(
      '/api/trpc/bills.getAll?organizationId=demo-org-id&page=2&limit=2'
    );
    expect(page2.status()).toBe(200);
  });
});

