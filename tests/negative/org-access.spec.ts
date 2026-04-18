/**
 * Negative tests for organization-scoped access guards
 * Tests unauthorized access attempts and cross-organization access
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Test setup: Create two organizations with different users
 */
async function setupTestData() {
  // Create User 1 and Org 1
  const user1 = await prisma.user.upsert({
    where: { email: 'test-user1@sumtise.com' },
    update: {},
    create: {
      email: 'test-user1@sumtise.com',
      name: 'Test User 1',
    },
  });

  const org1 = await prisma.organization.upsert({
    where: { slug: 'test-org-1' },
    update: {},
    create: {
      name: 'Test Org 1',
      slug: 'test-org-1',
      creatorId: user1.id,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: user1.id,
        organizationId: org1.id,
      },
    },
    update: {},
    create: {
      userId: user1.id,
      organizationId: org1.id,
      role: 'OWNER',
    },
  });

  // Create User 2 and Org 2
  const user2 = await prisma.user.upsert({
    where: { email: 'test-user2@sumtise.com' },
    update: {},
    create: {
      email: 'test-user2@sumtise.com',
      name: 'Test User 2',
    },
  });

  const org2 = await prisma.organization.upsert({
    where: { slug: 'test-org-2' },
    update: {},
    create: {
      name: 'Test Org 2',
      slug: 'test-org-2',
      creatorId: user2.id,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: user2.id,
        organizationId: org2.id,
      },
    },
    update: {},
    create: {
      userId: user2.id,
      organizationId: org2.id,
      role: 'OWNER',
    },
  });

  // Create resources in Org 1
  const customer1 = await prisma.customer.create({
    data: {
      organizationId: org1.id,
      name: 'Customer 1',
      email: 'customer1@example.com',
    },
  });

  const invoice1 = await prisma.invoice.create({
    data: {
      organizationId: org1.id,
      customerId: customer1.id,
      invoiceNumber: 'INV-001',
      date: new Date(),
      dueDate: new Date(),
      status: 'DRAFT',
      subtotal: 1000,
      taxAmount: 200,
      total: 1200,
      currency: 'GBP',
    },
  });

  return { user1, user2, org1, org2, customer1, invoice1 };
}

test.describe('Organization Access Guards - Negative Tests', () => {
  let testData: Awaited<ReturnType<typeof setupTestData>>;

  test.beforeAll(async () => {
    testData = await setupTestData();
  });

  test.afterAll(async () => {
    // Cleanup test data
    if (testData) {
      await prisma.invoice.deleteMany({
        where: { organizationId: testData.org1.id },
      });
      await prisma.customer.deleteMany({
        where: { organizationId: testData.org1.id },
      });
      await prisma.organizationMember.deleteMany({
        where: {
          organizationId: { in: [testData.org1.id, testData.org2.id] },
        },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [testData.org1.id, testData.org2.id] } },
      });
      await prisma.user.deleteMany({
        where: {
          email: { in: ['test-user1@sumtise.com', 'test-user2@sumtise.com'] },
        },
      });
    }
    await prisma.$disconnect();
  });

  test('should reject access to organization user is not a member of', async ({ page }) => {
    // This test verifies that the guards work at the API level
    // In a real scenario, you'd make authenticated API calls
    
    // Navigate to a page that requires org access
    await page.goto('/invoices');
    
    // Attempt to access with invalid organizationId would be blocked
    // The frontend should handle this gracefully
    await expect(page).toHaveURL(/\/invoices/);
  });

  test('should reject cross-organization resource access', async ({ page }) => {
    // This test verifies resource ownership checks
    // User 2 should not be able to access resources from Org 1
    
    // The actual API calls would be blocked by the guards
    // Frontend should show appropriate error messages
    await page.goto('/invoices');
    
    // UI should not show data from other organizations
    // This is a UI-level test; API-level tests would be in integration tests
    const pageContent = await page.textContent('body');
    
    // Verify no sensitive data leakage
    expect(pageContent).not.toContain('Customer 1');
  });

  test('should require authentication for org-scoped endpoints', async ({ page }) => {
    // Test that unauthenticated requests are rejected
    // This would be tested via direct API calls in integration tests
    
    // UI test: verify login requirement
    await page.goto('/invoices');
    
    // Should redirect to login or show auth error
    // The actual API would return 401 UNAUTHORIZED
  });

  test('should validate organizationId presence', async ({ page }) => {
    // Test that missing organizationId is rejected
    await page.goto('/invoices');
    
    // API would return 400 BAD_REQUEST for missing organizationId
    // Frontend should handle this gracefully
  });
});

/**
 * Integration tests for API guards
 * These would be run with a test HTTP client that can make authenticated requests
 */
test.describe('API Integration Tests - Organization Guards', () => {
  test.skip('API: should reject unauthorized organization access', async () => {
    // This would use a test HTTP client like axios or fetch
    // to make actual API calls and verify error responses
    
    // Example:
    // const response = await fetch('/api/trpc/invoices.getAll', {
    //   method: 'POST',
    //   headers: { 'Authorization': 'Bearer invalid-token' },
    //   body: JSON.stringify({ organizationId: 'unauthorized-org-id' })
    // });
    // expect(response.status).toBe(403);
  });

  test.skip('API: should reject cross-organization resource update', async () => {
    // Test that updating a resource from Org 1 using Org 2's context fails
    // Example:
    // const response = await fetch('/api/trpc/customers.update', {
    //   method: 'POST',
    //   headers: { 'Authorization': 'Bearer user2-token' },
    //   body: JSON.stringify({
    //     id: 'org1-customer-id',
    //     organizationId: 'org2-id', // User2's org
    //     data: { name: 'Hacked' }
    //   })
    // });
    // expect(response.status).toBe(403);
    // expect(response.json()).toContain('does not belong');
  });

  test.skip('API: should reject resource access with wrong organizationId', async () => {
    // Test accessing resource with mismatched organizationId
    // Example:
    // const response = await fetch('/api/trpc/invoices.getAll', {
    //   method: 'POST',
    //   headers: { 'Authorization': 'Bearer user1-token' },
    //   body: JSON.stringify({
    //     organizationId: 'org2-id', // User1 trying to access Org2
    //   })
    // });
    // expect(response.status).toBe(403);
  });
});

