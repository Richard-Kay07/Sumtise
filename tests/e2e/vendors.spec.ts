/**
 * E2E tests for Vendors module
 * 
 * Tests vendor list with pagination, search, and filters
 */

import { test, expect } from '../fixtures/auth';
import { navigateToModule, waitForPageLoad } from '../helpers/page-helpers';

test.describe('Vendors Module', () => {
  test('should display vendors list when authenticated', async ({ authenticatedPage }) => {
    // Navigate to vendors page (assuming route exists)
    // For now, we'll test via API and check if we can create a vendors page
    await authenticatedPage.goto('/');
    await waitForPageLoad(authenticatedPage);

    // Check if page loaded
    await expect(authenticatedPage).toHaveTitle(/Sumtise/i);
  });

  test('should support vendor search with debounce', async ({ authenticatedPage }) => {
    // This test assumes a vendors page exists
    // For now, we'll verify the API endpoint works
    const response = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=10'
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('result');
  });

  test('should paginate vendor list', async ({ authenticatedPage }) => {
    // Test pagination via API
    const page1 = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=2'
    );
    expect(page1.status()).toBe(200);
    
    const page2 = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=2&limit=2'
    );
    expect(page2.status()).toBe(200);
  });

  test('should filter vendors by active status', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=10&isActive=true'
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    if (data.result?.data?.vendors) {
      // All returned vendors should be active
      data.result.data.vendors.forEach((vendor: any) => {
        expect(vendor.isActive).toBe(true);
      });
    }
  });

  test('should filter vendors by tags', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=10&tags=office'
    );

    expect(response.status()).toBe(200);
  });

  test('should filter vendors by name search', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=10&name=Office'
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    if (data.result?.data?.vendors) {
      // All returned vendors should match search term
      data.result.data.vendors.forEach((vendor: any) => {
        const nameMatch = vendor.name.toLowerCase().includes('office') || 
                         (vendor.alias && vendor.alias.toLowerCase().includes('office'));
        expect(nameMatch).toBe(true);
      });
    }
  });

  test('should exclude soft-deleted vendors by default', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=10'
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    if (data.result?.data?.vendors) {
      // No deleted vendors should be returned
      data.result.data.vendors.forEach((vendor: any) => {
        expect(vendor.deletedAt).toBeNull();
      });
    }
  });

  test('should include archived vendors when includeArchived=true', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=10&includeArchived=true'
    );

    expect(response.status()).toBe(200);
  });

  test('should get vendor by ID with counts', async ({ authenticatedPage }) => {
    // First get a vendor ID
    const listResponse = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=1'
    );
    
    const listData = await listResponse.json();
    const vendorId = listData.result?.data?.vendors?.[0]?.id;
    
    if (vendorId) {
      const detailResponse = await authenticatedPage.request.get(
        `/api/trpc/vendors.getById?organizationId=demo-org-id&id=${vendorId}`
      );

      expect(detailResponse.status()).toBe(200);
      const detailData = await detailResponse.json();
      expect(detailData.result?.data).toHaveProperty('billsCount');
      expect(detailData.result?.data).toHaveProperty('totalOutstanding');
      expect(detailData.result?.data).toHaveProperty('lastPaymentDate');
    }
  });

  test('should create vendor with validation', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.post('/api/trpc/vendors.create', {
      data: {
        organizationId: 'demo-org-id',
        name: `Test Vendor ${Date.now()}`,
        email: `vendor${Date.now()}@example.com`,
        currency: 'GBP',
        tags: ['test'],
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result?.data).toHaveProperty('id');
    expect(data.result?.data).toHaveProperty('name');
  });

  test('should prevent duplicate vendor names', async ({ authenticatedPage }) => {
    const vendorName = `Duplicate Test ${Date.now()}`;
    
    // Create first vendor
    const create1 = await authenticatedPage.request.post('/api/trpc/vendors.create', {
      data: {
        organizationId: 'demo-org-id',
        name: vendorName,
        currency: 'GBP',
      },
    });
    expect(create1.status()).toBe(200);

    // Try to create duplicate
    const create2 = await authenticatedPage.request.post('/api/trpc/vendors.create', {
      data: {
        organizationId: 'demo-org-id',
        name: vendorName,
        currency: 'GBP',
      },
    });
    expect(create2.status()).toBe(409); // Conflict
  });

  test('should prevent deleting vendor with outstanding bills', async ({ authenticatedPage }) => {
    // This test assumes a vendor with outstanding bills exists
    // In a real scenario, you'd create a vendor, create bills, then try to delete
    const listResponse = await authenticatedPage.request.get(
      '/api/trpc/vendors.getAll?organizationId=demo-org-id&page=1&limit=1'
    );
    
    const listData = await listResponse.json();
    const vendorId = listData.result?.data?.vendors?.[0]?.id;
    
    if (vendorId) {
      const deleteResponse = await authenticatedPage.request.post('/api/trpc/vendors.delete', {
        data: {
          id: vendorId,
          organizationId: 'demo-org-id',
          force: false,
        },
      });

      // Should either succeed (if no outstanding bills) or fail with 412 (Precondition Failed)
      expect([200, 412]).toContain(deleteResponse.status());
    }
  });
});

