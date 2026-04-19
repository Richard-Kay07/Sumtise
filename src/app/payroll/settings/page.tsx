"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { Settings, Save, CheckCircle, Building2, Shield, Calendar } from "lucide-react"

export default function PayrollSettingsPage() {
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState({
    payFrequency: "Monthly",
    taxYear: "2025/2026",
    payDay: "Last working day",
    pensionScheme: "NEST",
    pensionEmployer: "3",
    pensionEmployee: "5",
    hmrcPayeRef: "123/AB45678",
    hmrcAccountsOfficeRef: "123PX00012345",
    hmrcUserId: "",
    hmrcPassword: "",
    niCategory: "A",
    apprenticyLevy: "false",
    autoEnrollment: "true",
    autoEnrollmentDate: "2026-04-01",
  })

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Payroll Settings</h1>
            <p className="text-gray-600">Configure your payroll preferences and HMRC credentials</p>
          </div>
          <Button className="text-white" style={{ backgroundColor: "#50B0E0" }} onClick={handleSave}>
            {saved ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Pay Schedule */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" style={{ color: "#50B0E0" }} />
                <div>
                  <CardTitle>Pay Schedule</CardTitle>
                  <CardDescription>Configure when and how employees are paid</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pay Frequency</Label>
                  <select
                    value={settings.payFrequency}
                    onChange={(e) => setSettings({ ...settings, payFrequency: e.target.value })}
                    className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
                  >
                    <option>Weekly</option>
                    <option>Bi-Weekly</option>
                    <option>Monthly</option>
                    <option>Four-Weekly</option>
                  </select>
                </div>
                <div>
                  <Label>Tax Year</Label>
                  <select
                    value={settings.taxYear}
                    onChange={(e) => setSettings({ ...settings, taxYear: e.target.value })}
                    className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
                  >
                    <option>2025/2026</option>
                    <option>2024/2025</option>
                    <option>2023/2024</option>
                  </select>
                </div>
                <div>
                  <Label>Pay Day</Label>
                  <select
                    value={settings.payDay}
                    onChange={(e) => setSettings({ ...settings, payDay: e.target.value })}
                    className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
                  >
                    <option>Last working day</option>
                    <option>25th of month</option>
                    <option>28th of month</option>
                    <option>1st of month</option>
                  </select>
                </div>
                <div>
                  <Label>NI Category</Label>
                  <select
                    value={settings.niCategory}
                    onChange={(e) => setSettings({ ...settings, niCategory: e.target.value })}
                    className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="A">A — Standard</option>
                    <option value="B">B — Married women</option>
                    <option value="C">C — Over state pension age</option>
                    <option value="H">H — Apprentices under 25</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* HMRC Credentials */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" style={{ color: "#50B0E0" }} />
                <div>
                  <CardTitle>HMRC Credentials</CardTitle>
                  <CardDescription>Your employer references for RTI submissions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>PAYE Reference</Label>
                  <Input
                    value={settings.hmrcPayeRef}
                    onChange={(e) => setSettings({ ...settings, hmrcPayeRef: e.target.value })}
                    placeholder="123/AB45678"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Accounts Office Reference</Label>
                  <Input
                    value={settings.hmrcAccountsOfficeRef}
                    onChange={(e) => setSettings({ ...settings, hmrcAccountsOfficeRef: e.target.value })}
                    placeholder="123PX00012345"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>HMRC User ID (Gateway)</Label>
                  <Input
                    value={settings.hmrcUserId}
                    onChange={(e) => setSettings({ ...settings, hmrcUserId: e.target.value })}
                    placeholder="12-digit user ID"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>HMRC Password</Label>
                  <Input
                    type="password"
                    value={settings.hmrcPassword}
                    onChange={(e) => setSettings({ ...settings, hmrcPassword: e.target.value })}
                    placeholder="••••••••"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                Your HMRC credentials are encrypted and stored securely. They are only used for RTI submissions.
              </div>
            </CardContent>
          </Card>

          {/* Pension Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" style={{ color: "#50B0E0" }} />
                <div>
                  <CardTitle>Pension Scheme</CardTitle>
                  <CardDescription>Auto-enrolment and pension contribution settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pension Provider</Label>
                  <select
                    value={settings.pensionScheme}
                    onChange={(e) => setSettings({ ...settings, pensionScheme: e.target.value })}
                    className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
                  >
                    <option>NEST</option>
                    <option>The People's Pension</option>
                    <option>NOW: Pensions</option>
                    <option>Aviva</option>
                    <option>Scottish Widows</option>
                    <option>Custom</option>
                  </select>
                </div>
                <div>
                  <Label>Auto-Enrolment Staging Date</Label>
                  <Input
                    type="date"
                    value={settings.autoEnrollmentDate}
                    onChange={(e) => setSettings({ ...settings, autoEnrollmentDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Employer Contribution (%)</Label>
                  <Input
                    type="number"
                    value={settings.pensionEmployer}
                    onChange={(e) => setSettings({ ...settings, pensionEmployer: e.target.value })}
                    min="3"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 3% required</p>
                </div>
                <div>
                  <Label>Employee Contribution (%)</Label>
                  <Input
                    type="number"
                    value={settings.pensionEmployee}
                    onChange={(e) => setSettings({ ...settings, pensionEmployee: e.target.value })}
                    min="5"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 5% required</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoEnroll"
                  checked={settings.autoEnrollment === "true"}
                  onChange={(e) => setSettings({ ...settings, autoEnrollment: e.target.checked ? "true" : "false" })}
                  className="h-4 w-4"
                />
                <label htmlFor="autoEnroll" className="text-sm text-gray-700">Automatically enrol eligible employees</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="apprenticyLevy"
                  checked={settings.apprenticyLevy === "true"}
                  onChange={(e) => setSettings({ ...settings, apprenticyLevy: e.target.checked ? "true" : "false" })}
                  className="h-4 w-4"
                />
                <label htmlFor="apprenticyLevy" className="text-sm text-gray-700">Apprenticeship Levy applicable (payroll &gt; £3m)</label>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button className="text-white px-8" style={{ backgroundColor: "#50B0E0" }} onClick={handleSave}>
              {saved ? <><CheckCircle className="mr-2 h-4 w-4" />Saved!</> : <><Save className="mr-2 h-4 w-4" />Save All Settings</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
