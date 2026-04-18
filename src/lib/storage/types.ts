/**
 * Storage Types
 */

export type StorageProvider = 's3' | 'gcs' | 'local'

export interface StorageConfig {
  provider: StorageProvider
  maxSize: number
  allowedMimeTypes: string[]
  enableVirusScan?: boolean
  virusScanHook?: (buffer: Buffer | NodeJS.ReadableStream, metadata?: FileMetadata) => Promise<void>
  s3?: S3Config
  gcs?: GCSConfig
  local?: LocalConfig
}

export interface S3Config {
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

export interface GCSConfig {
  projectId: string
  bucket: string
  keyFilename: string
}

export interface LocalConfig {
  basePath: string
}

export interface FileMetadata {
  contentType?: string
  size?: number
  originalName?: string
  [key: string]: any
}

export interface UploadResult {
  path: string
  url?: string
  metadata?: FileMetadata
}

export interface StorageDriver {
  put(buffer: Buffer | NodeJS.ReadableStream, path: string, metadata?: FileMetadata): Promise<UploadResult>
  get(path: string): Promise<Buffer>
  delete(path: string): Promise<void>
  getSignedUrl(path: string, expiresIn: number): Promise<string>
  exists(path: string): Promise<boolean>
  getMetadata(path: string): Promise<FileMetadata | null>
}




