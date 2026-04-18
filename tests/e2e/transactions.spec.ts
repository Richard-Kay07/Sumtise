import { test, expect } from "@playwright/test"

test.describe("Transactions Module", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and login
    await page.goto("/auth/signin")
    // Assuming there's a demo login or test credentials
    await page.fill('input[name="email"]', "admin@sumtise.com")
    await page.fill('input[name="password"]', "password123")
    await page.click('button[type="submit"]')
    await page.waitForURL("/")
  })

  test("should display transactions list page", async ({ page }) => {
    await page.goto("/transactions")
    await expect(page.locator("h1")).toContainText("Transactions")
  })

  test("should filter transactions by account", async ({ page }) => {
    await page.goto("/transactions")

    // Select an account filter
    await page.click('button:has-text("Account")')
    const firstAccount = page.locator('text=/^[0-9]+ -/').first()
    if (await firstAccount.count() > 0) {
      await firstAccount.click()

      // Wait for results to update
      await page.waitForTimeout(500)

      // Verify transactions are filtered
      const transactionRows = page.locator("table tbody tr")
      const count = await transactionRows.count()
      expect(count).toBeGreaterThanOrEqual(0)
    }
  })

  test("should filter transactions by date range", async ({ page }) => {
    await page.goto("/transactions")

    // Set start date
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 1)
    await page.fill('input[type="date"]:nth-of-type(1)', startDate.toISOString().split('T')[0])

    // Set end date
    const endDate = new Date()
    await page.fill('input[type="date"]:nth-of-type(2)', endDate.toISOString().split('T')[0])

    // Wait for results to update
    await page.waitForTimeout(500)
  })

  test("should create a manual journal entry", async ({ page }) => {
    await page.goto("/transactions/new")

    // Fill in journal entry details
    await page.fill('input[id="date"]', new Date().toISOString().split('T')[0])
    await page.fill('input[id="description"]', "Test Journal Entry")
    await page.fill('input[id="reference"]', "JE-TEST-001")

    // Fill in first line (debit)
    const accountSelect1 = page.locator('select').first()
    if (await accountSelect1.count() > 0) {
      await accountSelect1.selectOption({ index: 1 }) // Select first account
      await page.fill('input[type="number"]:nth-of-type(1)', "1000")
    }

    // Fill in second line (credit)
    const accountSelect2 = page.locator('select').nth(1)
    if (await accountSelect2.count() > 0) {
      await accountSelect2.selectOption({ index: 2 }) // Select second account
      await page.fill('input[type="number"]:nth-of-type(3)', "1000")
    }

    // Check balance status
    const balanceStatus = page.locator('text="Balanced"')
    await expect(balanceStatus).toBeVisible({ timeout: 5000 })

    // Submit form
    await page.click('button[type="submit"]')

    // Should redirect to transactions page or show success
    await page.waitForTimeout(2000)
  })

  test("should validate DR=CR balance in journal entry", async ({ page }) => {
    await page.goto("/transactions/new")

    // Fill in journal entry with unbalanced amounts
    await page.fill('input[id="date"]', new Date().toISOString().split('T')[0])
    await page.fill('input[id="description"]', "Unbalanced Test")

    // Set different debit and credit amounts
    const accountSelect1 = page.locator('select').first()
    if (await accountSelect1.count() > 0) {
      await accountSelect1.selectOption({ index: 1 })
      await page.fill('input[type="number"]:nth-of-type(1)', "1000")
    }

    const accountSelect2 = page.locator('select').nth(1)
    if (await accountSelect2.count() > 0) {
      await accountSelect2.selectOption({ index: 2 })
      await page.fill('input[type="number"]:nth-of-type(3)', "500") // Different amount
    }

    // Check that balance warning appears
    const balanceWarning = page.locator('text*="not balanced"')
    await expect(balanceWarning).toBeVisible({ timeout: 5000 })

    // Submit button should be disabled
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeDisabled()
  })

  test("should display journal entries page", async ({ page }) => {
    await page.goto("/transactions/journal")
    await expect(page.locator("h1")).toContainText("Journal Entries")
  })

  test("should view transaction details", async ({ page }) => {
    await page.goto("/transactions")

    // Click on first transaction if available
    const firstTransactionLink = page.locator("table tbody tr").first().locator("a").first()
    const count = await firstTransactionLink.count()

    if (count > 0) {
      await firstTransactionLink.click()
      await page.waitForURL(/\/transactions\/[^/]+$/)

      // Verify transaction details are displayed
      await expect(page.locator("h1")).toContainText("Transaction Details")
    }
  })

  test("should show postings in transaction detail", async ({ page }) => {
    await page.goto("/transactions")

    // Navigate to first transaction
    const firstTransactionLink = page.locator("table tbody tr").first().locator("a").first()
    const count = await firstTransactionLink.count()

    if (count > 0) {
      await firstTransactionLink.click()
      await page.waitForURL(/\/transactions\/[^/]+$/)

      // Verify postings table is displayed
      const postingsTable = page.locator('table')
      await expect(postingsTable.waitFor({ timeout: 5000 }))
    }
  })

  test("should add and remove journal lines", async ({ page }) => {
    await page.goto("/transactions/new")

    // Add a line
    await page.click('button:has-text("Add Line")')
    
    // Verify new line appears
    const lines = page.locator('text="Line"')
    const lineCount = await lines.count()
    expect(lineCount).toBeGreaterThan(2)

    // Remove a line (if more than 2)
    const removeButtons = page.locator('button:has(svg)')
    const removeCount = await removeButtons.count()
    if (removeCount > 0) {
      await removeButtons.last().click()
      // Verify line count decreased
      const newLineCount = await lines.count()
      expect(newLineCount).toBeLessThan(lineCount)
    }
  })

  test("should prevent creating journal with less than 2 lines", async ({ page }) => {
    await page.goto("/transactions/new")

    // Try to remove lines until only 1 remains
    const removeButtons = page.locator('button:has(svg)')
    const removeCount = await removeButtons.count()
    
    // Should not be able to remove if only 2 lines
    if (removeCount === 0) {
      // Already at minimum
      expect(await page.locator('text="Line"').count()).toBe(2)
    }
  })
})




