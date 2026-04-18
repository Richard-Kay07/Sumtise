"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { Logo } from "@/components/logo"
import { Save, RefreshCw, Link as LinkIcon, CheckCircle2, XCircle } from "lucide-react"
// Toast notifications - using simple alert for now

export default function IntegrationsPage() {
  const [isSaving, setIsSaving] = useState(false)

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const organizationId = organizations?.[0]?.id

  const { data: settingsData, isLoading } = trpc.settings.getOrganizationSettings.useQuery(
    { organizationId: organizationId || "", category: "INTEGRATIONS" },
    { enabled: !!organizationId }
  )

  const updateSettingsMutation = trpc.settings.updateOrganizationSettings.useMutation()

  const [formData, setFormData] = useState({
    stripeEnabled: false,
    stripeApiKey: "",
    sendgridEnabled: false,
    sendgridApiKey: "",
    xeroEnabled: false,
    xeroApiKey: "",
  })

  useEffect(() => {
    if (settingsData?.settings?.[0]?.settings) {
      const integrationSettings = settingsData.settings[0].settings
      setFormData({
        stripeEnabled: integrationSettings.stripeEnabled ?? false,
        stripeApiKey: integrationSettings.stripeApiKey || "",
        sendgridEnabled: integrationSettings.sendgridEnabled ?? false,
        sendgridApiKey: integrationSettings.sendgridApiKey || "",
        xeroEnabled: integrationSettings.xeroEnabled ?? false,
        xeroApiKey: integrationSettings.xeroApiKey || "",
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
        category: "INTEGRATIONS",
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
              <p className="mt-4 text-muted-foreground">Loading integrations...</p>
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
            <h1 className="text-2xl font-bold">Integrations</h1>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Stripe */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <LinkIcon className="h-5 w-5" />
                  <span>Stripe</span>
                  {formData.stripeEnabled ? (
                    <Badge variant="default" className="ml-2">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2">
                      <XCircle className="h-3 w-3 mr-1" />
                      Disabled
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Accept payments online with Stripe
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="stripeEnabled">
                    <input
                      type="checkbox"
                      id="stripeEnabled"
                      checked={formData.stripeEnabled}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          stripeEnabled: e.target.checked,
                        }))
                      }
                      className="mr-2"
                    />
                    Enable Stripe Integration
                  </Label>
                </div>
                {formData.stripeEnabled && (
                  <div>
                    <Label htmlFor="stripeApiKey">Stripe API Key</Label>
                    <Input
                      id="stripeApiKey"
                      type="password"
                      value={formData.stripeApiKey}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          stripeApiKey: e.target.value,
                        }))
                      }
                      placeholder="sk_live_..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SendGrid */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <LinkIcon className="h-5 w-5" />
                  <span>SendGrid</span>
                  {formData.sendgridEnabled ? (
                    <Badge variant="default" className="ml-2">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2">
                      <XCircle className="h-3 w-3 mr-1" />
                      Disabled
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Send transactional emails via SendGrid
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="sendgridEnabled">
                    <input
                      type="checkbox"
                      id="sendgridEnabled"
                      checked={formData.sendgridEnabled}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sendgridEnabled: e.target.checked,
                        }))
                      }
                      className="mr-2"
                    />
                    Enable SendGrid Integration
                  </Label>
                </div>
                {formData.sendgridEnabled && (
                  <div>
                    <Label htmlFor="sendgridApiKey">SendGrid API Key</Label>
                    <Input
                      id="sendgridApiKey"
                      type="password"
                      value={formData.sendgridApiKey}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sendgridApiKey: e.target.value,
                        }))
                      }
                      placeholder="SG.xxx..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Xero */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <LinkIcon className="h-5 w-5" />
                  <span>Xero</span>
                  {formData.xeroEnabled ? (
                    <Badge variant="default" className="ml-2">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2">
                      <XCircle className="h-3 w-3 mr-1" />
                      Disabled
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Sync data with Xero accounting software
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="xeroEnabled">
                    <input
                      type="checkbox"
                      id="xeroEnabled"
                      checked={formData.xeroEnabled}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          xeroEnabled: e.target.checked,
                        }))
                      }
                      className="mr-2"
                    />
                    Enable Xero Integration
                  </Label>
                </div>
                {formData.xeroEnabled && (
                  <div>
                    <Label htmlFor="xeroApiKey">Xero API Key</Label>
                    <Input
                      id="xeroApiKey"
                      type="password"
                      value={formData.xeroApiKey}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          xeroApiKey: e.target.value,
                        }))
                      }
                      placeholder="Xero API Key"
                    />
                  </div>
                )}
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

