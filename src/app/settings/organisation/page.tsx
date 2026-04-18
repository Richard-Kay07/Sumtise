"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { Logo } from "@/components/logo"
import { Save, RefreshCw } from "lucide-react"
// Toast notifications - using simple alert for now

export default function OrganisationSettingsPage() {
  const [isSaving, setIsSaving] = useState(false)

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const organizationId = organizations?.[0]?.id

  const { data: organization, isLoading: orgLoading } = trpc.settings.getOrganization.useQuery(
    { organizationId: organizationId || "" },
    { enabled: !!organizationId }
  )

  const { data: settingsData, isLoading: settingsLoading } = trpc.settings.getOrganizationSettings.useQuery(
    { organizationId: organizationId || "", category: "GENERAL" },
    { enabled: !!organizationId }
  )

  const updateOrgMutation = trpc.settings.updateOrganization.useMutation()
  const updateSettingsMutation = trpc.settings.updateOrganizationSettings.useMutation()

  const [formData, setFormData] = useState({
    name: "",
    logo: "",
    website: "",
    email: "",
    phone: "",
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    timezone: "UTC",
    currency: "GBP",
    dateFormat: "DD/MM/YYYY",
    fiscalYearStart: "01/04",
  })

  useEffect(() => {
    if (organization) {
      setFormData((prev) => ({
        ...prev,
        name: organization.name || "",
        logo: organization.logo || "",
        website: organization.website || "",
        email: organization.email || "",
        phone: organization.phone || "",
      }))
    }
  }, [organization])

  useEffect(() => {
    if (settingsData?.settings?.[0]?.settings) {
      const generalSettings = settingsData.settings[0].settings
      setFormData((prev) => ({
        ...prev,
        companyName: generalSettings.companyName || "",
        companyAddress: generalSettings.companyAddress || "",
        companyPhone: generalSettings.companyPhone || "",
        companyEmail: generalSettings.companyEmail || "",
        timezone: generalSettings.timezone || "UTC",
        currency: generalSettings.currency || "GBP",
        dateFormat: generalSettings.dateFormat || "DD/MM/YYYY",
        fiscalYearStart: generalSettings.fiscalYearStart || "01/04",
      }))
    }
  }, [settingsData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) return

    setIsSaving(true)
    try {
      // Update organization
      await updateOrgMutation.mutateAsync({
        organizationId,
        name: formData.name,
        logo: formData.logo,
        website: formData.website,
        email: formData.email,
        phone: formData.phone,
      })

      // Update general settings
      await updateSettingsMutation.mutateAsync({
        organizationId,
        category: "GENERAL",
        settings: {
          companyName: formData.companyName,
          companyAddress: formData.companyAddress,
          companyPhone: formData.companyPhone,
          companyEmail: formData.companyEmail,
          timezone: formData.timezone,
          currency: formData.currency,
          dateFormat: formData.dateFormat,
          fiscalYearStart: formData.fiscalYearStart,
          logo: formData.logo,
        },
      })

      alert("Settings saved successfully!")
    } catch (error: any) {
      alert(`Error: ${error.message || "Failed to save settings"}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (orgLoading || settingsLoading) {
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
            <h1 className="text-2xl font-bold">Organization Settings</h1>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Organization Details */}
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>Basic information about your organization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="logo">Logo URL</Label>
                  <Input
                    id="logo"
                    type="url"
                    value={formData.logo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, logo: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Details used in invoices and reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="companyAddress">Company Address</Label>
                  <Input
                    id="companyAddress"
                    value={formData.companyAddress}
                    onChange={(e) => setFormData((prev) => ({ ...prev, companyAddress: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="companyPhone">Company Phone</Label>
                  <Input
                    id="companyPhone"
                    value={formData.companyPhone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, companyPhone: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="companyEmail">Company Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={formData.companyEmail}
                    onChange={(e) => setFormData((prev) => ({ ...prev, companyEmail: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Regional Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Regional Settings</CardTitle>
                <CardDescription>Currency, timezone, and date format preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="currency">Base Currency</Label>
                  <Input
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                    placeholder="GBP"
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, timezone: e.target.value }))}
                    placeholder="UTC"
                  />
                </div>
                <div>
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Input
                    id="dateFormat"
                    value={formData.dateFormat}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dateFormat: e.target.value }))}
                    placeholder="DD/MM/YYYY"
                  />
                </div>
                <div>
                  <Label htmlFor="fiscalYearStart">Fiscal Year Start</Label>
                  <Input
                    id="fiscalYearStart"
                    value={formData.fiscalYearStart}
                    onChange={(e) => setFormData((prev) => ({ ...prev, fiscalYearStart: e.target.value }))}
                    placeholder="01/04"
                    pattern="\d{2}/\d{2}"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Format: MM/DD (e.g., 01/04 for April 1st)
                  </p>
                </div>
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

