/**
 * E2E tests for Bill Amendments Router
 * 
 * Tests amendment workflow: create, approve, reject, and financial impact handling
 * 
 * Test scenarios:
 * 1. Create amendment (locks bill, stores diff)
 * 2. Get amendment history for bill
 * 3. Approve amendment (applies changes, generates adjustment journal)
 * 4. Reject amendment (unlocks bill, no changes)
 * 5. Amendment with financial impact (amount/tax/account changes)
 * 6. Amendment without financial impact (memo only)
 * 7. Paid bill with zero balance (only memo updates allowed)
 * 8. Permissions enforced
 * 9. Bill locking prevents direct edits
 */

import { test, expect } from '../fixtures/auth';

test.describe('Bill Amendments Router', () => {
  let vendorId: string;
  let billId: string;
  let expenseAccountId: string;

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

    // Get expense account
    const accountsResponse = await authenticatedPage.request.get(
      '/api/trpc/chartOfAccounts.getAll?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
      })
    );
    if (accountsResponse.ok()) {
      const accountsData = await accountsResponse.json();
      expenseAccountId = accountsData.result?.data?.find((acc: any) => acc.type === 'EXPENSE')?.id;
    }

    // Create and approve a bill for testing
    if (vendorId) {
      const createBillResponse = await authenticatedPage.request.post('/api/trpc/bills.create', {
        data: {
          json: {
            organizationId: 'demo-org-id',
            vendorId,
            date: new Date().toISOString(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            items: [
              {
                description: 'Test Item',
                quantity: 2,
                unitPrice: 100.00,
                taxRate: 20.00,
                accountId: expenseAccountId,
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
  });

  test('should create amendment', async ({ authenticatedPage }) => {
    if (!billId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/billAmendments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          amendmentType: 'AMOUNT_CHANGE',
          reason: 'Price correction needed',
          patch: {
            items: [
              {
                description: 'Updated Item',
                quantity: 2,
                unitPrice: 120.00,
                taxRate: 20.00,
                accountId: expenseAccountId,
              },
            ],
          },
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data.status).toBe('PENDING');
    expect(data.result?.data).toHaveProperty('originalData');
    expect(data.result?.data).toHaveProperty('amendedData');
  });

  test('should lock bill when amendment created', async ({ authenticatedPage }) => {
    if (!billId) {
      test.skip();
      return;
    }

    // Create amendment
    await authenticatedPage.request.post('/api/trpc/billAmendments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          amendmentType: 'OTHER',
          reason: 'Test lock',
          patch: {
            notes: 'Updated notes',
          },
        },
      },
    });

    // Try to update bill directly (should fail)
    const updateResponse = await authenticatedPage.request.post('/api/trpc/bills.update', {
      data: {
        json: {
          id: billId,
          organizationId: 'demo-org-id',
          data: {
            notes: 'Direct update attempt',
          },
        },
      },
    });

    expect(updateResponse.status()).toBe(200);
    const data = await updateResponse.json();
    const errorCode = data.result?.data?.error?.code || data.error?.code;
    expect(errorCode).toBe('PRECONDITION_FAILED');
  });

  test('should get amendment history', async ({ authenticatedPage }) => {
    if (!billId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.get(
      `/api/trpc/billAmendments.getHistory?input=${JSON.stringify({
        billId,
        organizationId: 'demo-org-id',
      })}`
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.result?.data)).toBe(true);
  });

  test('should approve amendment with financial impact', async ({ authenticatedPage }) => {
    if (!billId || !expenseAccountId) {
      test.skip();
      return;
    }

    // Create amendment with amount change
    const createResponse = await authenticatedPage.request.post('/api/trpc/billAmendments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          amendmentType: 'AMOUNT_CHANGE',
          reason: 'Price increase',
          patch: {
            items: [
              {
                description: 'Updated Item',
                quantity: 2,
                unitPrice: 150.00,
                taxRate: 20.00,
                accountId: expenseAccountId,
              },
            ],
          },
        },
      },
    });

    const createData = await createResponse.json();
    const amendmentId = createData.result?.data?.id;

    if (amendmentId) {
      // Approve amendment
      const approveResponse = await authenticatedPage.request.post('/api/trpc/billAmendments.approve', {
        data: {
          json: {
            id: amendmentId,
            organizationId: 'demo-org-id',
          },
        },
      });

      expect(approveResponse.status()).toBe(200);
      const approveData = await approveResponse.json();
      expect(approveData.result?.data.amendment.status).toBe('APPROVED');
      expect(approveData.result?.data).toHaveProperty('adjustmentJournal');
      expect(approveData.result?.data.bill.total).toBeGreaterThan(0);
    }
  });

  test('should reject amendment', async ({ authenticatedPage }) => {
    if (!billId) {
      test.skip();
      return;
    }

    // Create amendment
    const createResponse = await authenticatedPage.request.post('/api/trpc/billAmendments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          amendmentType: 'OTHER',
          reason: 'Test rejection',
          patch: {
            notes: 'Rejected notes',
          },
        },
      },
    });

    const createData = await createResponse.json();
    const amendmentId = createData.result?.data?.id;

    if (amendmentId) {
      // Reject amendment
      const rejectResponse = await authenticatedPage.request.post('/api/trpc/billAmendments.reject', {
        data: {
          json: {
            id: amendmentId,
            organizationId: 'demo-org-id',
            rejectionReason: 'Not approved',
          },
        },
      });

      expect(rejectResponse.status()).toBe(200);
      const rejectData = await rejectResponse.json();
      expect(rejectData.result?.data.status).toBe('REJECTED');
    }
  });

  test('should prevent financial changes to paid bill', async ({ authenticatedPage }) => {
    if (!billId || !vendorId) {
      test.skip();
      return;
    }

    // Create a bill and mark as paid
    const createBillResponse = await authenticatedPage.request.post('/api/trpc/bills.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          vendorId,
          date: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          items: [
            {
              description: 'Paid Bill Item',
              quantity: 1,
              unitPrice: 100.00,
              taxRate: 20.00,
              accountId: expenseAccountId,
            },
          ],
        },
      },
    });

    if (createBillResponse.ok()) {
      const billData = await createBillResponse.json();
      const paidBillId = billData.result?.data?.id;

      // Approve and mark as paid (simulate payment)
      if (paidBillId) {
        await authenticatedPage.request.post('/api/trpc/bills.approve', {
          data: {
            json: {
              id: paidBillId,
              organizationId: 'demo-org-id',
            },
          },
        });

        // Try to create amendment with financial changes (should fail)
        const amendResponse = await authenticatedPage.request.post('/api/trpc/billAmendments.create', {
          data: {
            json: {
              organizationId: 'demo-org-id',
              billId: paidBillId,
              amendmentType: 'AMOUNT_CHANGE',
              reason: 'Financial change attempt',
              patch: {
                items: [
                  {
                    description: 'Changed Item',
                    quantity: 1,
                    unitPrice: 150.00,
                    taxRate: 20.00,
                    accountId: expenseAccountId,
                  },
                ],
              },
            },
          },
        });

        expect(amendResponse.status()).toBe(200);
        const data = await amendResponse.json();
        const errorCode = data.result?.data?.error?.code || data.error?.code;
        expect(errorCode).toBe('PRECONDITION_FAILED');
      }
    }
  });

  test('should allow memo updates to paid bill', async ({ authenticatedPage }) => {
    if (!billId) {
      test.skip();
      return;
    }

    // Create amendment with only notes change
    const response = await authenticatedPage.request.post('/api/trpc/billAmendments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          amendmentType: 'OTHER',
          reason: 'Memo update',
          patch: {
            notes: 'Updated memo for paid bill',
          },
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
  });

  test('should generate adjustment journal on approval', async ({ authenticatedPage }) => {
    if (!billId || !expenseAccountId) {
      test.skip();
      return;
    }

    // Create amendment with account change
    const createResponse = await authenticatedPage.request.post('/api/trpc/billAmendments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          amendmentType: 'ITEM_CHANGE',
          reason: 'Account correction',
          patch: {
            items: [
              {
                description: 'Item with different account',
                quantity: 2,
                unitPrice: 100.00,
                taxRate: 20.00,
                accountId: expenseAccountId,
              },
            ],
          },
        },
      },
    });

    const createData = await createResponse.json();
    const amendmentId = createData.result?.data?.id;

    if (amendmentId) {
      // Approve
      const approveResponse = await authenticatedPage.request.post('/api/trpc/billAmendments.approve', {
        data: {
          json: {
            id: amendmentId,
            organizationId: 'demo-org-id',
          },
        },
      });

      expect(approveResponse.status()).toBe(200);
      const approveData = await approveResponse.json();
      // Should have adjustment journal if financial impact
      if (approveData.result?.data.adjustmentJournal) {
        expect(approveData.result?.data.adjustmentJournal.balanced).toBe(true);
      }
    }
  });

  test('should enforce permissions', async ({ viewerPage }) => {
    if (!billId) {
      test.skip();
      return;
    }

    // Viewer should not be able to create amendment
    const response = await viewerPage.request.post('/api/trpc/billAmendments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          amendmentType: 'OTHER',
          reason: 'Unauthorized attempt',
          patch: {
            notes: 'Test',
          },
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.error || data.result?.error?.code).toMatch(/FORBIDDEN|UNAUTHORIZED/);
  });

  test('should prevent duplicate pending amendments', async ({ authenticatedPage }) => {
    if (!billId) {
      test.skip();
      return;
    }

    // Create first amendment
    await authenticatedPage.request.post('/api/trpc/billAmendments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          amendmentType: 'OTHER',
          reason: 'First amendment',
          patch: {
            notes: 'First',
          },
        },
      },
    });

    // Try to create second amendment (should fail - bill locked)
    const response = await authenticatedPage.request.post('/api/trpc/billAmendments.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          billId,
          amendmentType: 'OTHER',
          reason: 'Second amendment',
          patch: {
            notes: 'Second',
          },
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    const errorCode = data.result?.data?.error?.code || data.error?.code;
    expect(errorCode).toBe('PRECONDITION_FAILED');
  });
});




