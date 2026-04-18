# Test Suite Documentation

## Overview

This directory contains the complete test suite for the Sumtise application, including E2E tests (Playwright) and API smoke tests (Postman collection).

## Test Structure

```
tests/
├── e2e/              # End-to-end tests
│   ├── auth.spec.ts
│   ├── invoices-flow.spec.ts
│   └── navigation.spec.ts
├── smoke/            # Smoke tests (quick checks)
│   ├── invoices.spec.ts
│   ├── bills.spec.ts
│   ├── banking.spec.ts
│   └── reporting.spec.ts
├── negative/         # Negative/security tests
│   └── org-access.spec.ts
├── api/              # API tests
│   └── api-smoke.spec.ts
├── fixtures/         # Test fixtures
│   └── auth.ts
└── helpers/          # Test helpers
    ├── page-helpers.ts
    └── api-helpers.ts
```

## Running Tests

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/invoices-flow.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium

# Run tests with debug
npx playwright test --debug
```

### Smoke Tests

```bash
# Run all smoke tests
npm run test:smoke

# Run with UI mode
npm run test:smoke:ui

# Run in headed mode
npm run test:smoke:headed
```

### API Tests

```bash
# Run API tests
npx playwright test tests/api
```

### Negative/Security Tests

```bash
# Run negative tests
npm run test:negative

# Run all security tests
npm run test:security
```

## Test Fixtures

### Authentication Fixtures

The `tests/fixtures/auth.ts` file provides pre-authenticated page fixtures:

- `authenticatedPage`: Default authenticated user
- `adminPage`: Admin user
- `viewerPage`: Viewer (read-only) user

**Usage:**

```typescript
import { test, expect } from '../fixtures/auth';

test('should access protected route', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/invoices');
  // Page is already authenticated
});
```

## Test Helpers

### Page Helpers

Located in `tests/helpers/page-helpers.ts`:

- `waitForPageLoad(page)`: Wait for page to fully load
- `selectOrganization(page, name)`: Select organization
- `navigateToModule(page, name)`: Navigate to module
- `fillFieldByLabel(page, label, value)`: Fill form field
- `clickButtonByText(page, text)`: Click button by text
- `waitForToast(page, message?)`: Wait for toast notification
- `getTableRowCount(page)`: Get table row count

### API Helpers

Located in `tests/helpers/api-helpers.ts`:

- `apiRequest(request, method, url, options)`: Make authenticated API request
- `getAuthToken(request, email, password)`: Get auth token
- `createTestOrganization(request, token, name)`: Create test organization
- `createTestInvoice(request, token, orgId, data)`: Create test invoice

## Environment Variables

Create a `.env.test` file with:

```env
# Test user credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=password123

# Admin user credentials
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=admin123

# Viewer user credentials
TEST_VIEWER_EMAIL=viewer@example.com
TEST_VIEWER_PASSWORD=viewer123

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Writing New Tests

### E2E Test Example

```typescript
import { test, expect } from '../fixtures/auth';
import { navigateToModule, fillFieldByLabel } from '../helpers/page-helpers';

test.describe('My Feature', () => {
  test('should do something', async ({ authenticatedPage }) => {
    await navigateToModule(authenticatedPage, 'invoices');
    
    // Your test code here
    await expect(authenticatedPage.getByText('Invoices')).toBeVisible();
  });
});
```

### API Test Example

```typescript
import { test, expect } from '@playwright/test';
import { apiRequest, getAuthToken } from '../helpers/api-helpers';

test('should get data', async ({ request }) => {
  const token = await getAuthToken(request, 'test@example.com', 'password');
  
  const response = await apiRequest(request, 'GET', '/api/endpoint', {
    token,
  });
  
  expect(response.ok()).toBeTruthy();
});
```

## Postman Collection

The Postman collection is located at `postman/Sumtise-API-Smoke-Tests.postman_collection.json`.

### Importing into Postman

1. Open Postman
2. Click "Import"
3. Select `postman/Sumtise-API-Smoke-Tests.postman_collection.json`
4. Configure environment variables:
   - `baseUrl`: `http://localhost:3000`
   - `authToken`: (will be set automatically after sign-in)
   - `organizationId`: (will be set automatically)

### Running Postman Tests

1. Run "Authentication > Sign In" first to get auth token
2. Run "Organizations > Get User Organizations" to set organization ID
3. Run other tests in any order

### Postman Environment Variables

Create a Postman environment with:

- `baseUrl`: `http://localhost:3000`
- `apiBase`: `{{baseUrl}}/api/trpc`

Other variables are set automatically by the collection.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## Debugging Tests

### Debug Mode

```bash
npx playwright test --debug
```

### Screenshots

Screenshots are automatically saved on test failure in `test-results/`.

### Traces

Traces are collected on retry. View with:

```bash
npx playwright show-trace trace.zip
```

## Best Practices

1. **Use fixtures** for authentication instead of manual sign-in
2. **Use helpers** for common operations
3. **Wait for elements** before interacting
4. **Use data-testid** attributes for stable selectors
5. **Clean up test data** after tests
6. **Use descriptive test names**
7. **Group related tests** in describe blocks
8. **Skip tests** that require specific conditions

## Troubleshooting

### Tests timing out

- Increase timeout in `playwright.config.ts`
- Check if dev server is running
- Verify base URL is correct

### Authentication failing

- Check test user credentials in `.env.test`
- Verify auth endpoint is working
- Check if test user exists in database

### Elements not found

- Use `page.pause()` to debug
- Check if page loaded correctly
- Verify selectors are correct

## Next Steps

- [ ] Add more E2E test coverage
- [ ] Add performance tests
- [ ] Add visual regression tests
- [ ] Set up CI/CD pipeline
- [ ] Add test data seeding
- [ ] Add test cleanup utilities

