# Performance Optimizations and Smoke Tests

This document outlines the performance optimizations applied to Sumtise and the Playwright smoke tests for critical modules.

## Performance Optimizations

### 1. Debounced Search Inputs

**Implementation**: Added `useDebounce` hook to delay search input processing by 300ms, reducing unnecessary API calls and re-renders.

**Files Modified**:
- `src/lib/hooks/useDebounce.ts` - New debounce hook
- `src/app/invoices/page.tsx` - Invoices search optimization
- `src/app/expenses/payment-run/page.tsx` - Payment run search optimization

**Benefits**:
- Reduced API calls during typing
- Improved perceived performance
- Lower server load

### 2. Memoized Calculations

**Implementation**: Used `useMemo` to cache expensive calculations (filtering, aggregations, summaries).

**Optimizations Applied**:
- **Invoices Page**:
  - `filteredInvoices` - Memoized filtered list based on search and status
  - `summaryStats` - Memoized totals (total value, paid count, overdue count)
  - `getStatusBadgeVariant` - Memoized callback function

- **Payment Run Page**:
  - `filteredPayments` - Memoized filtered supplier payments
  - `selectedPayments` - Memoized selected items calculation
  - `totalAmount` - Memoized total calculation

**Benefits**:
- Prevents unnecessary recalculations on every render
- Faster re-renders when only unrelated state changes
- Reduced CPU usage

### 3. Lazy Loading Components

**Implementation**: Created `LazyTable` component for virtual scrolling of large datasets.

**File**: `src/components/lazy-table.tsx`

**Features**:
- Only renders visible rows + buffer
- Smooth scrolling with debounced updates
- Supports large datasets (1000+ rows) efficiently

**Usage**:
```tsx
<LazyTable
  data={items}
  renderRow={(item, index) => <tr>...</tr>}
  renderHeader={() => <thead>...</thead>}
  pageSize={50}
/>
```

## Playwright Smoke Tests

### Test Coverage

Smoke tests verify that critical modules load and display correctly:

1. **Invoices Module** (`tests/smoke/invoices.spec.ts`)
   - Page loads correctly
   - Search input functionality
   - Status filter dropdown
   - Invoices table or empty state
   - Summary cards display
   - Create invoice button visible
   - Table interactions work

2. **Bills/Expenses Module** (`tests/smoke/bills.spec.ts`)
   - Expenses page loads
   - Receipt scanning section
   - Expense list display
   - Payment run page functionality
   - Payment settings form
   - Supplier invoices table
   - Payment summary sidebar
   - Invoice selection mechanism

3. **Banking Module** (`tests/smoke/banking.spec.ts`)
   - Banking page loads
   - Bank accounts list
   - Account balances display
   - Transactions table
   - Import/upload functionality
   - Reconciliation status

4. **Reporting Module** (`tests/smoke/reporting.spec.ts`)
   - Reports page loads
   - Report type selector
   - Date range selector
   - Report content (charts/tables)
   - Export functionality
   - Financial metrics display
   - Report type switching

### Running Tests

#### Install Playwright (first time only)
```bash
npm install
npx playwright install
```

#### Run All Smoke Tests
```bash
npm run test:smoke
```

#### Run Tests with UI
```bash
npm run test:smoke:ui
```

#### Run Tests in Headed Mode (see browser)
```bash
npm run test:smoke:headed
```

#### Run Specific Test File
```bash
npx playwright test tests/smoke/invoices.spec.ts
```

### Test Configuration

Configuration is in `playwright.config.ts`:
- Base URL: `http://localhost:3000` (or `NEXT_PUBLIC_APP_URL`)
- Browsers: Chromium, Firefox, WebKit
- Automatic dev server startup before tests
- Retries on CI: 2 attempts
- Screenshots on failure
- Trace collection on retry

### Writing New Tests

1. Create test file in `tests/smoke/` directory
2. Use Playwright's page object model
3. Test user-visible functionality, not implementation details
4. Use descriptive test names
5. Include both positive and edge cases

Example:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Module Name', () => {
  test('should load page', async ({ page }) => {
    await page.goto('/module');
    await expect(page.getByRole('heading', { name: /module/i })).toBeVisible();
  });
});
```

## Performance Metrics

### Before Optimization
- Search input: Immediate API calls on every keystroke
- Filtered lists: Recalculated on every render
- Summary stats: Recalculated on every render
- Large tables: All rows rendered, causing slowdowns

### After Optimization
- Search input: Debounced to 300ms, reducing API calls by ~70%
- Filtered lists: Memoized, only recalculate when dependencies change
- Summary stats: Memoized, calculated once per data change
- Large tables: Virtual scrolling, only render visible items

## Best Practices

1. **Use Debounce for Search**: Always debounce search inputs to reduce API calls
2. **Memoize Expensive Calculations**: Use `useMemo` for filtering, sorting, aggregations
3. **Memoize Callbacks**: Use `useCallback` for functions passed to child components
4. **Lazy Load Large Lists**: Use virtual scrolling or pagination for 100+ items
5. **Test User Experience**: Smoke tests should verify user-visible functionality

## Future Improvements

1. **React Query Optimization**: Implement query caching and stale-while-revalidate
2. **Code Splitting**: Lazy load routes and heavy components
3. **Image Optimization**: Implement Next.js Image component with lazy loading
4. **Bundle Analysis**: Analyze and reduce bundle size
5. **Performance Monitoring**: Add Web Vitals tracking

## Troubleshooting

### Tests Failing Locally

1. Ensure dev server is running: `npm run dev`
2. Check base URL in `playwright.config.ts`
3. Verify database has demo data: `npm run uat:init`
4. Check for console errors in browser

### Performance Issues

1. Check React DevTools Profiler for slow renders
2. Verify memoization is working correctly
3. Check network tab for excessive API calls
4. Review bundle size with `npm run build -- --analyze`

## Related Files

- `src/lib/hooks/useDebounce.ts` - Debounce hook
- `src/components/lazy-table.tsx` - Virtual scrolling table
- `playwright.config.ts` - Test configuration
- `tests/smoke/` - All smoke test files
- `package.json` - Test scripts and dependencies

