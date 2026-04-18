import { test, expect } from '@playwright/test';

/**
 * Smoke tests for Invoices module
 * Tests that the invoices page loads and displays data correctly
 */

test.describe('Invoices Module', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to invoices page
    await page.goto('/invoices');
  });

  test('should load invoices page', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Invoices/);
    
    // Check main heading
    await expect(page.getByRole('heading', { name: /Invoices/i })).toBeVisible();
  });

  test('should display invoice search input', async ({ page }) => {
    // Find search input
    const searchInput = page.getByPlaceholder(/search.*invoice/i);
    await expect(searchInput).toBeVisible();
    
    // Test search functionality
    await searchInput.fill('INV');
    await expect(searchInput).toHaveValue('INV');
  });

  test('should display status filter', async ({ page }) => {
    // Find status filter dropdown
    const statusFilter = page.locator('select').filter({ hasText: /all status/i });
    await expect(statusFilter).toBeVisible();
    
    // Test filter selection
    await statusFilter.selectOption('PAID');
  });

  test('should display invoices table or empty state', async ({ page }) => {
    // Check for either table or empty state
    const table = page.locator('table').first();
    const emptyState = page.getByText(/no invoices found/i);
    
    // One of them should be visible
    const hasTable = await table.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    expect(hasTable || hasEmptyState).toBeTruthy();
  });

  test('should display summary cards', async ({ page }) => {
    // Check for summary cards
    await expect(page.getByText(/total invoices/i)).toBeVisible();
    await expect(page.getByText(/total value/i)).toBeVisible();
    await expect(page.getByText(/paid invoices/i)).toBeVisible();
    await expect(page.getByText(/overdue invoices/i)).toBeVisible();
  });

  test('should have create invoice button', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create invoice/i });
    await expect(createButton).toBeVisible();
  });

  test('should handle invoice table interactions', async ({ page }) => {
    // Check if table exists
    const table = page.locator('table').first();
    const isTableVisible = await table.isVisible().catch(() => false);
    
    if (isTableVisible) {
      // Check for table headers
      await expect(page.getByRole('columnheader', { name: /invoice/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /customer/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /amount/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible();
    }
  });
});

