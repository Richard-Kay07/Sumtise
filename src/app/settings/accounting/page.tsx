"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { Logo } from "@/components/logo"
import { Save, RefreshCw, Lock, Calendar } from "lucide-react"
// Toast notifications - using simple alert for now
import Link from "next/link"

export default function AccountingSettingsPage() {
  const [isSaving, setIsSaving] = useState(false)

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const organizationId = organizations?.[0]?.id

  const { data: settingsData, isLoading } = trpc.settings.getOrganizationSettings.useQuery(
    { organizationId: organizationId || "", category: "ACCOUNTING" },
    { enabled: !!organizationId }
  )

  const updateSettingsMutation = trpc.settings.updateOrganizationSettings.useMutation()

  const [formData, setFormData] = useState({
    chartOfAccountsTemplate: "uk",
    autoNumbering: true,
    invoiceNumberPrefix: "INV",
    invoiceNumberStart: 1,
    billNumberPrefix: "BILL",
    billNumberStart: 1,
    enableDoubleEntry: true,
    requireApproval: false,
    approvalThreshold: 1000,
    enableAuditTrail: true,
    lockDate: "",
    lockPeriodEnd: "",
  })

  useEffect(() => {
    if (settingsData?.settings?.[0]?.settings) {
      const accountingSettings = settingsData.settings[0].settings
      setFormData({
        chartOfAccountsTemplate: accountingSettings.chartOfAccountsTemplate || "uk",
        autoNumbering: accountingSettings.autoNumbering ?? true,
        invoiceNumberPrefix: accountingSettings.invoiceNumberPrefix || "INV",
        invoiceNumberStart: accountingSettings.invoiceNumberStart || 1,
        billNumberPrefix: accountingSettings.billNumberPrefix || "BILL",
        billNumberStart: accountingSettings.billNumberStart || 1,
        enableDoubleEntry: accountingSettings.enableDoubleEntry ?? true,
        requireApproval: accountingSettings.requireApproval ?? false,
        approvalThreshold: accountingSettings.approvalThreshold || 1000,
        enableAuditTrail: accountingSettings.enableAuditTrail ?? true,
        lockDate: accountingSettings.lockDate || "",
        lockPeriodEnd: accountingSettings.lockPeriodEnd || "",
      })
    }
  }, [settingsData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) return

    setIsSaving(true)
    try {
      await updateSettingsMutation.mutateAsync({
        organizationId,
        category: "ACCOUNTING",
        settings: formData,
      })

      alert("Settings saved successfully!")
    } catch (error: any) {
      alert(`Error: ${error.message || "Failed to save settings"}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Loading settings...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="flex items-center space-x-4">
            <a className="flex items-center space-x-2" href="/">
              <Logo size={32} showText={true} />
            </a>
            <h1 className="text-2xl font-bold">Accounting Settings</h1>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Chart of Accounts */}
            <Card>
              <CardHeader>
                <CardTitle>Chart of Accounts</CardTitle>
                <CardDescription>Manage your chart of accounts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="chartOfAccountsTemplate">Template</Label>
                  <select
                    id="chartOfAccountsTemplate"
                    value={formData.chartOfAccountsTemplate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        chartOfAccountsTemplate: e.target.value,
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="uk">UK</option>
                    <option value="south_africa">South Africa</option>
                    <option value="kenya">Kenya</option>
                    <option value="zambia">Zambia</option>
                  </select>
                </div>
                <div>
                  <Link href="/settings/accounting/chart-of-accounts">
                    <Button variant="outline" type="button">
                      Manage Chart of Accounts
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Number Sequences */}
            <Card>
              <CardHeader>
                <CardTitle>Number Sequences</CardTitle>
                <CardDescription>Configure automatic numbering for documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="autoNumbering">
                      <input
                        type="checkbox"
                        id="autoNumbering"
                        checked={formData.autoNumbering}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            autoNumbering: e.target.checked,
                          }))
                        }
                        className="mr-2"
                      />
                      Enable Auto Numbering
                    </Label>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="invoiceNumberPrefix">Invoice Number Prefix</Label>
                    <Input
                      id="invoiceNumberPrefix"
                      value={formData.invoiceNumberPrefix}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          invoiceNumberPrefix: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="invoiceNumberStart">Invoice Number Start</Label>
                    <Input
                      id="invoiceNumberStart"
                      type="number"
                      value={formData.invoiceNumberStart}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          invoiceNumberStart: parseInt(e.target.value) || 1,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="billNumberPrefix">Bill Number Prefix</Label>
                    <Input
                      id="billNumberPrefix"
                      value={formData.billNumberPrefix}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          billNumberPrefix: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="billNumberStart">Bill Number Start</Label>
                    <Input
                      id="billNumberStart"
                      type="number"
                      value={formData.billNumberStart}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          billNumberStart: parseInt(e.target.value) || 1,
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Accounting Options */}
            <Card>
              <CardHeader>
                <CardTitle>Accounting Options</CardTitle>
                <CardDescription>Configure accounting behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="enableDoubleEntry">
                    <input
                      type="checkbox"
                      id="enableDoubleEntry"
                      checked={formData.enableDoubleEntry}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          enableDoubleEntry: e.target.checked,
                        }))
                      }
                      className="mr-2"
                    />
                    Enable Double-Entry Bookkeeping
                  </Label>
                </div>
                <div>
                  <Label htmlFor="requireApproval">
                    <input
                      type="checkbox"
                      id="requireApproval"
                      checked={formData.requireApproval}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          requireApproval: e.target.checked,
                        }))
                      }
                      className="mr-2"
                    />
                    Require Approval for Transactions
                  </Label>
                </div>
                {formData.requireApproval && (
                  <div>
                    <Label htmlFor="approvalThreshold">Approval Threshold</Label>
                    <Input
                      id="approvalThreshold"
                      type="number"
                      value={formData.approvalThreshold}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          approvalThreshold: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Transactions above this amount require approval
                    </p>
                  </div>
                )}
                <div>
                  <Label htmlFor="enableAuditTrail">
                    <input
                      type="checkbox"
                      id="enableAuditTrail"
                      checked={formData.enableAuditTrail}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          enableAuditTrail: e.target.checked,
                        }))
                      }
                      className="mr-2"
                    />
                    Enable Audit Trail
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Period Lock */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lock className="h-5 w-5" />
                  <span>Period Lock</span>
                </CardTitle>
                <CardDescription>
                  Lock periods to prevent back-posting of transactions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="lockDate">Lock Date</Label>
                  <Input
                    id="lockDate"
                    type="date"
                    value={formData.lockDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        lockDate: e.target.value,
                      }))
                    }
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Transactions before this date cannot be created or modified
                  </p>
                </div>
                <div>
                  <Label htmlFor="lockPeriodEnd">Lock Period End</Label>
                  <Input
                    id="lockPeriodEnd"
                    type="date"
                    value={formData.lockPeriodEnd}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        lockPeriodEnd: e.target.value,
                      }))
                    }
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    End date for the locked period
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Analysis Codes */}
            <Card>
              <CardHeader>
                <CardTitle>Analysis Codes</CardTitle>
                <CardDescription>Manage tracking dimensions and analysis codes</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/settings/accounting/analysis-codes">
                  <Button variant="outline" type="button">
                    Manage Analysis Codes
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}

