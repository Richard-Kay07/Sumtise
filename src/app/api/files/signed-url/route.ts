import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"
import { handleError, logRequest, addSecurityHeaders } from "@/lib/error-handler"
import { verifyResourceOwnership } from "@/lib/guards/organization"

/**
 * Get signed URL for file access
 * GET /api/files/signed-url
 */
export async function GET(request: NextRequest) {
  try {
    logRequest(request)
    
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get("fileId")
    const expiresIn = parseInt(searchParams.get("expiresIn") || "3600", 10) // Default 1 hour

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID required" },
        { status: 400 }
      )
    }

    // Get file record
    const fileRecord = await prisma.fileUpload.findFirst({
      where: {
        id: fileId,
        deletedAt: null, // Exclude soft-deleted files
      },
    })

    if (!fileRecord) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }

    // Verify organization access
    await verifyResourceOwnership("organization", fileRecord.organizationId, fileRecord.organizationId)

    // Generate signed URL
    const signedUrl = await storage.getSignedUrl(fileRecord.filePath, expiresIn)

    const response = NextResponse.json({
      success: true,
      url: signedUrl,
      expiresIn,
      file: {
        id: fileRecord.id,
        originalName: fileRecord.originalName,
        fileType: fileRecord.fileType,
        fileSize: fileRecord.fileSize,
      },
    })

    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}




