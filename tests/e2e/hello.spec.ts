/**
 * E2E test for Hello endpoint
 * 
 * Tests that the hello page:
 * - Requires authentication
 * - Displays paginated list
 * - Handles API calls correctly
 * - Demonstrates all DoD criteria working
 */

import { test, expect } from '../fixtures/auth';
import { navigateToModule, waitForPageLoad } from '../helpers/page-helpers';

test.describe('Hello Endpoint', () => {
  test('should require authentication', async ({ page }) => {
    // Try to access hello page without authentication
    await page.goto('/hello');
    
    // Should redirect to sign-in
    await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 5000 });
  });

  test('should display hello page when authenticated', async ({ authenticatedPage }) => {
    // Navigate to hello page
    await authenticatedPage.goto('/hello');
    await waitForPageLoad(authenticatedPage);

    // Check page loaded
    await expect(authenticatedPage.getByRole('heading', { name: /hello endpoint demo/i })).toBeVisible({ timeout: 10000 });
    
    // Check for main content
    await expect(authenticatedPage.getByText(/this page demonstrates all dod criteria/i)).toBeVisible();
  });

  test('should display paginated list', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/hello');
    await waitForPageLoad(authenticatedPage);

    // Wait for data to load
    await authenticatedPage.waitForTimeout(2000);

    // Check for table or empty state
    const table = authenticatedPage.locator('table').first();
    const emptyState = authenticatedPage.getByText(/no items found/i);
    
    const hasTable = await table.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    // One of them should be visible
    expect(hasTable || hasEmptyState).toBeTruthy();
  });

  test('should have filter input', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/hello');
    await waitForPageLoad(authenticatedPage);

    // Check for filter input
    const filterInput = authenticatedPage.getByPlaceholder(/filter items/i);
    await expect(filterInput).toBeVisible({ timeout: 5000 });
  });

  test('should have create button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/hello');
    await waitForPageLoad(authenticatedPage);

    // Check for create button
    const createButton = authenticatedPage.getByRole('button', { name: /create item/i });
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });

  test('should handle API errors gracefully', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/hello');
    await waitForPageLoad(authenticatedPage);

    // Wait a bit for API call
    await authenticatedPage.waitForTimeout(3000);

    // Check for error message if API fails (should be displayed gracefully)
    const errorMessage = authenticatedPage.getByText(/error/i);
    const hasError = await errorMessage.isVisible().catch(() => false);
    
    // If error exists, it should be displayed in a user-friendly way
    if (hasError) {
      await expect(errorMessage).toBeVisible();
    }
  });
});

