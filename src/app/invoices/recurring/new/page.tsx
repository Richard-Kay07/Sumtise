"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RefreshCw, ChevronLeft, ChevronRight, Plus, Trash2, Check } from "lucide-react"

const BRAND = "#50B0E0"

const FREQUENCIES = [
  { value: "WEEKLY",      label: "Weekly" },
  { value: "FORTNIGHTLY", label: "Fortnightly" },
  { value: "MONTHLY",     label: "Monthly" },
  { value: "QUARTERLY",   label: "Quarterly" },
  { value: "ANNUALLY",    label: "Annually" },
]

const CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD", "ZAR"]

interface Item {
  description: string
  quantity:    string
  unitPrice:   string
  taxRate:     string
}

const emptyItem = (): Item => ({ description: "", quantity: "1", unitPrice: "0.00", taxRate: "0" })

// ── Step indicators ────────────────────────────────────────────────────────────

function StepBar({ step }: { step: number }) {
  const steps = ["Details", "Line Items", "Review"]
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const idx   = i + 1
        const done  = step > idx
        const active = step === idx
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${done   ? "text-white" : active ? "text-white" : "bg-gray-100 text-gray-400"}`}
                style={done || active ? { backgroundColor: BRAND } : {}}>
                {done ? <Check className="h-3.5 w-3.5" /> : idx}
              </div>
              <span className={`text-xs mt-1 ${active ? "font-semibold" : "text-gray-400"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-16 mx-1 mb-4 ${step > idx ? "" : "bg-gray-200"}`}
                style={step > idx ? { backgroundColor: BRAND } : {}} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1 ─────────────────────────────────────────────────────────────────────

function StepDetails({ form, setForm, customers }: {
  form: any; setForm: (f: any) => void
  customers: { id: string; name: string }[]
}) {
  const set = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }))
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Template name <span className="text-red-500">*</span></Label>
          <Input className="mt-1" placeholder="e.g. Monthly retainer – Acme Ltd"
            value={form.templateName} onChange={e => set("templateName", e.target.value)} />
        </div>

        <div>
          <Label>Customer <span className="text-red-500">*</span></Label>
          <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.customerId} onChange={e => set("customerId", e.target.value)}>
            <option value="">— select customer —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <Label>Currency</Label>
          <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.currency} onChange={e => set("currency", e.target.value)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <Label>Frequency <span className="text-red-500">*</span></Label>
          <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.frequency} onChange={e => set("frequency", e.target.value)}>
            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        <div>
          <Label>Day of month (optional)</Label>
          <Input className="mt-1" type="number" min={1} max={31} placeholder="e.g. 1"
            value={form.dayOfMonth} onChange={e => set("dayOfMonth", e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">Leave blank to use start date's day</p>
        </div>

        <div>
          <Label>Start date <span className="text-red-500">*</span></Label>
          <Input className="mt-1" type="date"
            value={form.startDate} onChange={e => set("startDate", e.target.value)} />
        </div>

        <div>
          <Label>End date (optional)</Label>
          <Input className="mt-1" type="date"
            value={form.endDate} onChange={e => set("endDate", e.target.value)} />
        </div>

        <div>
          <Label>Payment terms (days) <span className="text-red-500">*</span></Label>
          <Input className="mt-1" type="number" min={0}
            value={form.paymentTerms} onChange={e => set("paymentTerms", e.target.value)} />
        </div>

        <div>
          <Label>Max runs (optional)</Label>
          <Input className="mt-1" type="number" min={1} placeholder="Unlimited"
            value={form.maxRuns} onChange={e => set("maxRuns", e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <Label>Notes (optional)</Label>
          <textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
            value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>

        <div className="sm:col-span-2 flex items-center gap-2">
          <input type="checkbox" id="autoSend" checked={form.autoSend}
            onChange={e => set("autoSend", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300" />
          <Label htmlFor="autoSend" className="cursor-pointer font-normal">
            Auto-send invoices when generated
          </Label>
        </div>
      </div>
    </div>
  )
}

// ── Step 2 ─────────────────────────────────────────────────────────────────────

function StepItems({ items, setItems }: {
  items: Item[]; setItems: (items: Item[]) => void
}) {
  const update = (i: number, key: keyof Item, val: string) =>
    setItems(items.map((item, idx) => idx === i ? { ...item, [key]: val } : item))

  const lineTotal = (item: Item) => {
    const qty   = parseFloat(item.quantity)   || 0
    const price = parseFloat(item.unitPrice)  || 0
    const tax   = parseFloat(item.taxRate)    || 0
    return qty * price * (1 + tax / 100)
  }

  const grandTotal = items.reduce((s, i) => s + lineTotal(i), 0)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="text-left py-2 pr-2 w-[40%]">Description</th>
              <th className="text-right py-2 px-2 w-[12%]">Qty</th>
              <th className="text-right py-2 px-2 w-[18%]">Unit price</th>
              <th className="text-right py-2 px-2 w-[12%]">Tax %</th>
              <th className="text-right py-2 px-2 w-[14%]">Total</th>
              <th className="py-2 pl-2 w-[4%]" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2 pr-2">
                  <Input value={item.description} placeholder="Description"
                    onChange={e => update(i, "description", e.target.value)} />
                </td>
                <td className="py-2 px-2">
                  <Input type="number" min="0" value={item.quantity} className="text-right"
                    onChange={e => update(i, "quantity", e.target.value)} />
                </td>
                <td className="py-2 px-2">
                  <Input type="number" min="0" step="0.01" value={item.unitPrice} className="text-right"
                    onChange={e => update(i, "unitPrice", e.target.value)} />
                </td>
                <td className="py-2 px-2">
                  <Input type="number" min="0" max="100" value={item.taxRate} className="text-right"
                    onChange={e => update(i, "taxRate", e.target.value)} />
                </td>
                <td className="py-2 px-2 text-right font-mono text-gray-600">
                  £{lineTotal(item).toFixed(2)}
                </td>
                <td className="py-2 pl-2">
                  {items.length > 1 && (
                    <button onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setItems([...items, emptyItem()])}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add line
        </Button>
        <div className="text-sm font-semibold">
          Grand total: <span className="font-mono">£{grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Step 3 ─────────────────────────────────────────────────────────────────────

function StepReview({ form, items, customers }: {
  form: any; items: Item[]; customers: { id: string; name: string }[]
}) {
  const customer = customers.find(c => c.id === form.customerId)
  const grandTotal = items.reduce((s, item) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unitPrice) || 0
    const tax = parseFloat(item.taxRate) || 0
    return s + qty * price * (1 + tax / 100)
  }, 0)

  const row = (label: string, value: string) => (
    <div key={label} className="flex justify-between py-1.5 border-b last:border-0 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )

  return (
    <div className="space-y-5">
      <Card className="rounded-xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Template details</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {row("Name",          form.templateName)}
          {row("Customer",      customer?.name ?? "—")}
          {row("Frequency",     FREQUENCIES.find(f => f.value === form.frequency)?.label ?? form.frequency)}
          {row("Start date",    form.startDate)}
          {row("End date",      form.endDate || "No end date")}
          {row("Payment terms", `${form.paymentTerms} days`)}
          {row("Currency",      form.currency)}
          {row("Auto-send",     form.autoSend ? "Yes" : "No")}
          {form.maxRuns && row("Max runs", form.maxRuns)}
          {form.notes && row("Notes", form.notes)}
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Line items</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="text-left py-1.5">Description</th>
                <th className="text-right py-1.5">Qty</th>
                <th className="text-right py-1.5">Unit price</th>
                <th className="text-right py-1.5">Tax %</th>
                <th className="text-right py-1.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const qty   = parseFloat(item.quantity)  || 0
                const price = parseFloat(item.unitPrice) || 0
                const tax   = parseFloat(item.taxRate)   || 0
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5">{item.description}</td>
                    <td className="py-1.5 text-right">{qty}</td>
                    <td className="py-1.5 text-right font-mono">£{price.toFixed(2)}</td>
                    <td className="py-1.5 text-right">{tax}%</td>
                    <td className="py-1.5 text-right font-mono">£{(qty * price * (1 + tax / 100)).toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="py-2 text-right font-semibold text-sm">Grand total</td>
                <td className="py-2 text-right font-bold font-mono">£{grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main wizard ────────────────────────────────────────────────────────────────

export default function NewRecurringInvoicePage() {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    templateName: "",
    customerId:   "",
    frequency:    "MONTHLY",
    startDate:    new Date().toISOString().split("T")[0],
    endDate:      "",
    dayOfMonth:   "",
    currency:     "GBP",
    paymentTerms: "30",
    autoSend:     false,
    maxRuns:      "",
    notes:        "",
  })

  const [items, setItems] = useState<Item[]>([emptyItem()])

  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const { data: customersData } = trpc.customers.getAll.useQuery(
    { organizationId: orgId, limit: 200, page: 1, sortBy: "name", sortOrder: "asc" },
    { enabled: !!orgId }
  )
  const customers = customersData?.customers ?? []

  const create = trpc.recurringInvoices.create.useMutation({
    onSuccess: () => router.push("/invoices/recurring"),
    onError: (err) => setError(err.message),
  })

  // ── Validation per step ──────────────────────────────────────────────────────

  const validateStep1 = () => {
    if (!form.templateName.trim()) return "Template name is required."
    if (!form.customerId)          return "Please select a customer."
    if (!form.startDate)           return "Start date is required."
    if (!form.paymentTerms || isNaN(Number(form.paymentTerms))) return "Payment terms must be a number."
    if (form.endDate && form.endDate < form.startDate) return "End date must be after start date."
    return ""
  }

  const validateStep2 = () => {
    if (items.length === 0) return "Add at least one line item."
    for (const item of items) {
      if (!item.description.trim())          return "All line items need a description."
      if (isNaN(parseFloat(item.quantity)))  return "All quantities must be numbers."
      if (isNaN(parseFloat(item.unitPrice))) return "All unit prices must be numbers."
    }
    return ""
  }

  const handleNext = () => {
    setError("")
    const msg = step === 1 ? validateStep1() : step === 2 ? validateStep2() : ""
    if (msg) { setError(msg); return }
    setStep(s => s + 1)
  }

  const handleSubmit = () => {
    setError("")
    create.mutate({
      organizationId: orgId,
      customerId:     form.customerId,
      templateName:   form.templateName,
      frequency:      form.frequency as any,
      startDate:      new Date(form.startDate),
      endDate:        form.endDate ? new Date(form.endDate) : undefined,
      dayOfMonth:     form.dayOfMonth ? parseInt(form.dayOfMonth) : undefined,
      currency:       form.currency,
      notes:          form.notes || undefined,
      paymentTerms:   parseInt(form.paymentTerms),
      autoSend:       form.autoSend,
      maxRuns:        form.maxRuns ? parseInt(form.maxRuns) : undefined,
      items,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 flex h-14 items-center gap-3">
          <button onClick={() => router.push("/invoices/recurring")}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <RefreshCw className="h-5 w-5" style={{ color: BRAND }} />
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>New Recurring Invoice</h1>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <StepBar step={step} />

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">
              {step === 1 ? "Template Details" : step === 2 ? "Line Items" : "Review & Create"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === 1 && <StepDetails form={form} setForm={setForm} customers={customers} />}
            {step === 2 && <StepItems items={items} setItems={setItems} />}
            {step === 3 && <StepReview form={form} items={items} customers={customers} />}

            {error && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex justify-between mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => { setError(""); setStep(s => s - 1) }}
                disabled={step === 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>

              {step < 3 ? (
                <Button onClick={handleNext} style={{ backgroundColor: BRAND }} className="text-white">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={create.isPending}
                  style={{ backgroundColor: BRAND }} className="text-white">
                  {create.isPending
                    ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Creating…</>
                    : <><Check className="h-4 w-4 mr-1" /> Create Template</>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
