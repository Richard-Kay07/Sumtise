import { test, expect } from '@playwright/test'

test.describe('Purchase Orders Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/purchase-orders/all')
  })

  test('list page loads with correct title', async ({ page }) => {
    await expect(page.getByText(/purchase orders/i).first()).toBeVisible()
  })

  test('shows New PO button', async ({ page }) => {
    const btn = page.getByRole('link', { name: /new po/i })
    await expect(btn).toBeVisible()
  })

  test('shows status filter buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /all/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /draft/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /approved/i })).toBeVisible()
  })

  test('shows empty state or PO table', async ({ page }) => {
    const emptyState = page.getByText(/no purchase orders/i)
    const table      = page.locator('table')
    const hasEmpty   = await emptyState.isVisible().catch(() => false)
    const hasTable   = await table.isVisible().catch(() => false)
    expect(hasEmpty || hasTable).toBeTruthy()
  })

  test('New PO page loads', async ({ page }) => {
    await page.goto('/purchase-orders/new')
    await expect(page.getByText(/new purchase order/i)).toBeVisible()
  })

  test('New PO form has required fields', async ({ page }) => {
    await page.goto('/purchase-orders/new')
    await expect(page.getByText(/vendor/i).first()).toBeVisible()
    await expect(page.getByText(/po date/i)).toBeVisible()
    await expect(page.getByText(/line items/i)).toBeVisible()
  })

  test('New PO form has add line button', async ({ page }) => {
    await page.goto('/purchase-orders/new')
    await expect(page.getByRole('button', { name: /add line/i })).toBeVisible()
  })

  test('Committed spend page loads', async ({ page }) => {
    await page.goto('/purchase-orders/committed-spend')
    await expect(page.getByText(/committed spend/i)).toBeVisible()
    await expect(page.getByText(/budget vs committed/i)).toBeVisible()
  })

  test('Committed spend has period filters', async ({ page }) => {
    await page.goto('/purchase-orders/committed-spend')
    await expect(page.getByText(/period start/i)).toBeVisible()
    await expect(page.getByText(/period end/i)).toBeVisible()
  })
})
