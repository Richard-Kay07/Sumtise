/**
 * E2E tests for Navigation
 */

import { test, expect } from '../fixtures/auth';
import { navigateToModule, waitForPageLoad } from '../helpers/page-helpers';

test.describe('Navigation', () => {
  test('should navigate to all main modules', async ({ authenticatedPage }) => {
    const modules = [
      { name: 'Dashboard', path: '/' },
      { name: 'Invoices', path: '/invoices' },
      { name: 'Expenses', path: '/expenses' },
      { name: 'Banking', path: '/banking' },
      { name: 'Reports', path: '/reports' },
    ];

    for (const module of modules) {
      await navigateToModule(authenticatedPage, module.name.toLowerCase());
      await expect(authenticatedPage).toHaveURL(new RegExp(module.path));
      
      // Check page loaded
      await waitForPageLoad(authenticatedPage);
      
      // Check for main heading
      const heading = authenticatedPage.getByRole('heading', { level: 1 }).first();
      await expect(heading).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display navigation menu', async ({ authenticatedPage }) => {
    // Check for navigation menu (adjust selector based on your UI)
    const navMenu = authenticatedPage.locator('nav, [role="navigation"], [data-testid="nav"]').first();
    await expect(navMenu).toBeVisible();
    
    // Check for main menu items
    const menuItems = ['Dashboard', 'Invoices', 'Expenses', 'Banking', 'Reports'];
    
    for (const item of menuItems) {
      const menuItem = authenticatedPage.getByRole('link', { name: new RegExp(item, 'i') });
      await expect(menuItem).toBeVisible({ timeout: 3000 });
    }
  });

  test('should highlight active menu item', async ({ authenticatedPage }) => {
    await navigateToModule(authenticatedPage, 'invoices');
    
    // Check that invoices menu item is active
    const activeMenuItem = authenticatedPage.locator('nav a[aria-current="page"], nav a.active').filter({ hasText: /invoices/i });
    await expect(activeMenuItem).toBeVisible({ timeout: 3000 });
  });

  test('should handle mobile navigation', async ({ authenticatedPage }) => {
    // Set mobile viewport
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    
    // Check for mobile menu toggle
    const menuToggle = authenticatedPage.locator('[aria-label*="menu"], [data-testid="menu-toggle"]').first();
    
    if (await menuToggle.isVisible()) {
      await menuToggle.click();
      
      // Check menu is open
      const mobileMenu = authenticatedPage.locator('[data-testid="mobile-menu"], nav[aria-expanded="true"]').first();
      await expect(mobileMenu).toBeVisible({ timeout: 2000 });
    }
  });
});

