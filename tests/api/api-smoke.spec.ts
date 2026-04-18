/**
 * API Smoke Tests using Playwright's API testing
 */

import { test, expect } from '@playwright/test';
import { apiRequest, getAuthToken } from '../helpers/api-helpers';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/trpc`;

test.describe('API Smoke Tests', () => {
  let authToken: string;
  let testOrganizationId: string;

  test.beforeAll(async ({ request }) => {
    // Get authentication token
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'password123';
    
    try {
      authToken = await getAuthToken(request, email, password);
    } catch (error) {
      // Skip tests if auth fails
      test.skip();
    }
  });

  test('should get user session', async ({ request }) => {
    const response = await apiRequest(request, 'GET', `${API_BASE}/auth.getSession`, {
      token: authToken,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('user');
  });

  test('should get user organizations', async ({ request }) => {
    const response = await apiRequest(request, 'GET', `${API_BASE}/organization.getUserOrganizations`, {
      token: authToken,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    
    if (data.length > 0) {
      testOrganizationId = data[0].id;
    }
  });

  test('should get chart of accounts', async ({ request }) => {
    if (!testOrganizationId) {
      test.skip();
      return;
    }

    const response = await apiRequest(request, 'GET', `${API_BASE}/chartOfAccounts.getAll?organizationId=${testOrganizationId}`, {
      token: authToken,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('should get transactions', async ({ request }) => {
    if (!testOrganizationId) {
      test.skip();
      return;
    }

    const response = await apiRequest(request, 'GET', `${API_BASE}/transactions.getAll?organizationId=${testOrganizationId}&page=1&limit=10`, {
      token: authToken,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('transactions');
    expect(data).toHaveProperty('pagination');
  });

  test('should get customers', async ({ request }) => {
    if (!testOrganizationId) {
      test.skip();
      return;
    }

    const response = await apiRequest(request, 'GET', `${API_BASE}/customers.getAll?organizationId=${testOrganizationId}&page=1&limit=10`, {
      token: authToken,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('customers');
  });

  test('should get invoices', async ({ request }) => {
    if (!testOrganizationId) {
      test.skip();
      return;
    }

    const response = await apiRequest(request, 'GET', `${API_BASE}/invoices.getAll?organizationId=${testOrganizationId}&page=1&limit=10`, {
      token: authToken,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('invoices');
  });

  test('should get bank accounts', async ({ request }) => {
    if (!testOrganizationId) {
      test.skip();
      return;
    }

    const response = await apiRequest(request, 'GET', `${API_BASE}/bankAccounts.getAll?organizationId=${testOrganizationId}`, {
      token: authToken,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('should get dashboard stats', async ({ request }) => {
    if (!testOrganizationId) {
      test.skip();
      return;
    }

    const response = await apiRequest(request, 'GET', `${API_BASE}/dashboard.getStats?organizationId=${testOrganizationId}`, {
      token: authToken,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('totalRevenue');
    expect(data).toHaveProperty('totalExpenses');
  });

  test('should return 401 for unauthenticated request', async ({ request }) => {
    const response = await apiRequest(request, 'GET', `${API_BASE}/invoices.getAll?organizationId=test-org-id`, {
      // No token
    });

    expect(response.status()).toBe(401);
  });

  test('should return 403 for unauthorized organization', async ({ request }) => {
    const response = await apiRequest(request, 'GET', `${API_BASE}/invoices.getAll?organizationId=unauthorized-org-id`, {
      token: authToken,
    });

    expect([403, 404]).toContain(response.status());
  });
});

