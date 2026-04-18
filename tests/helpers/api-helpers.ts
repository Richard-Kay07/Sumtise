/**
 * API helper utilities for Playwright tests
 */

import { APIRequestContext, expect } from '@playwright/test';

/**
 * Make authenticated API request
 */
export async function apiRequest(
  request: APIRequestContext,
  method: string,
  url: string,
  options: {
    token?: string;
    data?: any;
    headers?: Record<string, string>;
  } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const response = await request.fetch(url, {
    method,
    headers,
    data: options.data ? JSON.stringify(options.data) : undefined,
  });

  return response;
}

/**
 * Get authentication token (adjust based on your auth setup)
 */
export async function getAuthToken(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const response = await request.post('/api/auth/signin', {
    data: {
      email,
      password,
    },
  });

  const data = await response.json();
  return data.token || data.accessToken || '';
}

/**
 * Create test organization
 */
export async function createTestOrganization(
  request: APIRequestContext,
  token: string,
  name: string
) {
  const response = await apiRequest(request, 'POST', '/api/trpc/organization.create', {
    token,
    data: {
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
    },
  });

  expect(response.ok()).toBeTruthy();
  return await response.json();
}

/**
 * Create test invoice
 */
export async function createTestInvoice(
  request: APIRequestContext,
  token: string,
  organizationId: string,
  invoiceData: any
) {
  const response = await apiRequest(request, 'POST', '/api/trpc/invoices.create', {
    token,
    data: {
      organizationId,
      ...invoiceData,
    },
  });

  expect(response.ok()).toBeTruthy();
  return await response.json();
}

/**
 * Get invoices list
 */
export async function getInvoices(
  request: APIRequestContext,
  token: string,
  organizationId: string
) {
  const response = await apiRequest(request, 'GET', `/api/trpc/invoices.getAll?organizationId=${organizationId}`, {
    token,
  });

  expect(response.ok()).toBeTruthy();
  return await response.json();
}

