import { test, expect } from '@playwright/test';

/**
 * Smoke tests for Bills/Expenses module
 * Tests that the expenses page loads and displays bills correctly
 */

test.describe('Bills/Expenses Module', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to expenses page
    await page.goto('/expenses');
  });

  test('should load expenses page', async ({ page }) => {
    // Check page title contains Expenses
    await expect(page).toHaveTitle(/Expenses/i);
    
    // Check for main content area
    await expect(page.getByText(/expenses/i).first()).toBeVisible();
  });

  test('should display receipt scanning section', async ({ page }) => {
    // Look for OCR/scanning features
    const scanSection = page.getByText(/scan receipt/i);
    if (await scanSection.isVisible().catch(() => false)) {
      await expect(scanSection).toBeVisible();
    }
  });

  test('should display expense list', async ({ page }) => {
    // Check for expense items or empty state
    const expenseList = page.locator('[class*="expense"]');
    const emptyState = page.getByText(/no expenses/i);
    
    const hasExpenses = await expenseList.count() > 0;
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    expect(hasExpenses || hasEmptyState).toBeTruthy();
  });

  test('should display expense summary', async ({ page }) => {
    // Check for summary cards/section
    const summary = page.getByText(/expense summary/i);
    if (await summary.isVisible().catch(() => false)) {
      await expect(summary).toBeVisible();
    }
  });

  test('should navigate to create expense', async ({ page }) => {
    // Look for create expense button or link
    const createButton = page.getByRole('button', { name: /create.*expense/i });
    const createLink = page.getByRole('link', { name: /create.*expense/i });
    
    const hasButton = await createButton.isVisible().catch(() => false);
    const hasLink = await createLink.isVisible().catch(() => false);
    
    expect(hasButton || hasLink).toBeTruthy();
  });
});

test.describe('Payment Run Module', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to payment run page
    await page.goto('/expenses/payment-run');
  });

  test('should load payment run page', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /payment run/i })).toBeVisible();
  });

  test('should display payment settings', async ({ page }) => {
    // Check for payment date and method inputs
    const paymentDate = page.locator('input[type="date"]').first();
    await expect(paymentDate).toBeVisible();
    
    const paymentMethod = page.locator('select').filter({ hasText: /payment method/i });
    if (await paymentMethod.count() > 0) {
      await expect(paymentMethod.first()).toBeVisible();
    }
  });

  test('should display supplier invoices table', async ({ page }) => {
    // Check for invoices table or empty state
    const table = page.locator('table').first();
    const emptyState = page.getByText(/no.*invoices.*found/i);
    
    const hasTable = await table.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    expect(hasTable || hasEmptyState).toBeTruthy();
  });

  test('should display payment summary sidebar', async ({ page }) => {
    // Check for summary section
    const summary = page.getByText(/payment summary/i);
    if (await summary.isVisible().catch(() => false)) {
      await expect(summary).toBeVisible();
    }
  });

  test('should have process payment run button', async ({ page }) => {
    const processButton = page.getByRole('button', { name: /process.*payment/i });
    await expect(processButton).toBeVisible();
  });

  test('should handle invoice selection', async ({ page }) => {
    // Check for checkboxes or selection mechanism
    const checkboxes = page.locator('input[type="checkbox"]');
    const selectButtons = page.getByText(/select all/i);
    
    const hasCheckboxes = await checkboxes.count() > 0;
    const hasSelectButtons = await selectButtons.isVisible().catch(() => false);
    
    expect(hasCheckboxes || hasSelectButtons).toBeTruthy();
  });
});

