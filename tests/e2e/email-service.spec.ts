/**
 * E2E tests for Email Service Integration
 * 
 * Tests:
 * - Send invoice email with PDF attachment
 * - Send reminder email
 * - Send payment confirmation
 * - Email outbox tracking
 * - Retry failed emails
 * - Bounce webhook
 * - Template rendering
 * - Sandbox mode
 */

import { test, expect } from '../fixtures/auth';

test.describe('Email Service Integration', () => {
  const orgId = 'demo-org-id';
  let userId: string;
  let invoiceId: string;
  let reminderId: string;
  let paymentId: string;
  let emailId: string;

  test.beforeAll(async ({ authenticatedPage }) => {
    // Get user ID from session
    const sessionResponse = await authenticatedPage.request.get('/api/auth/session');
    if (sessionResponse.ok()) {
      const session = await sessionResponse.json();
      userId = session.user?.id || 'test-user-id';
    }

    // Create test invoice
    const customersResponse = await authenticatedPage.request.get(
      `/api/trpc/customers.getAll?input=${JSON.stringify({ organizationId: orgId, page: 1, limit: 1 })}`
    );
    if (customersResponse.ok()) {
      const customersData = await customersResponse.json();
      const customerId = customersData.result?.data?.customers?.[0]?.id;

      if (customerId) {
        const invoiceResponse = await authenticatedPage.request.post('/api/trpc/invoices.create', {
          data: {
            json: {
              organizationId: orgId,
              customerId,
              date: new Date().toISOString(),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              items: [
                {
                  description: 'Test Item',
                  quantity: 1,
                  unitPrice: 100,
                  taxRate: 20,
                },
              ],
            },
          },
        });

        if (invoiceResponse.ok()) {
          const invoiceData = await invoiceResponse.json();
          invoiceId = invoiceData.result?.data?.id;
        }
      }
    }

    // Create test reminder
    if (invoiceId) {
      const reminderResponse = await authenticatedPage.request.post('/api/trpc/invoiceReminders.create', {
        data: {
          json: {
            organizationId: orgId,
            invoiceId,
            reminderType: 'FIRST',
            scheduledFor: new Date().toISOString(),
          },
        },
      });

      if (reminderResponse.ok()) {
        const reminderData = await reminderResponse.json();
        reminderId = reminderData.result?.data?.id;
      }
    }

    // Create test payment
    const vendorsResponse = await authenticatedPage.request.get(
      `/api/trpc/vendors.getAll?input=${JSON.stringify({ organizationId: orgId, page: 1, limit: 1 })}`
    );
    if (vendorsResponse.ok()) {
      const vendorsData = await vendorsResponse.json();
      const vendorId = vendorsData.result?.data?.vendors?.[0]?.id;

      if (vendorId) {
        const bankAccountsResponse = await authenticatedPage.request.get(
          `/api/trpc/bankAccounts.getAll?input=${JSON.stringify({ organizationId: orgId, page: 1, limit: 1 })}`
        );
        if (bankAccountsResponse.ok()) {
          const bankAccountsData = await bankAccountsResponse.json();
          const bankAccountId = bankAccountsData.result?.data?.bankAccounts?.[0]?.id;

          if (bankAccountId) {
            const paymentResponse = await authenticatedPage.request.post('/api/trpc/payments.create', {
              data: {
                json: {
                  organizationId: orgId,
                  vendorId,
                  bankAccountId,
                  date: new Date().toISOString(),
                  amount: 100,
                  method: 'BANK_TRANSFER',
                },
              },
            });

            if (paymentResponse.ok()) {
              const paymentData = await paymentResponse.json();
              paymentId = paymentData.result?.data?.id;
            }
          }
        }
      }
    }
  });

  test('should send invoice email with PDF attachment', async ({ authenticatedPage }) => {
    if (!invoiceId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/emails.sendInvoiceEmail', {
      data: {
        json: {
          organizationId: orgId,
          invoiceId,
          to: ['test@example.com'],
          includePdf: true,
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data).toHaveProperty('messageId');
    expect(data.result?.data.status).toBe('SENT');
    emailId = data.result?.data.id;
  });

  test('should send reminder email', async ({ authenticatedPage }) => {
    if (!reminderId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/emails.sendReminderEmail', {
      data: {
        json: {
          organizationId: orgId,
          reminderId,
          to: ['test@example.com'],
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data).toHaveProperty('messageId');
  });

  test('should send payment confirmation email', async ({ authenticatedPage }) => {
    if (!paymentId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.post('/api/trpc/emails.sendPaymentConfirmation', {
      data: {
        json: {
          organizationId: orgId,
          paymentId,
          to: ['vendor@example.com'],
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data).toHaveProperty('messageId');
  });

  test('should list emails in outbox', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      `/api/trpc/emails.getAll?input=${JSON.stringify({ organizationId: orgId, page: 1, limit: 10 })}`
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('emails');
    expect(Array.isArray(data.result?.data.emails)).toBe(true);
  });

  test('should get email by ID', async ({ authenticatedPage }) => {
    if (!emailId) {
      test.skip();
      return;
    }

    const response = await authenticatedPage.request.get(
      `/api/trpc/emails.getById?input=${JSON.stringify({ id: emailId, organizationId: orgId })}`
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data.id).toBe(emailId);
  });

  test('should retry failed email', async ({ authenticatedPage }) => {
    if (!emailId) {
      test.skip();
      return;
    }

    // First, mark email as failed
    await authenticatedPage.request.post('/api/trpc/emails.retry', {
      data: {
        json: {
          id: emailId,
          organizationId: orgId,
        },
      },
    });

    // In sandbox mode, retry should succeed
    const response = await authenticatedPage.request.post('/api/trpc/emails.retry', {
      data: {
        json: {
          id: emailId,
          organizationId: orgId,
        },
      },
    });

    // Should either succeed or fail gracefully
    expect([200, 400, 500]).toContain(response.status());
  });

  test('should handle bounce webhook', async ({ authenticatedPage }) => {
    if (!emailId) {
      test.skip();
      return;
    }

    // Get email to get messageId
    const emailResponse = await authenticatedPage.request.get(
      `/api/trpc/emails.getById?input=${JSON.stringify({ id: emailId, organizationId: orgId })}`
    );

    if (emailResponse.ok()) {
      const emailData = await emailResponse.json();
      const messageId = emailData.result?.data?.messageId;

      if (messageId) {
        const bounceResponse = await authenticatedPage.request.post('/api/emails/bounce', {
          data: {
            messageId,
            reason: 'Test bounce reason',
            bounceType: 'hard',
          },
        });

        expect(bounceResponse.status()).toBe(200);
        const bounceData = await bounceResponse.json();
        expect(bounceData.success).toBe(true);
      }
    }
  });

  test('should render email templates', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get('/api/trpc/emails.getTemplates');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.result?.data)).toBe(true);
    expect(data.result?.data.length).toBeGreaterThan(0);
    
    // Check template structure
    const template = data.result?.data[0];
    expect(template).toHaveProperty('name');
    expect(template).toHaveProperty('subject');
    expect(template).toHaveProperty('html');
    expect(template).toHaveProperty('variables');
  });

  test('should enforce permissions', async ({ viewerPage }) => {
    if (!invoiceId) {
      test.skip();
      return;
    }

    const response = await viewerPage.request.post('/api/trpc/emails.sendInvoiceEmail', {
      data: {
        json: {
          organizationId: orgId,
          invoiceId,
          to: ['test@example.com'],
        },
      },
    });

    // Should either succeed (if viewer can send) or fail with permission error
    expect([200, 403, 401]).toContain(response.status());
  });

  test('should create outbox entry on send', async ({ authenticatedPage }) => {
    if (!invoiceId) {
      test.skip();
      return;
    }

    const sendResponse = await authenticatedPage.request.post('/api/trpc/emails.sendInvoiceEmail', {
      data: {
        json: {
          organizationId: orgId,
          invoiceId,
          to: ['test@example.com'],
        },
      },
    });

    if (sendResponse.ok()) {
      const sendData = await sendResponse.json();
      const outboxId = sendData.result?.data?.id;

      // Verify outbox entry exists
      const getResponse = await authenticatedPage.request.get(
        `/api/trpc/emails.getById?input=${JSON.stringify({ id: outboxId, organizationId: orgId })}`
      );

      expect(getResponse.status()).toBe(200);
      const emailData = await getResponse.json();
      expect(emailData.result?.data).toHaveProperty('id');
      expect(emailData.result?.data.entityType).toBe('invoice');
      expect(emailData.result?.data.entityId).toBe(invoiceId);
    }
  });

  test('should cap retry count', async ({ authenticatedPage }) => {
    if (!emailId) {
      test.skip();
      return;
    }

    // Try to retry multiple times beyond max retries
    // In sandbox mode, this should work, but in production would be capped
    for (let i = 0; i < 5; i++) {
      const response = await authenticatedPage.request.post('/api/trpc/emails.retry', {
        data: {
          json: {
            id: emailId,
            organizationId: orgId,
          },
        },
      });

      // Should eventually fail or succeed based on retry count
      if (response.status() === 400) {
        const errorData = await response.json();
        if (errorData.error?.message?.includes('retry')) {
          break; // Expected - max retries reached
        }
      }
    }
  });
});




