/**
 * Page helper utilities for Playwright tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Select organization from organization selector
 */
export async function selectOrganization(page: Page, organizationName: string) {
  // Look for organization selector (adjust selector based on your UI)
  const orgSelector = page.locator('[data-testid="org-selector"], select[name="organization"], [aria-label*="organization"]').first();
  
  if (await orgSelector.isVisible()) {
    await orgSelector.selectOption({ label: organizationName });
    await page.waitForTimeout(500); // Wait for organization to load
  }
}

/**
 * Navigate to a module page
 */
export async function navigateToModule(page: Page, moduleName: string) {
  const moduleMap: Record<string, string> = {
    'dashboard': '/',
    'invoices': '/invoices',
    'expenses': '/expenses',
    'customers': '/customers',
    'vendors': '/vendors',
    'banking': '/banking',
    'reports': '/reports',
    'settings': '/settings',
  };

  const path = moduleMap[moduleName.toLowerCase()] || `/${moduleName.toLowerCase()}`;
  await page.goto(path);
  await waitForPageLoad(page);
}

/**
 * Fill form field by label
 */
export async function fillFieldByLabel(page: Page, label: string, value: string) {
  const field = page.getByLabel(label, { exact: false });
  await expect(field).toBeVisible();
  await field.fill(value);
}

/**
 * Click button by text
 */
export async function clickButtonByText(page: Page, text: string) {
  const button = page.getByRole('button', { name: new RegExp(text, 'i') });
  await expect(button).toBeVisible();
  await button.click();
}

/**
 * Wait for toast/notification
 */
export async function waitForToast(page: Page, message?: string) {
  const toast = page.locator('[role="alert"], [data-testid="toast"], .toast').first();
  await expect(toast).toBeVisible({ timeout: 5000 });
  
  if (message) {
    await expect(toast).toContainText(message);
  }
}

/**
 * Check if element is visible (non-throwing)
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.locator(selector).isVisible({ timeout: 1000 });
  } catch {
    return false;
  }
}

/**
 * Get table row count
 */
export async function getTableRowCount(page: Page, tableSelector = 'table'): Promise<number> {
  const rows = page.locator(`${tableSelector} tbody tr`);
  return await rows.count();
}

/**
 * Wait for API response
 */
export async function waitForAPIResponse(page: Page, urlPattern: string | RegExp) {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout: 10000 }
  );
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ path: `tests/screenshots/${name}-${timestamp}.png`, fullPage: true });
}

/**
 * Check for console errors
 */
export async function checkConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  return errors;
}

/**
 * Wait for loading spinner to disappear
 */
export async function waitForLoadingToComplete(page: Page) {
  // Wait for common loading indicators to disappear
  await page.waitForSelector('[data-testid="loading"], .spinner, [aria-busy="true"]', {
    state: 'hidden',
    timeout: 10000,
  }).catch(() => {
    // Ignore if no loading indicator found
  });
}

