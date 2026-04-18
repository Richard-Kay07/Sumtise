/**
 * Local Filesystem Storage Driver
 */

import { StorageDriver, StorageConfig, UploadResult, FileMetadata } from '../types'
import { writeFile, readFile, unlink, mkdir, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { Readable } from 'stream'

export class LocalStorageDriver implements StorageDriver {
  private config: StorageConfig

  constructor(config: StorageConfig) {
    this.config = config
  }

  async put(
    buffer: Buffer | NodeJS.ReadableStream,
    path: string,
    metadata?: FileMetadata
  ): Promise<UploadResult> {
    const fullPath = this.getFullPath(path)
    const dir = dirname(fullPath)

    // Ensure directory exists
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    // Convert stream to buffer if needed
    let fileBuffer: Buffer
    if (buffer instanceof Buffer) {
      fileBuffer = buffer
    } else {
      fileBuffer = await this.streamToBuffer(buffer)
    }

    // Write file
    await writeFile(fullPath, fileBuffer)

    return {
      path,
      url: `/api/files/download?path=${encodeURIComponent(path)}`,
      metadata,
    }
  }

  async get(path: string): Promise<Buffer> {
    const fullPath = this.getFullPath(path)
    return readFile(fullPath)
  }

  async delete(path: string): Promise<void> {
    const fullPath = this.getFullPath(path)
    try {
      await unlink(fullPath)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
  }

  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    // For local storage, return a direct download URL
    // In production, you might want to generate a temporary token
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return `${baseUrl}/api/files/download?path=${encodeURIComponent(path)}&expires=${Date.now() + expiresIn * 1000}`
  }

  async exists(path: string): Promise<boolean> {
    const fullPath = this.getFullPath(path)
    try {
      await stat(fullPath)
      return true
    } catch {
      return false
    }
  }

  async getMetadata(path: string): Promise<FileMetadata | null> {
    const fullPath = this.getFullPath(path)
    try {
      const stats = await stat(fullPath)
      return {
        size: stats.size,
      }
    } catch {
      return null
    }
  }

  private getFullPath(path: string): string {
    const basePath = this.config.local?.basePath || './uploads'
    return join(process.cwd(), basePath, path)
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = []
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks)))
    })
  }
}




