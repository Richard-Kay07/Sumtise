/**
 * Hello Page - Sample page demonstrating authenticated access
 * 
 * This page demonstrates:
 * - Authenticated route access
 * - tRPC query usage
 * - Pagination display
 * - Error handling
 */

"use client"

import { trpc } from "@/lib/trpc-client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function HelloPage() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [filter, setFilter] = useState("")

  // Get organization ID from session (in real app, this would come from context)
  // For demo purposes, we'll use a placeholder
  const organizationId = "demo-org-id" // This should come from your auth context

  // Query hello items with pagination
  const { data, isLoading, error, refetch } = trpc.hello.getAll.useQuery({
    organizationId,
    page,
    limit,
    filter: filter || undefined,
  })

  // Create mutation
  const createMutation = trpc.hello.create.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  const handleCreate = () => {
    createMutation.mutate({
      organizationId,
      name: `Hello Item ${Date.now()}`,
      message: "This is a test message",
    })
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Hello Endpoint Demo</CardTitle>
          <CardDescription>
            This page demonstrates all DoD criteria: typed I/O, org guard, pagination, soft-delete, audit logging
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search/Filter */}
            <div className="flex gap-2">
              <Input
                placeholder="Filter items..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="max-w-sm"
              />
              <Button onClick={handleCreate} disabled={createMutation.isLoading}>
                {createMutation.isLoading ? "Creating..." : "Create Item"}
              </Button>
            </div>

            {/* Error State */}
            {error && (
              <div className="rounded-md bg-red-50 p-4 text-red-800">
                Error: {error.message}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-8">Loading...</div>
            )}

            {/* Data Table */}
            {data && (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Message</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.items.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                            No items found
                          </td>
                        </tr>
                      ) : (
                        data.items.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{item.name}</td>
                            <td className="px-4 py-3">{item.message || "-"}</td>
                            <td className="px-4 py-3">{new Date(item.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-600">
                      Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, data.pagination.total)} of {data.pagination.total} items
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
                        disabled={page === data.pagination.pages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

