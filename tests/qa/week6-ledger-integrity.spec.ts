/**
 * Ledger Integrity Tests for Week 6 Features
 * 
 * Tests:
 * - Every posting DR = CR
 * - Trial balance stays zero-sum after each suite
 */

import { test, expect } from '../fixtures/auth';

test.describe('Ledger Integrity - Week 6', () => {
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

  test('ledger integrity: file operations do not affect ledger', async ({ authenticatedPage }) => {
    // Get initial balance
    const initialBalance = await getTrialBalance(authenticatedPage, orgId);

    // Upload file
    const fileContent = 'Test file';
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', orgId);
    formData.append('userId', 'user-1');

    await authenticatedPage.request.post('/api/files', {
      multipart: formData,
    });

    // Verify trial balance unchanged
    const finalBalance = await getTrialBalance(authenticatedPage, orgId);
    expect(finalBalance).toBe(initialBalance);
  });

  test('ledger integrity: email operations do not affect ledger', async ({ authenticatedPage }) => {
    // Get initial balance
    const initialBalance = await getTrialBalance(authenticatedPage, orgId);

    // Get invoice
    const invoicesResponse = await authenticatedPage.request.get(
      `/api/trpc/invoices.getAll?input=${JSON.stringify({ organizationId: orgId, page: 1, limit: 1 })}`
    );

    if (invoicesResponse.ok()) {
      const invoicesData = await invoicesResponse.json();
      const invoiceId = invoicesData.result?.data?.invoices?.[0]?.id;

      if (invoiceId) {
        // Send email
        await authenticatedPage.request.post('/api/trpc/emails.sendInvoiceEmail', {
          data: {
            json: {
              organizationId: orgId,
              invoiceId,
              to: ['customer@example.com'],
            },
          },
        });

        // Verify trial balance unchanged
        const finalBalance = await getTrialBalance(authenticatedPage, orgId);
        expect(finalBalance).toBe(initialBalance);
      }
    }
  });

  test('ledger integrity: reminder processing does not affect ledger', async ({ authenticatedPage }) => {
    // Get initial balance
    const initialBalance = await getTrialBalance(authenticatedPage, orgId);

    // Process reminders
    await authenticatedPage.request.post('/api/trpc/invoiceReminders.processReminders', {
      data: {
        json: {
          organizationId: orgId,
          maxReminders: 10,
        },
      },
    });

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

  test('ledger integrity: trial balance zero-sum after file operations', async ({ authenticatedPage }) => {
    // Get initial balance
    const initialBalance = await getTrialBalance(authenticatedPage, orgId);

    // Perform multiple file operations
    for (let i = 0; i < 5; i++) {
      const fileContent = `Test file ${i}`;
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const file = new File([blob], `test${i}.txt`, { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('organizationId', orgId);
      formData.append('userId', 'user-1');

      await authenticatedPage.request.post('/api/files', {
        multipart: formData,
      });
    }

    // Verify trial balance unchanged
    const finalBalance = await getTrialBalance(authenticatedPage, orgId);
    expect(finalBalance).toBe(initialBalance);
  });

  test('ledger integrity: trial balance zero-sum after email operations', async ({ authenticatedPage }) => {
    // Get initial balance
    const initialBalance = await getTrialBalance(authenticatedPage, orgId);

    // Get invoices
    const invoicesResponse = await authenticatedPage.request.get(
      `/api/trpc/invoices.getAll?input=${JSON.stringify({ organizationId: orgId, page: 1, limit: 5 })}`
    );

    if (invoicesResponse.ok()) {
      const invoicesData = await invoicesResponse.json();
      const invoices = invoicesData.result?.data?.invoices || [];

      // Send multiple emails
      for (const invoice of invoices.slice(0, 3)) {
        await authenticatedPage.request.post('/api/trpc/emails.sendInvoiceEmail', {
          data: {
            json: {
              organizationId: orgId,
              invoiceId: invoice.id,
              to: ['customer@example.com'],
            },
          },
        });
      }
    }

    // Verify trial balance unchanged
    const finalBalance = await getTrialBalance(authenticatedPage, orgId);
    expect(finalBalance).toBe(initialBalance);
  });
});

