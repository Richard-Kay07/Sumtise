"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"

export default function TaxSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Tax Settings</h1>
            <p className="text-gray-500">Configure VAT, corporation tax, and HMRC connections</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2">
            <Settings className="h-4 w-4" />Save Settings
          </Button>
        </div>

        <div className="grid gap-6">
          {[
            {
              title: "VAT Registration",
              fields: [
                { label: "VAT Registration Number", value: "GB 123 4567 89" },
                { label: "VAT Scheme", value: "Standard Rate" },
                { label: "VAT Period", value: "Quarterly" },
                { label: "Stagger", value: "Stagger 1 (Mar/Jun/Sep/Dec)" },
              ],
            },
            {
              title: "Corporation Tax",
              fields: [
                { label: "Company Registration Number", value: "12345678" },
                { label: "UTR (Unique Taxpayer Reference)", value: "1234567890" },
                { label: "Accounting Period End", value: "31 March" },
                { label: "Tax Agent Reference", value: "SA-AGENT-001" },
              ],
            },
            {
              title: "HMRC Credentials",
              fields: [
                { label: "Government Gateway User ID", value: "••••••••••" },
                { label: "MTD Connection", value: "Connected" },
              ],
            },
          ].map((section) => (
            <Card key={section.title}>
              <CardHeader><CardTitle>{section.title}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {section.fields.map((f) => (
                    <div key={f.label}>
                      <label className="text-sm text-gray-500 block mb-1">{f.label}</label>
                      <input defaultValue={f.value} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#50B0E0]" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
