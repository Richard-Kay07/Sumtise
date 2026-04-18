/**
 * File List Component
 * 
 * Displays list of file attachments with download/delete actions
 */

'use client'

import { useState } from 'react'
import { Download, Trash2, File } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FileAttachment } from './FileUpload'

interface FileListProps {
  files: FileAttachment[]
  onDelete?: (fileId: string) => void
  onDownload?: (file: FileAttachment) => void
  canDelete?: boolean
  canDownload?: boolean
}

export function FileList({
  files,
  onDelete,
  onDownload,
  canDelete = true,
  canDownload = true,
}: FileListProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDownload = async (file: FileAttachment) => {
    if (!canDownload) return

    setDownloading(file.fileId)
    try {
      // Get signed URL
      const response = await fetch(
        `/api/files/signed-url?fileId=${file.fileId}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to get download URL')
      }

      const data = await response.json()
      
      // Download file
      const downloadResponse = await fetch(data.url)
      const blob = await downloadResponse.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      onDownload?.(file)
    } catch (error) {
      console.error('Download failed:', error)
      alert('Failed to download file')
    } finally {
      setDownloading(null)
    }
  }

  const handleDelete = async (fileId: string) => {
    if (!canDelete || !onDelete) return

    if (!confirm('Are you sure you want to delete this file?')) {
      return
    }

    setDeleting(fileId)
    try {
      const response = await fetch(`/api/files?fileId=${fileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      onDelete(fileId)
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Failed to delete file')
    } finally {
      setDeleting(null)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  if (files.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No files attached
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.fileId}
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.fileName}</p>
              <p className="text-xs text-gray-500">
                {formatFileSize(file.fileSize)} • {file.contentType}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canDownload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(file)}
                disabled={downloading === file.fileId}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(file.fileId)}
                disabled={deleting === file.fileId}
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}




