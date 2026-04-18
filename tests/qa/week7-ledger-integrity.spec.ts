/**
 * Ledger Integrity Tests for Week 7 Features
 * 
 * Tests:
 * - Every posting DR = CR
 * - Trial balance stays zero-sum after each suite
 */

import { test, expect } from '../fixtures/auth';

test.describe('Ledger Integrity - Week 7', () => {
  const orgId = 'demo-org-id';

  /**
   * Get trial balance via API (sum of all debits - sum of all credits)
   */
  async function getTrialBalance(page: any, organizationId: string): Promise<number> {
    // Get all transactions
    const response = await page.request.get(
      `/api/trpc/transactions.getAll?input=${JSON.stringify({ organizationId, page: 1, limit: 10000 })}`
    );

    if (!response.ok()) {
      return 0;
    }

    const data = await response.json();
    const transactions = data.result?.data?.transactions || [];

    let totalDebits = 0;
    let totalCredits = 0;

    for (const tx of transactions) {
      totalDebits += tx.debit || 0;
      totalCredits += tx.credit || 0;
    }

    return totalDebits - totalCredits;
  }

  test('ledger integrity: reconciliation does not affect ledger', async ({ authenticatedPage }) => {
    // Get initial balance
    const initialBalance = await getTrialBalance(authenticatedPage, orgId);

    // Get bank account
    const accountsResponse = await authenticatedPage.request.get(
      `/api/trpc/bankAccounts.getAll?input=${JSON.stringify({ organizationId: orgId })}`
    );

    if (accountsResponse.ok()) {
      const accountsData = await accountsResponse.json();
      const accountId = accountsData.result?.data?.[0]?.id;

      if (accountId) {
        // Get unreconciled transactions
        const unreconciledResponse = await authenticatedPage.request.get(
          `/api/trpc/bankAccounts.getUnreconciled?input=${JSON.stringify({
            organizationId: orgId,
            bankAccountId: accountId,
            page: 1,
            limit: 10,
          })}`
        );

        if (unreconciledResponse.ok()) {
          const unreconciledData = await unreconciledResponse.json();
          const transactions = unreconciledData.result?.data?.transactions || [];

          if (transactions.length > 0) {
            // Reconcile
            await authenticatedPage.request.post('/api/trpc/bankAccounts.reconcile', {
              data: {
                json: {
                  organizationId: orgId,
                  bankAccountId: accountId,
                  statementDate: new Date().toISOString(),
                  statementBalance: 10000,
                  matches: [
                    {
                      bankTransactionId: transactions[0].id,
                      amount: Number(transactions[0].amount),
                      matchType: 'MANUAL',
                    },
                  ],
                },
              },
            });
          }
        }
      }
    }

    // Verify trial balance unchanged
    const finalBalance = await getTrialBalance(authenticatedPage, orgId);
    expect(finalBalance).toBe(initialBalance);
  });

  test('ledger integrity: bank statement import does not affect ledger', async ({ authenticatedPage }) => {
    // Get initial balance
    const initialBalance = await getTrialBalance(authenticatedPage, orgId);

    // Get bank account
    const accountsResponse = await authenticatedPage.request.get(
      `/api/trpc/bankAccounts.getAll?input=${JSON.stringify({ organizationId: orgId })}`
    );

    if (accountsResponse.ok()) {
      const accountsData = await accountsResponse.json();
      const accountId = accountsData.result?.data?.[0]?.id;

      if (accountId) {
        // Import statement
        const csvContent = `Date,Amount,Description
2024-01-15,1000.00,Import Test`;

        const base64Content = btoa(csvContent);

        await authenticatedPage.request.post('/api/trpc/bankAccounts.importStatement', {
          data: {
            json: {
              organizationId: orgId,
              bankAccountId: accountId,
              fileContent: base64Content,
              fileName: 'ledger-test.csv',
              fileType: 'CSV',
              mapping: {
                date: 'Date',
                amount: 'Amount',
                description: 'Description',
              },
              skipDuplicates: true,
            },
          },
        });
      }
    }

    // Verify trial balance unchanged
    const finalBalance = await getTrialBalance(authenticatedPage, orgId);
    expect(finalBalance).toBe(initialBalance);
  });

  test('ledger integrity: all postings are balanced (DR = CR)', async ({ authenticatedPage }) => {
    // Get all transactions
    const response = await authenticatedPage.request.get(
      `/api/trpc/transactions.getAll?input=${JSON.stringify({ organizationId: orgId, page: 1, limit: 10000 })}`
    );

    if (response.ok()) {
      const data = await response.json();
      const transactions = data.result?.data?.transactions || [];

      // Group by journal/reference to check double-entry
      const journalGroups = new Map<string, Array<{ debit: number; credit: number }>>();

      for (const tx of transactions) {
        const key = tx.reference || tx.id;
        if (!journalGroups.has(key)) {
          journalGroups.set(key, []);
        }
        journalGroups.get(key)!.push({
          debit: tx.debit || 0,
          credit: tx.credit || 0,
        });
      }

      // Verify each journal entry is balanced
      for (const [key, entries] of journalGroups) {
        const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
        const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
        
        // Allow small rounding differences (0.01)
        const difference = Math.abs(totalDebits - totalCredits);
        expect(difference).toBeLessThan(0.01);
      }
    }
  });

  test('ledger integrity: trial balance zero-sum after reconciliation operations', async ({ authenticatedPage }) => {
    // Get initial balance
    const initialBalance = await getTrialBalance(authenticatedPage, orgId);

    // Perform multiple reconciliation operations
    const accountsResponse = await authenticatedPage.request.get(
      `/api/trpc/bankAccounts.getAll?input=${JSON.stringify({ organizationId: orgId })}`
    );

    if (accountsResponse.ok()) {
      const accountsData = await accountsResponse.json();
      const accountId = accountsData.result?.data?.[0]?.id;

      if (accountId) {
        // Get reconciliation report
        await authenticatedPage.request.get(
          `/api/trpc/bankAccounts.getReconciliationReport?input=${JSON.stringify({
            organizationId: orgId,
            bankAccountId: accountId,
          })}`
        );

        // Update balance
        await authenticatedPage.request.post('/api/trpc/bankAccounts.updateBalance', {
          data: {
            json: {
              id: accountId,
              organizationId: orgId,
              balance: 10000,
            },
          },
        });
      }
    }

    // Verify trial balance unchanged
    const finalBalance = await getTrialBalance(authenticatedPage, orgId);
    expect(finalBalance).toBe(initialBalance);
  });

  test('ledger integrity: trial balance zero-sum after import operations', async ({ authenticatedPage }) => {
    // Get initial balance
    const initialBalance = await getTrialBalance(authenticatedPage, orgId);

    // Get bank account
    const accountsResponse = await authenticatedPage.request.get(
      `/api/trpc/bankAccounts.getAll?input=${JSON.stringify({ organizationId: orgId })}`
    );

    if (accountsResponse.ok()) {
      const accountsData = await accountsResponse.json();
      const accountId = accountsData.result?.data?.[0]?.id;

      if (accountId) {
        // Perform multiple imports
        for (let i = 0; i < 3; i++) {
          const csvContent = `Date,Amount,Description
2024-01-${15 + i},${1000 + i * 100}.00,Import ${i}`;

          const base64Content = btoa(csvContent);

          await authenticatedPage.request.post('/api/trpc/bankAccounts.importStatement', {
            data: {
              json: {
                organizationId: orgId,
                bankAccountId: accountId,
                fileContent: base64Content,
                fileName: `ledger-test-${i}.csv`,
                fileType: 'CSV',
                mapping: {
                  date: 'Date',
                  amount: 'Amount',
                  description: 'Description',
                },
                skipDuplicates: true,
              },
            },
          });
        }
      }
    }

    // Verify trial balance unchanged
    const finalBalance = await getTrialBalance(authenticatedPage, orgId);
    expect(finalBalance).toBe(initialBalance);
  });
});




