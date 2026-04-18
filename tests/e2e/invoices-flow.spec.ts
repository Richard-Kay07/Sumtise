/**
 * E2E tests for Invoices flow (create, view, edit, delete)
 */

import { test, expect } from '../fixtures/auth';
import { navigateToModule, fillFieldByLabel, clickButtonByText, waitForToast, waitForLoadingToComplete } from '../helpers/page-helpers';

test.describe('Invoices Flow', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await navigateToModule(authenticatedPage, 'invoices');
  });

  test('should display invoices page', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.getByRole('heading', { name: /invoices/i })).toBeVisible();
    
    // Check for search input
    const searchInput = authenticatedPage.getByPlaceholder(/search.*invoice/i);
    await expect(searchInput).toBeVisible();
  });

  test('should create new invoice', async ({ authenticatedPage }) => {
    // Click create invoice button
    await clickButtonByText(authenticatedPage, 'create.*invoice|new.*invoice');
    
    // Wait for form to load
    await waitForLoadingToComplete(authenticatedPage);
    
    // Fill invoice form (adjust fields based on your form)
    await fillFieldByLabel(authenticatedPage, 'customer', 'Test Customer');
    await fillFieldByLabel(authenticatedPage, 'date', '2024-01-15');
    await fillFieldByLabel(authenticatedPage, 'due date', '2024-02-15');
    
    // Add invoice item
    const addItemButton = authenticatedPage.getByRole('button', { name: /add.*item/i });
    if (await addItemButton.isVisible()) {
      await addItemButton.click();
      await fillFieldByLabel(authenticatedPage, 'description', 'Test Item');
      await fillFieldByLabel(authenticatedPage, 'quantity', '1');
      await fillFieldByLabel(authenticatedPage, 'price', '100.00');
    }
    
    // Submit form
    await clickButtonByText(authenticatedPage, 'save|create|submit');
    
    // Wait for success message
    await waitForToast(authenticatedPage, /created|saved|success/i);
    
    // Should redirect to invoices list or show success
    await expect(authenticatedPage).toHaveURL(/\/invoices/, { timeout: 5000 });
  });

  test('should view invoice details', async ({ authenticatedPage }) => {
    // Find first invoice in table
    const firstInvoice = authenticatedPage.locator('table tbody tr').first();
    
    if (await firstInvoice.isVisible()) {
      // Click on invoice row or view button
      await firstInvoice.click();
      
      // Should navigate to invoice detail page
      await expect(authenticatedPage).toHaveURL(/\/invoices\/[^/]+/, { timeout: 5000 });
      
      // Check for invoice details
      await expect(authenticatedPage.getByText(/invoice.*number|invoice.*#/i)).toBeVisible();
    } else {
      // Skip if no invoices exist
      test.skip();
    }
  });

  test('should edit invoice', async ({ authenticatedPage }) => {
    // Find first invoice
    const firstInvoice = authenticatedPage.locator('table tbody tr').first();
    
    if (await firstInvoice.isVisible()) {
      // Click edit button
      const editButton = firstInvoice.getByRole('button', { name: /edit/i });
      await editButton.click();
      
      // Wait for edit form
      await waitForLoadingToComplete(authenticatedPage);
      
      // Modify a field
      await fillFieldByLabel(authenticatedPage, 'description', 'Updated Description');
      
      // Save changes
      await clickButtonByText(authenticatedPage, 'save|update');
      
      // Wait for success
      await waitForToast(authenticatedPage, /updated|saved/i);
    } else {
      test.skip();
    }
  });

  test('should delete invoice', async ({ authenticatedPage }) => {
    // Find first invoice
    const firstInvoice = authenticatedPage.locator('table tbody tr').first();
    
    if (await firstInvoice.isVisible()) {
      // Click delete button
      const deleteButton = firstInvoice.getByRole('button', { name: /delete/i });
      await deleteButton.click();
      
      // Confirm deletion in dialog
      const confirmButton = authenticatedPage.getByRole('button', { name: /confirm|delete/i });
      await confirmButton.click();
      
      // Wait for success
      await waitForToast(authenticatedPage, /deleted|removed/i);
    } else {
      test.skip();
    }
  });

  test('should filter invoices by status', async ({ authenticatedPage }) => {
    // Find status filter
    const statusFilter = authenticatedPage.locator('select').filter({ hasText: /status/i }).first();
    
    if (await statusFilter.isVisible()) {
      // Select a status
      await statusFilter.selectOption('PAID');
      
      // Wait for table to update
      await waitForLoadingToComplete(authenticatedPage);
      
      // Verify filter is applied (check URL or table content)
      const url = authenticatedPage.url();
      expect(url).toContain('status=PAID');
    }
  });

  test('should search invoices', async ({ authenticatedPage }) => {
    const searchInput = authenticatedPage.getByPlaceholder(/search.*invoice/i);
    
    if (await searchInput.isVisible()) {
      // Enter search term
      await searchInput.fill('INV-');
      
      // Wait for search results
      await authenticatedPage.waitForTimeout(500); // Debounce delay
      await waitForLoadingToComplete(authenticatedPage);
      
      // Verify search is applied
      const url = authenticatedPage.url();
      expect(url).toContain('search=') || expect(searchInput).toHaveValue('INV-');
    }
  });
});

