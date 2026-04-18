/**
 * E2E tests for Authentication
 */

import { test, expect } from '../fixtures/auth';
import { waitForPageLoad, waitForToast } from '../helpers/page-helpers';

test.describe('Authentication', () => {
  test('should display sign-in page', async ({ page }) => {
    await page.goto('/auth/signin');
    await waitForPageLoad(page);

    // Check page elements
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Try to submit empty form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Check for validation errors (adjust based on your validation)
    const emailError = page.getByText(/email.*required/i);
    const passwordError = page.getByText(/password.*required/i);
    
    // At least one validation error should appear
    const hasEmailError = await emailError.isVisible().catch(() => false);
    const hasPasswordError = await passwordError.isVisible().catch(() => false);
    
    expect(hasEmailError || hasPasswordError).toBeTruthy();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Fill with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for error message
    await waitForToast(page);
    
    // Check for error message
    const errorMessage = page.getByText(/invalid.*credentials|incorrect.*password|user.*not.*found/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should successfully sign in with valid credentials', async ({ authenticatedPage }) => {
    // authenticatedPage fixture handles sign-in
    // Just verify we're on a protected page
    await expect(authenticatedPage).toHaveURL(/\/(dashboard|invoices|\/)/);
    
    // Check for user menu or authenticated indicator
    const userMenu = authenticatedPage.locator('[data-testid="user-menu"], [aria-label*="user"]').first();
    await expect(userMenu).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to sign-in when accessing protected route', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/invoices');
    
    // Should redirect to sign-in
    await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 5000 });
  });

  test('should sign out successfully', async ({ authenticatedPage }) => {
    // Find and click sign out button
    const userMenu = authenticatedPage.locator('[data-testid="user-menu"], [aria-label*="user"]').first();
    await userMenu.click();
    
    const signOutButton = authenticatedPage.getByRole('button', { name: /sign out|log out/i });
    await signOutButton.click();
    
    // Should redirect to sign-in
    await expect(authenticatedPage).toHaveURL(/\/auth\/signin/, { timeout: 5000 });
  });
});

