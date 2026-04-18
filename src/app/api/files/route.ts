import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { handleError, createRateLimiter, logRequest, addSecurityHeaders } from "@/lib/error-handler"
import { storage } from "@/lib/storage"
import { verifyResourceOwnership } from "@/lib/guards/organization"

const rateLimiter = createRateLimiter(50, 60 * 1000) // 50 uploads per minute

/**
 * Upload file
 * POST /api/files
 */
export async function POST(request: NextRequest) {
  try {
    if (!rateLimiter(request)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      )
    }

    logRequest(request)
    
    const formData = await request.formData()
    const file = formData.get("file") as File
    const organizationId = formData.get("organizationId") as string
    const userId = formData.get("userId") as string
    const category = formData.get("category") as string
    const metadata = formData.get("metadata") as string

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    if (!organizationId || !userId) {
      return NextResponse.json(
        { error: "Organization ID and User ID required" },
        { status: 400 }
      )
    }

    // Verify organization access
    await verifyResourceOwnership("organization", organizationId, organizationId)

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate storage path
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${timestamp}_${randomString}.${fileExtension}`
    const storagePath = `${organizationId}/${category || 'attachments'}/${fileName}`

    // Upload to storage
    const uploadResult = await storage.put(buffer, storagePath, {
      contentType: file.type,
      size: file.size,
      originalName: file.name,
    })

    // Create database record
    const fileRecord = await prisma.fileUpload.create({
      data: {
        organizationId,
        userId,
        originalName: file.name,
        fileName,
        filePath: uploadResult.path,
        fileType: file.type,
        fileSize: file.size,
        category: (category as any) || 'ATTACHMENTS',
        metadata: metadata ? metadata : null,
        uploadedAt: new Date(),
      },
    })

    const response = NextResponse.json({
      success: true,
      file: {
        id: fileRecord.id,
        fileName: fileRecord.fileName,
        originalName: fileRecord.originalName,
        fileType: fileRecord.fileType,
        fileSize: fileRecord.fileSize,
        category: fileRecord.category,
        filePath: fileRecord.filePath,
        uploadedAt: fileRecord.uploadedAt,
      },
    })
    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * List files
 * GET /api/files
 */
export async function GET(request: NextRequest) {
  try {
    logRequest(request)
    
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get("organizationId")
    const category = searchParams.get("category")
    const userId = searchParams.get("userId")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      )
    }

    const where: any = { 
      organizationId,
      deletedAt: null, // Exclude soft-deleted files
    }
    if (category) where.category = category
    if (userId) where.userId = userId

    const [files, totalCount] = await Promise.all([
      prisma.fileUpload.findMany({
        where,
        orderBy: { uploadedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.fileUpload.count({ where }),
    ])

    const response = NextResponse.json({
      files,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    })
    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Delete file (soft delete)
 * DELETE /api/files
 */
export async function DELETE(request: NextRequest) {
  try {
    logRequest(request)
    
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get("fileId")
    const organizationId = searchParams.get("organizationId")

    if (!fileId || !organizationId) {
      return NextResponse.json(
        { error: "File ID and Organization ID required" },
        { status: 400 }
      )
    }

    // Get file record
    const fileRecord = await prisma.fileUpload.findFirst({
      where: {
        id: fileId,
        organizationId,
        deletedAt: null,
      },
    })

    if (!fileRecord) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }

    // Soft delete database record (keep blob for now)
    await prisma.fileUpload.update({
      where: { id: fileId },
      data: {
        deletedAt: new Date(),
      },
    })

    // Note: Physical file deletion can be done via cleanup job
    // For now, we soft-delete the record but keep the blob

    const response = NextResponse.json({
      success: true,
      message: "File deleted successfully",
    })
    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}
