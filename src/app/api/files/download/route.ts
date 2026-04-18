import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"
import { handleError, logRequest, addSecurityHeaders } from "@/lib/error-handler"
import { verifyResourceOwnership } from "@/lib/guards/organization"

/**
 * Download file
 * GET /api/files/download
 */
export async function GET(request: NextRequest) {
  try {
    logRequest(request)
    
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get("fileId")
    const path = searchParams.get("path")
    const organizationId = searchParams.get("organizationId")

    // Get file record
    let fileRecord
    if (fileId) {
      fileRecord = await prisma.fileUpload.findFirst({
        where: {
          id: fileId,
          deletedAt: null, // Exclude soft-deleted files
        },
      })
    } else if (path && organizationId) {
      fileRecord = await prisma.fileUpload.findFirst({
        where: {
          filePath: path,
          organizationId,
          deletedAt: null,
        },
      })
    } else {
      return NextResponse.json(
        { error: "File ID or path with organization ID required" },
        { status: 400 }
      )
    }

    if (!fileRecord) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }

    // Verify organization access
    await verifyResourceOwnership("organization", fileRecord.organizationId, fileRecord.organizationId)

    // Get file from storage
    const fileBuffer = await storage.get(fileRecord.filePath)

    // Return file with appropriate headers
    const response = new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": fileRecord.fileType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileRecord.originalName)}"`,
        "Content-Length": fileRecord.fileSize.toString(),
      },
    })

    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}




