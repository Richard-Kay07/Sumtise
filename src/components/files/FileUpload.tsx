/**
 * File Upload Component
 * 
 * Handles file uploads with:
 * - Drag and drop
 * - File validation
 * - Progress tracking
 * - Preview
 */

'use client'

import { useState, useCallback } from 'react'
import { Upload, X, File, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export interface FileAttachment {
  fileId: string
  fileName: string
  fileSize: number
  contentType: string
  uploadedAt: Date
  uploaderId: string
}

interface FileUploadProps {
  organizationId: string
  userId: string
  category?: string
  onUploadComplete: (file: FileAttachment) => void
  onUploadError?: (error: Error) => void
  maxSize?: number // in bytes
  allowedTypes?: string[]
  multiple?: boolean
  disabled?: boolean
}

export function FileUpload({
  organizationId,
  userId,
  category = 'ATTACHMENTS',
  onUploadComplete,
  onUploadError,
  maxSize = 10 * 1024 * 1024, // 10MB default
  allowedTypes,
  multiple = false,
  disabled = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size exceeds maximum allowed size of ${(maxSize / 1024 / 1024).toFixed(2)}MB`
    }

    // Check file type
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed`
    }

    return null
  }, [maxSize, allowedTypes])

  const uploadFile = useCallback(async (file: File) => {
    setError(null)
    setUploading(true)
    setProgress(0)

    // Validate file
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      setUploading(false)
      onUploadError?.(new Error(validationError))
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organizationId', organizationId)
      formData.append('userId', userId)
      formData.append('category', category)

      // Simulate progress (in production, use XMLHttpRequest for real progress)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 100)

      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      
      // Convert to FileAttachment format
      const attachment: FileAttachment = {
        fileId: data.file.id,
        fileName: data.file.originalName,
        fileSize: data.file.fileSize,
        contentType: data.file.fileType,
        uploadedAt: new Date(data.file.uploadedAt),
        uploaderId: userId,
      }

      onUploadComplete(attachment)
      setProgress(0)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed')
      setError(error.message)
      onUploadError?.(error)
    } finally {
      setUploading(false)
    }
  }, [organizationId, userId, category, validateFile, onUploadComplete, onUploadError])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled || uploading) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      uploadFile(files[0]) // Upload first file
      if (multiple && files.length > 1) {
        // Queue remaining files
        files.slice(1).forEach((file) => {
          setTimeout(() => uploadFile(file), 100)
        })
      }
    }
  }, [disabled, uploading, multiple, uploadFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      uploadFile(files[0])
      if (multiple && files.length > 1) {
        Array.from(files).slice(1).forEach((file) => {
          setTimeout(() => uploadFile(file), 100)
        })
      }
    }
  }, [multiple, uploadFile])

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled && !uploading) {
            setIsDragging(true)
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'}
          ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}
        `}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || uploading}
          multiple={multiple}
          accept={allowedTypes?.join(',')}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-gray-600">Uploading...</p>
              {progress > 0 && (
                <Progress value={progress} className="w-full max-w-xs" />
              )}
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-gray-400" />
              <p className="text-sm text-gray-600">
                Drag and drop a file here, or click to select
              </p>
              <p className="text-xs text-gray-400">
                Max size: {(maxSize / 1024 / 1024).toFixed(2)}MB
              </p>
            </>
          )}
        </label>
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  )
}




