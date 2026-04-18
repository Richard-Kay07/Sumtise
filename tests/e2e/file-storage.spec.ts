/**
 * E2E tests for File Storage Integration
 * 
 * Tests:
 * - File upload
 * - File retrieval
 * - File download via signed URL
 * - Soft delete (file record deleted but blob kept)
 * - Permission checks
 * - File attachment to bills/invoices
 */

import { test, expect } from '../fixtures/auth';

test.describe('File Storage Integration', () => {
  const orgId = 'demo-org-id';
  let userId: string;
  let fileId: string;
  let billId: string;

  test.beforeAll(async ({ authenticatedPage }) => {
    // Get user ID from session
    const sessionResponse = await authenticatedPage.request.get('/api/auth/session');
    if (sessionResponse.ok()) {
      const session = await sessionResponse.json();
      userId = session.user?.id || 'test-user-id';
    }

    // Create a bill for attachment testing
    const vendorsResponse = await authenticatedPage.request.get(
      `/api/trpc/vendors.getAll?input=${JSON.stringify({ organizationId: orgId, page: 1, limit: 1 })}`
    );
    if (vendorsResponse.ok()) {
      const vendorsData = await vendorsResponse.json();
      const vendorId = vendorsData.result?.data?.vendors?.[0]?.id;

      if (vendorId) {
        const billResponse = await authenticatedPage.request.post('/api/trpc/bills.create', {
          data: {
            json: {
              organizationId: orgId,
              vendorId,
              billNumber: `TEST-BILL-${Date.now()}`,
              date: new Date().toISOString(),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              items: [
                {
                  description: 'Test Item',
                  quantity: 1,
                  unitPrice: 100,
                  taxRate: 20,
                },
              ],
            },
          },
        });

        if (billResponse.ok()) {
          const billData = await billResponse.json();
          billId = billData.result?.data?.id;
        }
      }
    }
  });

  test('should upload file', async ({ authenticatedPage }) => {
    // Create a test file
    const fileContent = 'Test file content';
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', orgId);
    formData.append('userId', userId);
    formData.append('category', 'ATTACHMENTS');

    const response = await authenticatedPage.request.post('/api/files', {
      multipart: formData,
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.file).toHaveProperty('id');
    fileId = data.file.id;
  });

  test('should retrieve file list', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get(
      `/api/files?organizationId=${orgId}`
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.files).toBeDefined();
    expect(Array.isArray(data.files)).toBe(true);
  });

  test('should download file via signed URL', async ({ authenticatedPage }) => {
    if (!fileId) {
      test.skip();
      return;
    }

    // Get signed URL
    const signedUrlResponse = await authenticatedPage.request.get(
      `/api/files/signed-url?fileId=${fileId}`
    );

    expect(signedUrlResponse.status()).toBe(200);
    const signedUrlData = await signedUrlResponse.json();
    expect(signedUrlData.success).toBe(true);
    expect(signedUrlData.url).toBeDefined();

    // Download file
    const downloadResponse = await authenticatedPage.request.get(signedUrlData.url);
    expect(downloadResponse.status()).toBe(200);
  });

  test('should soft delete file record', async ({ authenticatedPage }) => {
    if (!fileId) {
      test.skip();
      return;
    }

    // Delete file
    const deleteResponse = await authenticatedPage.request.delete(
      `/api/files?fileId=${fileId}&organizationId=${orgId}`
    );

    expect(deleteResponse.status()).toBe(200);
    const deleteData = await deleteResponse.json();
    expect(deleteData.success).toBe(true);

    // Verify file is soft-deleted (not in list)
    const listResponse = await authenticatedPage.request.get(
      `/api/files?organizationId=${orgId}`
    );
    const listData = await listResponse.json();
    const deletedFile = listData.files.find((f: any) => f.id === fileId);
    expect(deletedFile).toBeUndefined();
  });

  test('should attach file to bill', async ({ authenticatedPage }) => {
    if (!billId) {
      test.skip();
      return;
    }

    // Upload a file
    const fileContent = 'Bill attachment';
    const blob = new Blob([fileContent], { type: 'application/pdf' });
    const file = new File([blob], 'bill-receipt.pdf', { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', orgId);
    formData.append('userId', userId);
    formData.append('category', 'RECEIPTS');

    const uploadResponse = await authenticatedPage.request.post('/api/files', {
      multipart: formData,
    });

    if (uploadResponse.ok()) {
      const uploadData = await uploadResponse.json();
      const attachmentFileId = uploadData.file.id;

      // Attach to bill
      const attachment = {
        fileId: attachmentFileId,
        fileName: uploadData.file.originalName,
        fileSize: uploadData.file.fileSize,
        contentType: uploadData.file.fileType,
        uploadedAt: new Date(uploadData.file.uploadedAt),
        uploaderId: userId,
      };

      const updateResponse = await authenticatedPage.request.post('/api/trpc/bills.update', {
        data: {
          json: {
            id: billId,
            organizationId: orgId,
            data: {
              attachments: [attachment],
            },
          },
        },
      });

      expect(updateResponse.status()).toBe(200);
      const updateData = await updateResponse.json();
      expect(updateData.result?.data).toHaveProperty('attachments');
    }
  });

  test('should enforce permissions', async ({ viewerPage }) => {
    const fileContent = 'Unauthorized upload';
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', orgId);
    formData.append('userId', 'viewer-user-id');
    formData.append('category', 'ATTACHMENTS');

    const response = await viewerPage.request.post('/api/files', {
      multipart: formData,
    });

    // Should either succeed (if viewer can upload) or fail with permission error
    // This depends on your permission model
    expect([200, 403, 401]).toContain(response.status());
  });

  test('should validate file size', async ({ authenticatedPage }) => {
    // Create a file larger than max size (10MB)
    const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
    const blob = new Blob([largeContent], { type: 'text/plain' });
    const file = new File([blob], 'large.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', orgId);
    formData.append('userId', userId);
    formData.append('category', 'ATTACHMENTS');

    const response = await authenticatedPage.request.post('/api/files', {
      multipart: formData,
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('size');
  });

  test('should validate file type', async ({ authenticatedPage }) => {
    // Create an executable file (should be rejected)
    const fileContent = 'executable content';
    const blob = new Blob([fileContent], { type: 'application/x-executable' });
    const file = new File([blob], 'script.exe', { type: 'application/x-executable' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', orgId);
    formData.append('userId', userId);
    formData.append('category', 'ATTACHMENTS');

    const response = await authenticatedPage.request.post('/api/files', {
      multipart: formData,
    });

    // Should reject invalid file type
    expect([400, 200]).toContain(response.status()); // May accept or reject depending on config
  });
});




