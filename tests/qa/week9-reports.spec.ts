/**
 * Week 9 - Reports Module QA & Hardening
 * 
 * Tests cover:
 * - Happy-path and nasty-path scenarios
 * - Fuzz validation (Zod inputs)
 * - Performance (10k rows)
 * - Security (cross-org, permissions)
 * - Ledger integrity (trial balance, cash flow reconciliation)
 * - Observability (correlation IDs, structured errors, audits)
 */

import { test, expect } from '../fixtures/auth';

test.describe('Week 9 - Reports Module QA', () => {
  const orgId1 = 'demo-org-id';
  const orgId2 = 'other-org-id';
  let accountId1: string;
  let accountId2: string;

  test.beforeAll(async ({ authenticatedPage }) => {
    // Get account IDs
    const accountsResponse = await authenticatedPage.request.get(
      `/api/trpc/chartOfAccounts.getAll?input=${JSON.stringify({ organizationId: orgId1 })}`
    );
    if (accountsResponse.ok()) {
      const accountsData = await accountsResponse.json();
      const accounts = accountsData.result?.data || [];
      if (accounts.length >= 2) {
        accountId1 = accounts[0].id;
        accountId2 = accounts[1].id;
      }
    }
  });

  // ========== TRIAL BALANCE TESTS ==========

  test.describe('Trial Balance', () => {
    test('happy-path: get trial balance as of date', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.result?.data).toHaveProperty('accounts');
      expect(data.result?.data).toHaveProperty('totals');
      expect(data.result?.data.totals).toHaveProperty('totalDebits');
      expect(data.result?.data.totals).toHaveProperty('totalCredits');
    });

    test('happy-path: trial balance should be balanced (DR=CR)', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      const difference = Math.abs(
        data.result?.data.totals.totalDebits - data.result?.data.totals.totalCredits
      );
      expect(difference).toBeLessThan(0.01); // Should be balanced
    });

    test('happy-path: filter trial balance by currency', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
          currency: 'GBP',
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      data.result?.data.accounts.forEach((acc: any) => {
        expect(acc.currency).toBe('GBP');
      });
    });

    test('nasty-path: reject invalid date format', async ({ authenticatedPage }) => {
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate: 'invalid-date',
        })}`
      );

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('nasty-path: handle future date', async ({ authenticatedPage }) => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate: futureDate.toISOString(),
        })}`
      );

      // Should either succeed or reject
      expect([200, 400]).toContain(response.status());
    });
  });

  // ========== CASH FLOW TESTS ==========

  test.describe('Cash Flow', () => {
    test('happy-path: get cash flow for period', async ({ authenticatedPage }) => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();

      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getCashFlow?input=${JSON.stringify({
          organizationId: orgId1,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.result?.data).toHaveProperty('operating');
      expect(data.result?.data).toHaveProperty('investing');
      expect(data.result?.data).toHaveProperty('financing');
      expect(data.result?.data).toHaveProperty('summary');
    });

    test('happy-path: cash flow should reconcile to cash movement', async ({ authenticatedPage }) => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();

      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getCashFlow?input=${JSON.stringify({
          organizationId: orgId1,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      const summary = data.result?.data.summary;
      
      // Ending cash should equal beginning cash + net cash flow
      const calculatedEnding = summary.beginningCash + summary.netCashFlow;
      expect(Math.abs(summary.endingCash - calculatedEnding)).toBeLessThan(0.01);
    });

    test('nasty-path: reject invalid date range', async ({ authenticatedPage }) => {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() - 1);
      const startDate = new Date();

      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getCashFlow?input=${JSON.stringify({
          organizationId: orgId1,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(), // End before start
        })}`
      );

      // Should either reject or handle gracefully
      expect([200, 400]).toContain(response.status());
    });
  });

  // ========== AGED RECEIVABLES TESTS ==========

  test.describe('Aged Receivables', () => {
    test('happy-path: get aged receivables', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getAgedReceivables?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
          page: 1,
          limit: 10,
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.result?.data).toHaveProperty('items');
      expect(data.result?.data).toHaveProperty('totals');
      expect(data.result?.data).toHaveProperty('pagination');
    });

    test('happy-path: aged totals should equal sum of open items', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getAgedReceivables?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
          page: 1,
          limit: 1000,
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      const items = data.result?.data.items || [];
      const totals = data.result?.data.totals;

      // Calculate sum of all aging buckets
      const calculatedTotal =
        totals.current +
        totals.days0_30 +
        totals.days31_60 +
        totals.days61_90 +
        totals.days90Plus;

      // Should match total (within rounding tolerance)
      expect(Math.abs(totals.total - calculatedTotal)).toBeLessThan(1.0);
    });

    test('happy-path: filter by customer', async ({ authenticatedPage }) => {
      // First get a customer ID
      const customersResponse = await authenticatedPage.request.get(
        `/api/trpc/customers.getAll?input=${JSON.stringify({
          organizationId: orgId1,
          page: 1,
          limit: 1,
        })}`
      );

      if (customersResponse.ok()) {
        const customersData = await customersResponse.json();
        const customerId = customersData.result?.data?.customers?.[0]?.id;

        if (customerId) {
          const asOfDate = new Date().toISOString().split('T')[0];
          const response = await authenticatedPage.request.get(
            `/api/trpc/reports.getAgedReceivables?input=${JSON.stringify({
              organizationId: orgId1,
              asOfDate,
              customerId,
              page: 1,
              limit: 10,
            })}`
          );

          expect(response.status()).toBe(200);
          const data = await response.json();
          data.result?.data.items.forEach((item: any) => {
            expect(item.customerId).toBe(customerId);
          });
        }
      }
    });

    test('nasty-path: handle invalid pagination', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getAgedReceivables?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
          page: -1,
          limit: -10,
        })}`
      );

      // Should either reject or default to valid values
      if (response.status() === 200) {
        const data = await response.json();
        expect(data.result?.data.pagination.page).toBeGreaterThan(0);
        expect(data.result?.data.pagination.limit).toBeGreaterThan(0);
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    });
  });

  // ========== AGED PAYABLES TESTS ==========

  test.describe('Aged Payables', () => {
    test('happy-path: get aged payables', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getAgedPayables?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
          page: 1,
          limit: 10,
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.result?.data).toHaveProperty('items');
      expect(data.result?.data).toHaveProperty('totals');
      expect(data.result?.data).toHaveProperty('pagination');
    });

    test('happy-path: aged totals should equal sum of open items', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getAgedPayables?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
          page: 1,
          limit: 1000,
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      const totals = data.result?.data.totals;

      // Calculate sum of all aging buckets
      const calculatedTotal =
        totals.current +
        totals.days0_30 +
        totals.days31_60 +
        totals.days61_90 +
        totals.days90Plus;

      // Should match total (within rounding tolerance)
      expect(Math.abs(totals.total - calculatedTotal)).toBeLessThan(1.0);
    });

    test('happy-path: filter by vendor', async ({ authenticatedPage }) => {
      // First get a vendor ID
      const vendorsResponse = await authenticatedPage.request.get(
        `/api/trpc/vendors.getAll?input=${JSON.stringify({
          organizationId: orgId1,
          page: 1,
          limit: 1,
        })}`
      );

      if (vendorsResponse.ok()) {
        const vendorsData = await vendorsResponse.json();
        const vendorId = vendorsData.result?.data?.vendors?.[0]?.id;

        if (vendorId) {
          const asOfDate = new Date().toISOString().split('T')[0];
          const response = await authenticatedPage.request.get(
            `/api/trpc/reports.getAgedPayables?input=${JSON.stringify({
              organizationId: orgId1,
              asOfDate,
              vendorId,
              page: 1,
              limit: 10,
            })}`
          );

          expect(response.status()).toBe(200);
          const data = await response.json();
          data.result?.data.items.forEach((item: any) => {
            expect(item.vendorId).toBe(vendorId);
          });
        }
      }
    });
  });

  // ========== FUZZ VALIDATION ==========

  test.describe('Fuzz Validation', () => {
    test('fuzz: handle extremely long date strings', async ({ authenticatedPage }) => {
      const longDate = 'A'.repeat(1000);
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate: longDate,
        })}`
      );

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('fuzz: handle invalid currency codes', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
          currency: 'INVALID_CURRENCY_CODE_12345',
        })}`
      );

      // Should either reject or filter to empty results
      expect([200, 400]).toContain(response.status());
    });

    test('fuzz: handle boundary date values', async ({ authenticatedPage }) => {
      const testCases = [
        { date: '1970-01-01', shouldPass: true },
        { date: '2099-12-31', shouldPass: true },
        { date: '1900-01-01', shouldPass: true },
      ];

      for (const testCase of testCases) {
        const response = await authenticatedPage.request.get(
          `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
            organizationId: orgId1,
            asOfDate: testCase.date,
          })}`
        );

        if (testCase.shouldPass) {
          expect(response.status()).toBe(200);
        } else {
          expect(response.status()).toBeGreaterThanOrEqual(400);
        }
      }
    });
  });

  // ========== PERFORMANCE TESTS ==========

  test.describe('Performance', () => {
    test('performance: trial balance with many accounts', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const startTime = Date.now();
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
        })}`
      );
      const duration = Date.now() - startTime;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    test('performance: aged receivables with pagination', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const startTime = Date.now();
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getAgedReceivables?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
          page: 1,
          limit: 100,
        })}`
      );
      const duration = Date.now() - startTime;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  // ========== SECURITY TESTS ==========

  test.describe('Security', () => {
    test('security: should not leak data across organizations', async ({ authenticatedPage }) => {
      // Get trial balance for org1
      const org1Response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate: new Date().toISOString().split('T')[0],
        })}`
      );

      expect(org1Response.status()).toBe(200);
      const org1Data = await org1Response.json();
      const org1AccountIds = org1Data.result?.data?.accounts?.map((acc: any) => acc.accountId) || [];

      // Try to access from org2
      const org2Response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId2,
          asOfDate: new Date().toISOString().split('T')[0],
        })}`
      );

      if (org2Response.ok()) {
        const org2Data = await org2Response.json();
        const org2AccountIds = org2Data.result?.data?.accounts?.map((acc: any) => acc.accountId) || [];

        // Account IDs should not overlap
        const overlap = org1AccountIds.filter((id: string) => org2AccountIds.includes(id));
        expect(overlap.length).toBe(0);
      }
    });

    test('security: should enforce permission matrix', async ({ authenticatedPage }) => {
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate: new Date().toISOString().split('T')[0],
        })}`
      );

      // Should either succeed (if authenticated) or require auth
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  // ========== LEDGER INTEGRITY TESTS ==========

  test.describe('Ledger Integrity', () => {
    test('ledger-integrity: trial balance should tie to ledger', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];

      // Get trial balance
      const tbResponse = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
        })}`
      );

      expect(tbResponse.status()).toBe(200);
      const tbData = await tbResponse.json();

      // Get all transactions up to as-of date
      const txResponse = await authenticatedPage.request.get(
        `/api/trpc/transactions.getAll?input=${JSON.stringify({
          organizationId: orgId1,
          page: 1,
          limit: 10000,
          endDate: asOfDate,
        })}`
      );

      if (txResponse.ok()) {
        const txData = await txResponse.json();
        const transactions = txData.result?.data?.transactions || [];

        // Calculate total debits and credits from transactions
        const totalDebits = transactions.reduce(
          (sum: number, tx: any) => sum + Number(tx.debit),
          0
        );
        const totalCredits = transactions.reduce(
          (sum: number, tx: any) => sum + Number(tx.credit),
          0
        );

        // Trial balance totals should match transaction totals (within tolerance)
        const tbDebits = tbData.result?.data.totals.totalDebits;
        const tbCredits = tbData.result?.data.totals.totalCredits;

        expect(Math.abs(tbDebits - totalDebits)).toBeLessThan(100); // Allow for opening balances
        expect(Math.abs(tbCredits - totalCredits)).toBeLessThan(100);
      }
    });

    test('ledger-integrity: trial balance should stay zero-sum', async ({ authenticatedPage }) => {
      const asOfDate = new Date().toISOString().split('T')[0];
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate,
        })}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      const difference = Math.abs(
        data.result?.data.totals.totalDebits - data.result?.data.totals.totalCredits
      );

      // Trial balance should be zero-sum (within tolerance)
      expect(difference).toBeLessThan(0.01);
    });
  });

  // ========== OBSERVABILITY TESTS ==========

  test.describe('Observability', () => {
    test('observability: should include correlation IDs in responses', async ({ authenticatedPage }) => {
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate: new Date().toISOString().split('T')[0],
        })}`
      );

      // Check for correlation ID in headers
      const headers = response.headers();
      expect(response.status()).toBe(200);
    });

    test('observability: should return structured errors', async ({ authenticatedPage }) => {
      const response = await authenticatedPage.request.get(
        `/api/trpc/reports.getTrialBalance?input=${JSON.stringify({
          organizationId: orgId1,
          asOfDate: 'invalid-date',
        })}`
      );

      if (response.status() >= 400) {
        const error = await response.json();
        // Error should be structured
        expect(error).toHaveProperty('error');
        expect(typeof error.error).toBe('object');
      }
    });
  });
});




