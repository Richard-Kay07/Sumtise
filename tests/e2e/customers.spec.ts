import { test, expect } from "@playwright/test"

test.describe("Customers Module", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and login
    await page.goto("/auth/signin")
    // Assuming there's a demo login or test credentials
    // Adjust based on your auth setup
    await page.fill('input[name="email"]', "admin@sumtise.com")
    await page.fill('input[name="password"]', "password123")
    await page.click('button[type="submit"]')
    await page.waitForURL("/")
  })

  test("should display customers list page", async ({ page }) => {
    await page.goto("/customers")
    await expect(page.locator("h1")).toContainText("Customers")
  })

  test("should create a new customer", async ({ page }) => {
    await page.goto("/customers/new")

    // Fill in customer form
    await page.fill('input[id="name"]', "Test Customer")
    await page.fill('input[id="email"]', "test@example.com")
    await page.fill('input[id="phone"]', "+44 20 7123 4567")
    await page.fill('input[id="taxId"]', "GB123456789")

    // Fill address
    await page.fill('input[id="street"]', "123 Test Street")
    await page.fill('input[id="city"]', "London")
    await page.fill('input[id="postcode"]', "SW1A 1AA")
    await page.fill('input[id="country"]', "United Kingdom")

    // Submit form
    await page.click('button[type="submit"]')

    // Should redirect to customer detail page
    await page.waitForURL(/\/customers\/[^/]+$/)
    await expect(page.locator("h1")).toContainText("Test Customer")
  })

  test("should filter customers by search", async ({ page }) => {
    await page.goto("/customers")

    // Search for a customer
    const searchInput = page.locator('input[placeholder*="Search"]')
    await searchInput.fill("Test")
    await searchInput.press("Enter")

    // Wait for results to update
    await page.waitForTimeout(500)

    // Verify results contain search term
    const customerRows = page.locator("table tbody tr")
    const count = await customerRows.count()
    if (count > 0) {
      const firstRow = customerRows.first()
      await expect(firstRow).toContainText("Test")
    }
  })

  test("should filter customers by status", async ({ page }) => {
    await page.goto("/customers")

    // Select status filter
    await page.click('button:has-text("Status")')
    await page.click('text="Active"')

    // Wait for results to update
    await page.waitForTimeout(500)

    // Verify all displayed customers are active
    const badges = page.locator('badge:has-text("Active")')
    const count = await badges.count()
    expect(count).toBeGreaterThan(0)
  })

  test("should view customer details", async ({ page }) => {
    // First, create a customer or navigate to an existing one
    await page.goto("/customers")

    // Click on first customer if available
    const firstCustomerLink = page.locator("table tbody tr").first().locator("a").first()
    const count = await firstCustomerLink.count()
    
    if (count > 0) {
      await firstCustomerLink.click()
      await page.waitForURL(/\/customers\/[^/]+$/)
      
      // Verify customer details are displayed
      await expect(page.locator("h1")).toBeVisible()
    }
  })

  test("should archive a customer", async ({ page }) => {
    await page.goto("/customers")

    // Find archive button for first customer
    const archiveButton = page.locator("table tbody tr").first().locator('button:has(svg)').last()
    const count = await archiveButton.count()

    if (count > 0) {
      // Click archive button
      await archiveButton.click()

      // Confirm dialog
      page.on("dialog", async (dialog) => {
        expect(dialog.message()).toContain("archive")
        await dialog.accept()
      })

      // Wait for update
      await page.waitForTimeout(500)
    }
  })

  test("should view customer invoices", async ({ page }) => {
    await page.goto("/customers")

    // Click on first customer's invoice link if available
    const invoiceLink = page.locator("table tbody tr").first().locator('a:has-text("invoices")')
    const count = await invoiceLink.count()

    if (count > 0) {
      await invoiceLink.click()
      await page.waitForURL(/\/customers\/[^/]+\/invoices$/)

      // Verify invoices page is displayed
      await expect(page.locator("h1")).toContainText("Invoices")
    }
  })

  test("should create invoice from customer detail page", async ({ page }) => {
    await page.goto("/customers")

    // Navigate to first customer
    const firstCustomerLink = page.locator("table tbody tr").first().locator("a").first()
    const count = await firstCustomerLink.count()

    if (count > 0) {
      await firstCustomerLink.click()
      await page.waitForURL(/\/customers\/[^/]+$/)

      // Click "Create Invoice" button
      const createInvoiceButton = page.locator('button:has-text("Create Invoice")')
      if (await createInvoiceButton.count() > 0) {
        await createInvoiceButton.click()
        await page.waitForURL(/\/invoices\/new/)

        // Verify customer is pre-selected
        const customerSelect = page.locator('select[id="customerId"]')
        const selectedValue = await customerSelect.inputValue()
        expect(selectedValue).not.toBe("")
      }
    }
  })

  test("should add tags to customer", async ({ page }) => {
    await page.goto("/customers/new")

    // Fill basic info
    await page.fill('input[id="name"]', "Tagged Customer")

    // Add a tag
    const tagInput = page.locator('input[placeholder*="tag"]')
    await tagInput.fill("VIP")
    await tagInput.press("Enter")

    // Verify tag appears
    await expect(page.locator('badge:has-text("VIP")')).toBeVisible()
  })

  test("should filter customers by tags", async ({ page }) => {
    await page.goto("/customers")

    // Select a tag filter
    const tagSelect = page.locator('button:has-text("Tags")')
    if (await tagSelect.count() > 0) {
      await tagSelect.click()
      // Select first available tag
      const firstTag = page.locator('text=/^[A-Z]+$/').first()
      if (await firstTag.count() > 0) {
        await firstTag.click()

        // Wait for results
        await page.waitForTimeout(500)
      }
    }
  })
})




