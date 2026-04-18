/**
 * Authentication fixtures for Playwright tests
 */

import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
  viewerPage: Page;
};

/**
 * Base test with authentication fixtures
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Authenticated page with default user
   */
  authenticatedPage: async ({ page }, use) => {
    // Navigate to sign-in page
    await page.goto('/auth/signin');
    
    // Fill in credentials (adjust based on your auth setup)
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'password123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL('/**', { timeout: 10000 });
    
    // Verify we're authenticated
    await expect(page).toHaveURL(/\/dashboard|\/invoices|\//);
    
    await use(page);
  },

  /**
   * Admin user page
   */
  adminPage: async ({ page }, use) => {
    await page.goto('/auth/signin');
    
    await page.fill('input[name="email"]', process.env.TEST_ADMIN_EMAIL || 'admin@example.com');
    await page.fill('input[name="password"]', process.env.TEST_ADMIN_PASSWORD || 'admin123');
    
    await page.click('button[type="submit"]');
    await page.waitForURL('/**', { timeout: 10000 });
    
    await use(page);
  },

  /**
   * Viewer user page (read-only)
   */
  viewerPage: async ({ page }, use) => {
    await page.goto('/auth/signin');
    
    await page.fill('input[name="email"]', process.env.TEST_VIEWER_EMAIL || 'viewer@example.com');
    await page.fill('input[name="password"]', process.env.TEST_VIEWER_PASSWORD || 'viewer123');
    
    await page.click('button[type="submit"]');
    await page.waitForURL('/**', { timeout: 10000 });
    
    await use(page);
  },
});

export { expect };

