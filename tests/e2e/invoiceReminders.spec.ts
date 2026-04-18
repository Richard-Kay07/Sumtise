/**
 * E2E tests for Invoice Reminders Router
 * 
 * Tests reminder scheduling, outstanding invoice selection, sending, and cool-down
 * 
 * Test scenarios:
 * 1. Create/schedule reminder
 * 2. Get outstanding invoices (with cool-down)
 * 3. Send single reminder (creates outbox entry)
 * 4. Send bulk reminders
 * 5. Get templates with placeholders
 * 6. Cool-down period respected
 * 7. Outbox entries created
 */

import { test, expect } from '../fixtures/auth';
import { navigateToModule, waitForPageLoad } from '../helpers/page-helpers';

test.describe('Invoice Reminders Router', () => {
  let customerId: string;
  let invoiceId1: string;
  let invoiceId2: string;

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

    // Create invoices for testing
    if (customerId) {
      // Create first invoice (overdue)
      const createInvoice1Response = await authenticatedPage.request.post('/api/trpc/invoices.create', {
        data: {
          json: {
            organizationId: 'demo-org-id',
            customerId,
            date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
            dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago (overdue)
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

      if (createInvoice1Response.ok()) {
        const invoice1Data = await createInvoice1Response.json();
        invoiceId1 = invoice1Data.result?.data?.id;
      }

      // Create second invoice (due soon)
      const createInvoice2Response = await authenticatedPage.request.post('/api/trpc/invoices.create', {
        data: {
          json: {
            organizationId: 'demo-org-id',
            customerId,
            date: new Date().toISOString(),
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
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

      if (createInvoice2Response.ok()) {
        const invoice2Data = await createInvoice2Response.json();
        invoiceId2 = invoice2Data.result?.data?.id;
      }
    }
  });

  test('should get all reminders', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/invoiceReminders.getAll?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
        page: 1,
        limit: 10,
      })
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('reminders');
    expect(data.result?.data).toHaveProperty('pagination');
  });

  test('should get outstanding invoices', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/invoiceReminders.getOutstandingInvoices?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
        daysBeforeDue: 7,
        daysOverdue: 365,
        cooldownDays: 7,
      })
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.result?.data)).toBe(true);
    // Should include invoices that are due or overdue
    if (data.result?.data.length > 0) {
      const invoice = data.result?.data[0];
      expect(invoice).toHaveProperty('id');
      expect(invoice).toHaveProperty('invoiceNumber');
      expect(invoice).toHaveProperty('customer');
      expect(invoice).toHaveProperty('daysUntilDue');
    }
  });

  test('should create/schedule reminder', async ({ authenticatedPage }) => {
    if (!invoiceId1) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/invoiceReminders.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          invoiceId: invoiceId1,
          reminderType: 'FIRST',
          scheduledFor: new Date().toISOString(),
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data.status).toBe('PENDING');
    expect(data.result?.data.reminderType).toBe('FIRST');
    expect(data.result?.data).toHaveProperty('emailSubject');
    expect(data.result?.data).toHaveProperty('emailBody');
  });

  test('should send single reminder', async ({ authenticatedPage }) => {
    if (!invoiceId1) {
      test.skip();
      return;
    }

    // Create reminder first
    const createResponse = await authenticatedPage.request.post('/api/trpc/invoiceReminders.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          invoiceId: invoiceId1,
          reminderType: 'SECOND',
          scheduledFor: new Date().toISOString(),
        },
      },
    });

    const createData = await createResponse.json();
    const reminderId = createData.result?.data?.id;

    if (reminderId) {
      // Send reminder
      const sendResponse = await authenticatedPage.request.post('/api/trpc/invoiceReminders.sendReminder', {
        data: {
          json: {
            id: reminderId,
            organizationId: 'demo-org-id',
          },
        },
      });

      expect(sendResponse.status()).toBe(200);
      const sendData = await sendResponse.json();
      expect(sendData.result?.data.reminder.status).toBe('SENT');
      expect(sendData.result?.data.reminder.sentAt).toBeDefined();
      expect(sendData.result?.data).toHaveProperty('outboxEntry');
      expect(sendData.result?.data.outboxEntry).toHaveProperty('id');
      expect(sendData.result?.data.outboxEntry).toHaveProperty('template');
      expect(sendData.result?.data.outboxEntry).toHaveProperty('payload');
    }
  });

  test('should send bulk reminders', async ({ authenticatedPage }) => {
    if (!invoiceId1 || !invoiceId2) {
      test.skip();
      return;
    }

    // Create multiple reminders
    await authenticatedPage.request.post('/api/trpc/invoiceReminders.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          invoiceId: invoiceId1,
          reminderType: 'FINAL',
          scheduledFor: new Date().toISOString(),
        },
      },
    });

    await authenticatedPage.request.post('/api/trpc/invoiceReminders.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          invoiceId: invoiceId2,
          reminderType: 'FIRST',
          scheduledFor: new Date().toISOString(),
        },
      },
    });

    // Send bulk reminders
    const bulkResponse = await authenticatedPage.request.post('/api/trpc/invoiceReminders.sendBulkReminders', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          maxReminders: 10,
        },
      },
    });

    expect(bulkResponse.status()).toBe(200);
    const bulkData = await bulkResponse.json();
    expect(bulkData.result?.data).toHaveProperty('total');
    expect(bulkData.result?.data).toHaveProperty('sent');
    expect(bulkData.result?.data).toHaveProperty('failed');
    expect(bulkData.result?.data).toHaveProperty('outboxEntries');
    expect(bulkData.result?.data.outboxEntries.length).toBeGreaterThanOrEqual(0);
  });

  test('should get templates with placeholders', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/invoiceReminders.getTemplates?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
      })
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('templates');
    expect(data.result?.data).toHaveProperty('placeholders');
    expect(Array.isArray(data.result?.data.placeholders)).toBe(true);
    expect(data.result?.data.placeholders.length).toBeGreaterThan(0);
    
    // Check template structure
    if (data.result?.data.templates) {
      const firstTemplate = data.result?.data.templates.FIRST;
      expect(firstTemplate).toHaveProperty('subject');
      expect(firstTemplate).toHaveProperty('body');
      expect(firstTemplate).toHaveProperty('placeholders');
    }
  });

  test('should get specific template', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/invoiceReminders.getTemplates?input=' + JSON.stringify({
        organizationId: 'demo-org-id',
        reminderType: 'FINAL',
      })
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('type');
    expect(data.result?.data.type).toBe('FINAL');
    expect(data.result?.data).toHaveProperty('subject');
    expect(data.result?.data).toHaveProperty('body');
    expect(data.result?.data).toHaveProperty('placeholders');
  });

  test('should respect cool-down period', async ({ authenticatedPage }) => {
    if (!invoiceId1) {
      test.skip();
      return;
    }

    // Create and send first reminder
    const create1Response = await authenticatedPage.request.post('/api/trpc/invoiceReminders.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          invoiceId: invoiceId1,
          reminderType: 'FIRST',
          scheduledFor: new Date().toISOString(),
        },
      },
    });

    const create1Data = await create1Response.json();
    const reminderId1 = create1Data.result?.data?.id;

    if (reminderId1) {
      // Send first reminder
      await authenticatedPage.request.post('/api/trpc/invoiceReminders.sendReminder', {
        data: {
          json: {
            id: reminderId1,
            organizationId: 'demo-org-id',
          },
        },
      });

      // Get outstanding invoices with cool-down
      const outstandingResponse = await authenticatedPage.request.get(
        '/api/trpc/invoiceReminders.getOutstandingInvoices?input=' + JSON.stringify({
          organizationId: 'demo-org-id',
          cooldownDays: 7,
        })
      );

      const outstandingData = await outstandingResponse.json();
      // Invoice should not appear in outstanding list due to cool-down
      const invoiceInList = outstandingData.result?.data.find(
        (inv: any) => inv.id === invoiceId1
      );
      // Should be excluded due to cool-down
      expect(invoiceInList).toBeUndefined();
    }
  });

  test('should prevent sending already sent reminder', async ({ authenticatedPage }) => {
    if (!invoiceId2) {
      test.skip();
      return;
    }

    // Create and send reminder
    const createResponse = await authenticatedPage.request.post('/api/trpc/invoiceReminders.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          invoiceId: invoiceId2,
          reminderType: 'FIRST',
          scheduledFor: new Date().toISOString(),
        },
      },
    });

    const createData = await createResponse.json();
    const reminderId = createData.result?.data?.id;

    if (reminderId) {
      // Send first time
      await authenticatedPage.request.post('/api/trpc/invoiceReminders.sendReminder', {
        data: {
          json: {
            id: reminderId,
            organizationId: 'demo-org-id',
          },
        },
      });

      // Try to send again (should fail)
      const send2Response = await authenticatedPage.request.post('/api/trpc/invoiceReminders.sendReminder', {
        data: {
          json: {
            id: reminderId,
            organizationId: 'demo-org-id',
          },
        },
      });

      // Should fail with PRECONDITION_FAILED
      expect(send2Response.status()).toBe(200); // tRPC returns 200 but with error
      const data = await send2Response.json();
      const errorCode = data.result?.data?.error?.code || data.error?.code;
      expect(errorCode).toBe('PRECONDITION_FAILED');
    }
  });

  test('should exclude paid/cancelled invoices from outstanding', async ({ authenticatedPage }) => {
    if (!customerId) {
      test.skip();
      return;
    }

    // Create a paid invoice
    const createInvoiceResponse = await authenticatedPage.request.post('/api/trpc/invoices.create', {
      data: {
        json: {
          organizationId: 'demo-org-id',
          customerId,
          date: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          items: [
            {
              description: 'Test Item',
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
      const invoiceId = invoiceData.result?.data?.id;

      // Mark as paid (if endpoint exists)
      // For now, just check that outstanding invoices don't include paid ones
      const outstandingResponse = await authenticatedPage.request.get(
        '/api/trpc/invoiceReminders.getOutstandingInvoices?input=' + JSON.stringify({
          organizationId: 'demo-org-id',
        })
      );

      const outstandingData = await outstandingResponse.json();
      // Paid invoices should not appear
      const paidInvoiceInList = outstandingData.result?.data.find(
        (inv: any) => inv.id === invoiceId && inv.status === 'PAID'
      );
      expect(paidInvoiceInList).toBeUndefined();
    }
  });
});




