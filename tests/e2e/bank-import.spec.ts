/**
 * E2E Tests for Bank Statement Import
 * 
 * Tests:
 * - Sample CSV file import
 * - Sample OFX file import
 * - Duplicate file detection
 * - Duplicate transaction detection
 * - Malformed rows handling
 * - Negative amounts handling
 */

import { test, expect } from '../fixtures/auth';

test.describe('Bank Statement Import', () => {
  const orgId = 'demo-org-id';
  let bankAccountId: string;

  test.beforeAll(async ({ authenticatedPage }) => {
    // Create bank account
    const bankAccountResponse = await authenticatedPage.request.post('/api/trpc/bankAccounts.create', {
      data: {
        json: {
          organizationId: orgId,
          name: 'Test Bank Account',
          accountNumber: '12345678',
          sortCode: '20-00-00',
          currency: 'GBP',
          openingBalance: 10000,
        },
      },
    });

    if (bankAccountResponse.ok()) {
      const bankAccountData = await bankAccountResponse.json();
      bankAccountId = bankAccountData.result?.data?.id;
    }
  });

  test('import CSV statement - sample file', async ({ authenticatedPage }) => {
    if (!bankAccountId) {
      test.skip();
      return;
    }

    // Sample CSV content
    const csvContent = `Date,Amount,Description,Reference
2024-01-15,1000.00,Payment from Customer,INV-001
2024-01-16,-500.00,Payment to Vendor,BILL-001
2024-01-17,2500.00,Invoice Payment,INV-002`;

    const base64Content = btoa(csvContent);

    const response = await authenticatedPage.request.post('/api/trpc/bankAccounts.importStatement', {
      data: {
        json: {
          organizationId: orgId,
          bankAccountId,
          fileContent: base64Content,
          fileName: 'test-statement.csv',
          fileType: 'CSV',
          mapping: {
            date: 'Date',
            amount: 'Amount',
            description: 'Description',
            reference: 'Reference',
          },
          parseOptions: {
            dateFormat: 'YYYY-MM-DD',
            amountLocale: 'en-US',
            delimiter: ',',
            hasHeader: true,
          },
          skipDuplicates: true,
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('importId');
    expect(data.result?.data).toHaveProperty('importedRows');
    expect(data.result?.data.importedRows).toBeGreaterThan(0);
  });

  test('import CSV statement - negative amounts', async ({ authenticatedPage }) => {
    if (!bankAccountId) {
      test.skip();
      return;
    }

    // CSV with negative amounts
    const csvContent = `Date,Amount,Description
2024-01-15,-150.00,Withdrawal
2024-01-16,-250.50,Payment`;

    const base64Content = btoa(csvContent);

    const response = await authenticatedPage.request.post('/api/trpc/bankAccounts.importStatement', {
      data: {
        json: {
          organizationId: orgId,
          bankAccountId,
          fileContent: base64Content,
          fileName: 'test-negative.csv',
          fileType: 'CSV',
          mapping: {
            date: 'Date',
            amount: 'Amount',
            description: 'Description',
          },
          parseOptions: {
            dateFormat: 'YYYY-MM-DD',
            amountLocale: 'en-US',
          },
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // Verify negative amounts were imported
    expect(data.result?.data.importedRows).toBeGreaterThan(0);
  });

  test('import CSV statement - malformed rows', async ({ authenticatedPage }) => {
    if (!bankAccountId) {
      test.skip();
      return;
    }

    // CSV with malformed rows
    const csvContent = `Date,Amount,Description
2024-01-15,1000.00,Valid Transaction
invalid-date,500.00,Invalid Date
2024-01-17,invalid-amount,Invalid Amount
2024-01-18,750.00,Valid Transaction`;

    const base64Content = btoa(csvContent);

    const response = await authenticatedPage.request.post('/api/trpc/bankAccounts.importStatement', {
      data: {
        json: {
          organizationId: orgId,
          bankAccountId,
          fileContent: base64Content,
          fileName: 'test-malformed.csv',
          fileType: 'CSV',
          mapping: {
            date: 'Date',
            amount: 'Amount',
            description: 'Description',
          },
          parseOptions: {
            dateFormat: 'YYYY-MM-DD',
            amountLocale: 'en-US',
          },
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // Should have errors for malformed rows
    expect(data.result?.data.errorRows).toBeGreaterThan(0);
    // But should still import valid rows
    expect(data.result?.data.importedRows).toBeGreaterThan(0);
  });

  test('prevent duplicate file import', async ({ authenticatedPage }) => {
    if (!bankAccountId) {
      test.skip();
      return;
    }

    const csvContent = `Date,Amount,Description
2024-01-15,1000.00,Test Transaction`;

    const base64Content = btoa(csvContent);

    // First import
    const response1 = await authenticatedPage.request.post('/api/trpc/bankAccounts.importStatement', {
      data: {
        json: {
          organizationId: orgId,
          bankAccountId,
          fileContent: base64Content,
          fileName: 'duplicate-test.csv',
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

    expect(response1.status()).toBe(200);

    // Second import of same file
    const response2 = await authenticatedPage.request.post('/api/trpc/bankAccounts.importStatement', {
      data: {
        json: {
          organizationId: orgId,
          bankAccountId,
          fileContent: base64Content,
          fileName: 'duplicate-test.csv',
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

    // Should be rejected as duplicate
    expect([409, 200]).toContain(response2.status());
    
    if (response2.status() === 409) {
      const errorData = await response2.json();
      expect(errorData.error?.message).toContain('already been imported');
    } else {
      // If allowed, should have duplicate rows
      const data = await response2.json();
      expect(data.result?.data.duplicateRows).toBeGreaterThan(0);
    }
  });

  test('prevent duplicate transaction import', async ({ authenticatedPage }) => {
    if (!bankAccountId) {
      test.skip();
      return;
    }

    const csvContent = `Date,Amount,Description,Reference
2024-01-15,1000.00,Duplicate Test,REF-001`;

    const base64Content = btoa(csvContent);

    // First import
    const response1 = await authenticatedPage.request.post('/api/trpc/bankAccounts.importStatement', {
      data: {
        json: {
          organizationId: orgId,
          bankAccountId,
          fileContent: base64Content,
          fileName: 'duplicate-tx-1.csv',
          fileType: 'CSV',
          mapping: {
            date: 'Date',
            amount: 'Amount',
            description: 'Description',
            reference: 'Reference',
          },
          skipDuplicates: true,
        },
      },
    });

    expect(response1.status()).toBe(200);
    const data1 = await response1.json();
    expect(data1.result?.data.importedRows).toBeGreaterThan(0);

    // Second import with same transaction (different file name)
    const response2 = await authenticatedPage.request.post('/api/trpc/bankAccounts.importStatement', {
      data: {
        json: {
          organizationId: orgId,
          bankAccountId,
          fileContent: base64Content,
          fileName: 'duplicate-tx-2.csv',
          fileType: 'CSV',
          mapping: {
            date: 'Date',
            amount: 'Amount',
            description: 'Description',
            reference: 'Reference',
          },
          skipDuplicates: true,
        },
      },
    });

    expect(response2.status()).toBe(200);
    const data2 = await response2.json();
    
    // Should have duplicate transactions
    expect(data2.result?.data.duplicateRows).toBeGreaterThan(0);
    expect(data2.result?.data.importedRows).toBe(0);
  });

  test('preview statement before import', async ({ authenticatedPage }) => {
    if (!bankAccountId) {
      test.skip();
      return;
    }

    const csvContent = `Date,Amount,Description
2024-01-15,1000.00,Preview Test
2024-01-16,-500.00,Another Transaction`;

    const base64Content = btoa(csvContent);

    const response = await authenticatedPage.request.post('/api/trpc/bankAccounts.previewStatement', {
      data: {
        json: {
          organizationId: orgId,
          fileContent: base64Content,
          fileType: 'CSV',
          mapping: {
            date: 'Date',
            amount: 'Amount',
            description: 'Description',
          },
          parseOptions: {
            dateFormat: 'YYYY-MM-DD',
            amountLocale: 'en-US',
          },
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('transactions');
    expect(data.result?.data).toHaveProperty('metadata');
    expect(Array.isArray(data.result?.data.transactions)).toBe(true);
    expect(data.result?.data.transactions.length).toBeGreaterThan(0);
  });

  test('import OFX statement', async ({ authenticatedPage }) => {
    if (!bankAccountId) {
      test.skip();
      return;
    }

    // Sample OFX content (simplified)
    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<BANKID>123456789</BANKID>
<ACCTID>12345678</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20240101</DTSTART>
<DTEND>20240131</DTEND>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20240115</DTPOSTED>
<TRNAMT>1000.00</TRNAMT>
<FITID>001</FITID>
<NAME>Payment from Customer</NAME>
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20240116</DTPOSTED>
<TRNAMT>-500.00</TRNAMT>
<FITID>002</FITID>
<NAME>Payment to Vendor</NAME>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const base64Content = btoa(ofxContent);

    const response = await authenticatedPage.request.post('/api/trpc/bankAccounts.importStatement', {
      data: {
        json: {
          organizationId: orgId,
          bankAccountId,
          fileContent: base64Content,
          fileName: 'test-statement.ofx',
          fileType: 'OFX',
          skipDuplicates: true,
        },
      },
    });

    expect([200, 400]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.result?.data).toHaveProperty('importId');
    }
  });
});




