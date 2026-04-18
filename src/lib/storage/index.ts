/**
 * File Storage Utility
 * 
 * Unified file storage interface supporting:
 * - AWS S3
 * - Google Cloud Storage
 * - Local filesystem
 * 
 * Features:
 * - Upload files (buffer or stream)
 * - Retrieve files
 * - Delete files
 * - Generate signed URLs for secure access
 * - Virus scanning hook (stub)
 * - Encryption at rest (provider default)
 */

import { StorageDriver, StorageConfig, UploadResult, FileMetadata } from './types'
import { LocalStorageDriver } from './drivers/local'
import { S3StorageDriver } from './drivers/s3'
import { GCSStorageDriver } from './drivers/gcs'

export class StorageService {
  private driver: StorageDriver
  private config: StorageConfig

  constructor(config: StorageConfig) {
    this.config = config
    
    // Initialize driver based on provider
    switch (config.provider) {
      case 's3':
        this.driver = new S3StorageDriver(config)
        break
      case 'gcs':
        this.driver = new GCSStorageDriver(config)
        break
      case 'local':
      default:
        this.driver = new LocalStorageDriver(config)
        break
    }
  }

  /**
   * Upload a file
   * @param buffer File buffer or stream
   * @param path Storage path
   * @param metadata File metadata
   * @returns Upload result with file path and metadata
   */
  async put(
    buffer: Buffer | NodeJS.ReadableStream,
    path: string,
    metadata?: FileMetadata
  ): Promise<UploadResult> {
    // Validate file size
    if (metadata?.size && metadata.size > this.config.maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.config.maxSize} bytes`)
    }

    // Validate MIME type
    if (metadata?.contentType && !this.isAllowedMimeType(metadata.contentType)) {
      throw new Error(`File type ${metadata.contentType} is not allowed`)
    }

    // Virus scan hook (stub - would integrate with ClamAV, VirusTotal, etc.)
    if (this.config.enableVirusScan) {
      await this.virusScan(buffer, metadata)
    }

    // Upload to storage
    const result = await this.driver.put(buffer, path, metadata)

    return result
  }

  /**
   * Retrieve a file
   * @param path Storage path
   * @returns File buffer
   */
  async get(path: string): Promise<Buffer> {
    return this.driver.get(path)
  }

  /**
   * Delete a file
   * @param path Storage path
   */
  async delete(path: string): Promise<void> {
    return this.driver.delete(path)
  }

  /**
   * Generate a signed URL for secure file access
   * @param path Storage path
   * @param expiresIn Expiration time in seconds (default: 1 hour)
   * @returns Signed URL
   */
  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    return this.driver.getSignedUrl(path, expiresIn)
  }

  /**
   * Check if file exists
   * @param path Storage path
   * @returns True if file exists
   */
  async exists(path: string): Promise<boolean> {
    return this.driver.exists(path)
  }

  /**
   * Get file metadata
   * @param path Storage path
   * @returns File metadata
   */
  async getMetadata(path: string): Promise<FileMetadata | null> {
    return this.driver.getMetadata(path)
  }

  /**
   * Check if MIME type is allowed
   */
  private isAllowedMimeType(mimeType: string): boolean {
    return this.config.allowedMimeTypes.some(
      (allowed) => allowed === mimeType || allowed.endsWith('/*') && mimeType.startsWith(allowed.slice(0, -1))
    )
  }

  /**
   * Virus scan hook (stub implementation)
   * In production, this would integrate with:
   * - ClamAV (local)
   * - VirusTotal API
   * - AWS Macie
   * - Google Cloud Security Scanner
   */
  private async virusScan(
    buffer: Buffer | NodeJS.ReadableStream,
    metadata?: FileMetadata
  ): Promise<void> {
    // Stub implementation
    // In production, this would:
    // 1. Convert stream to buffer if needed
    // 2. Send to virus scanning service
    // 3. Throw error if virus detected
    
    if (this.config.virusScanHook) {
      await this.config.virusScanHook(buffer, metadata)
    }
    
    // For now, just log that scan would happen
    console.log('[Storage] Virus scan would be performed here', {
      contentType: metadata?.contentType,
      size: metadata?.size,
    })
  }
}

/**
 * Create storage service instance from environment variables
 */
export function createStorageService(): StorageService {
  const provider = (process.env.FILE_STORAGE_PROVIDER || 'local') as 's3' | 'gcs' | 'local'
  
  const maxSize = parseInt(process.env.FILE_MAX_SIZE || '10485760', 10) // 10MB default
  const allowedMimeTypes = (process.env.FILE_ALLOWED_MIME_TYPES || 
    'image/jpeg,image/png,image/gif,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ).split(',')

  const config: StorageConfig = {
    provider,
    maxSize,
    allowedMimeTypes,
    enableVirusScan: process.env.FILE_ENABLE_VIRUS_SCAN === 'true',
    
    // S3 config
    s3: {
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET || '',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    
    // GCS config
    gcs: {
      projectId: process.env.GCS_PROJECT_ID || '',
      bucket: process.env.GCS_BUCKET || '',
      keyFilename: process.env.GCS_KEY_FILENAME || '',
    },
    
    // Local config
    local: {
      basePath: process.env.FILE_STORAGE_PATH || './uploads',
    },
  }

  return new StorageService(config)
}

// Export singleton instance
export const storage = createStorageService()




