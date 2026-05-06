"use client"

import { useState, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  Upload, 
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
  Eye,
  Download,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type FileType = 'CSV' | 'OFX'

interface ColumnMapping {
  date?: string
  amount?: string
  description?: string
  payee?: string
  memo?: string
  reference?: string
  balance?: string
}

export default function BankImportPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<FileType>('CSV')
  const [fileContent, setFileContent] = useState<string>("")
  const [columns, setColumns] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [parseOptions, setParseOptions] = useState({
    dateFormat: 'auto',
    amountLocale: 'en-US',
    delimiter: ',',
    hasHeader: true,
    negativeAmountIndicator: '-',
  })
  const [previewData, setPreviewData] = useState<any>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)

  // Pre-select account from query param (set by /banking page)
  useEffect(() => {
    const id = searchParams.get("accountId")
    if (id) setSelectedAccountId(id)
  }, [searchParams])
  const [resultDialogOpen, setResultDialogOpen] = useState(false)

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = organizations?.[0]?.id || ""

  // Get bank accounts
  const { data: bankAccounts } = trpc.bankAccounts.getAll.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  // Preview mutation
  const previewMutation = trpc.bankAccounts.previewStatement.useMutation({
    onSuccess: (data) => {
      setPreviewData(data)
      setPreviewDialogOpen(true)
    },
    onError: (error) => {
      toast({
        title: "Preview failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Import mutation
  const importMutation = trpc.bankAccounts.importStatement.useMutation({
    onSuccess: (data) => {
      setImportResult(data)
      setResultDialogOpen(true)
      toast({
        title: "Import completed",
        description: `Imported ${data.importedRows} transactions`,
      })
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Detect file type
    const extension = file.name.split('.').pop()?.toUpperCase()
    if (extension === 'CSV' || extension === 'TXT') {
      setFileType('CSV')
    } else if (extension === 'OFX') {
      setFileType('OFX')
    } else {
      toast({
        title: "Unsupported file type",
        description: "Please select a CSV or OFX file",
        variant: "destructive",
      })
      return
    }

    setSelectedFile(file)

    // Read file content
    const reader = new FileReader()
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ""
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)
      setFileContent(base64)
      // Also read as text for column detection
      const content = new TextDecoder().decode(bytes)

      // For CSV, detect columns
      if (fileType === 'CSV' || extension === 'CSV' || extension === 'TXT') {
        const lines = content.split('\n')
        if (lines.length > 0) {
          const headerLine = lines[0]
          const detectedColumns = headerLine.split(',').map((col) => col.trim().replace(/"/g, ''))
          setColumns(detectedColumns)
          
          // Auto-map common column names
          const autoMapping: ColumnMapping = {}
          detectedColumns.forEach((col) => {
            const lower = col.toLowerCase()
            if (lower.includes('date')) autoMapping.date = col
            if (lower.includes('amount') || lower.includes('value')) autoMapping.amount = col
            if (lower.includes('description') || lower.includes('memo') || lower.includes('details')) autoMapping.description = col
            if (lower.includes('payee') || lower.includes('pay to')) autoMapping.payee = col
            if (lower.includes('reference') || lower.includes('ref')) autoMapping.reference = col
            if (lower.includes('balance')) autoMapping.balance = col
          })
          setMapping(autoMapping)
        }
      }
    }
    reader.readAsArrayBuffer(file)
  }, [fileType, toast])

  const handlePreview = () => {
    if (!fileContent || !selectedAccountId) {
      toast({
        title: "Missing information",
        description: "Please select a file and bank account",
        variant: "destructive",
      })
      return
    }

    if (fileType === 'CSV' && (!mapping.date || !mapping.amount || !mapping.description)) {
      toast({
        title: "Missing mapping",
        description: "Please map date, amount, and description columns",
        variant: "destructive",
      })
      return
    }

    previewMutation.mutate({
      organizationId: orgId,
      fileContent,
      fileType,
      mapping: fileType === 'CSV' ? mapping : undefined,
      parseOptions: fileType === 'CSV' ? parseOptions : undefined,
    })
  }

  const handleImport = () => {
    if (!fileContent || !selectedAccountId) {
      toast({
        title: "Missing information",
        description: "Please select a file and bank account",
        variant: "destructive",
      })
      return
    }

    if (fileType === 'CSV' && (!mapping.date || !mapping.amount || !mapping.description)) {
      toast({
        title: "Missing mapping",
        description: "Please map date, amount, and description columns",
        variant: "destructive",
      })
      return
    }

    importMutation.mutate({
      organizationId: orgId,
      bankAccountId: selectedAccountId,
      fileContent,
      fileName: selectedFile?.name || 'statement',
      fileType,
      mapping: fileType === 'CSV' ? mapping : undefined,
      parseOptions: fileType === 'CSV' ? parseOptions : undefined,
      skipDuplicates: true,
    })
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Import Bank Statement</h1>
          <p className="text-muted-foreground mt-1">
            Upload and import bank statements in CSV or OFX format
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Statement</CardTitle>
              <CardDescription>Select a CSV or OFX file to import</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Bank Account</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts?.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>File</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium mb-2">
                    {selectedFile ? selectedFile.name : "Choose file to upload"}
                  </p>
                  <input
                    type="file"
                    accept=".csv,.txt,.ofx"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {selectedFile ? "Change File" : "Select File"}
                  </Button>
                </div>
              </div>

              {selectedFile && (
                <div className="text-sm text-muted-foreground">
                  <div>File: {selectedFile.name}</div>
                  <div>Type: {fileType}</div>
                  <div>Size: {(selectedFile.size / 1024).toFixed(2)} KB</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mapping Section (CSV only) */}
          {fileType === 'CSV' && columns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Column Mapping</CardTitle>
                <CardDescription>Map CSV columns to transaction fields</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Date Column *</Label>
                  <Select
                    value={mapping.date || ""}
                    onValueChange={(value) => setMapping({ ...mapping, date: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select date column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Amount Column *</Label>
                  <Select
                    value={mapping.amount || ""}
                    onValueChange={(value) => setMapping({ ...mapping, amount: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select amount column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Description Column *</Label>
                  <Select
                    value={mapping.description || ""}
                    onValueChange={(value) => setMapping({ ...mapping, description: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select description column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Payee Column (optional)</Label>
                  <Select
                    value={mapping.payee || ""}
                    onValueChange={(value) => setMapping({ ...mapping, payee: value || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payee column (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Reference Column (optional)</Label>
                  <Select
                    value={mapping.reference || ""}
                    onValueChange={(value) => setMapping({ ...mapping, reference: value || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reference column (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Parse Options */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-semibold">Parse Options</Label>
                  <div className="space-y-2 mt-2">
                    <div>
                      <Label className="text-xs">Date Format</Label>
                      <Select
                        value={parseOptions.dateFormat}
                        onValueChange={(value) => setParseOptions({ ...parseOptions, dateFormat: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto-detect</SelectItem>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Amount Locale</Label>
                      <Select
                        value={parseOptions.amountLocale}
                        onValueChange={(value) => setParseOptions({ ...parseOptions, amountLocale: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-US">US (1,234.56)</SelectItem>
                          <SelectItem value="en-GB">UK (1,234.56)</SelectItem>
                          <SelectItem value="de-DE">German (1.234,56)</SelectItem>
                          <SelectItem value="fr-FR">French (1 234,56)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="lg:col-span-2 flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={!fileContent || !selectedAccountId || previewMutation.isPending}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button
              onClick={handleImport}
              disabled={!fileContent || !selectedAccountId || importMutation.isPending}
            >
              {importMutation.isPending ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Import</DialogTitle>
            <DialogDescription>
              Review parsed transactions before importing
            </DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Badge>{previewData.metadata?.parsedRows || 0} transactions</Badge>
                  {previewData.errors?.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {previewData.errors.length} errors
                    </Badge>
                  )}
                </div>
              </div>

              {previewData.transactions && previewData.transactions.length > 0 && (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.transactions.slice(0, 50).map((tx: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{formatDate(tx.date)}</TableCell>
                          <TableCell>{tx.description}</TableCell>
                          <TableCell className={`text-right ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(Math.abs(tx.amount))}
                          </TableCell>
                          <TableCell>{tx.reference || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {previewData.errors && previewData.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <h4 className="font-semibold text-red-900 mb-2">Errors:</h4>
                  <div className="space-y-1 text-sm">
                    {previewData.errors.slice(0, 10).map((error: any, index: number) => (
                      <div key={index} className="text-red-700">
                        Row {error.row}: {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setPreviewDialogOpen(false)
              handleImport()
            }}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Results Dialog */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
            <DialogDescription>
              Import completed with the following results
            </DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge className={importResult.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : ''}>
                    {importResult.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Rows</div>
                  <div className="font-semibold">{importResult.totalRows}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Imported</div>
                  <div className="font-semibold text-green-600">{importResult.importedRows}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Duplicates</div>
                  <div className="font-semibold text-yellow-600">{importResult.duplicateRows}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Errors</div>
                  <div className="font-semibold text-red-600">{importResult.errorRows}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Skipped</div>
                  <div className="font-semibold">{importResult.skippedRows}</div>
                </div>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50 max-h-40 overflow-y-auto">
                  <h4 className="font-semibold text-red-900 mb-2">Errors:</h4>
                  <div className="space-y-1 text-sm">
                    {importResult.errors.slice(0, 10).map((error: any, index: number) => (
                      <div key={index} className="text-red-700">
                        Row {error.row}: {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => {
              setResultDialogOpen(false)
              window.location.href = '/banking/reconciliation'
            }}>
              View Transactions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}




