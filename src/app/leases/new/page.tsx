"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { ChevronLeft, ChevronRight, RefreshCw, Info } from "lucide-react"
import { useRouter } from "next/navigation"

const BRAND = "#50B0E0"

const ASSET_CLASSES = ["PROPERTY", "VEHICLES", "EQUIPMENT", "IT", "OTHER"]
const TREATMENTS = [
  {
    value: "IFRS16_FULL",
    label: "IFRS 16 Full recognition",
    desc: "ROU asset + lease liability on balance sheet. Required for leases > 12 months and asset value > £5,000.",
  },
  {
    value: "SHORT_TERM",
    label: "Short-term exemption (≤ 12 months)",
    desc: "Straight-line expense to P&L. No balance sheet recognition.",
  },
  {
    value: "LOW_VALUE",
    label: "Low-value exemption (asset ≤ £5,000)",
    desc: "Straight-line expense to P&L. No balance sheet recognition.",
  },
]

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {["Lease details", "Financial terms", "Account mapping"].map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold ${i + 1 <= step ? "text-white" : "bg-gray-100 text-gray-400"}`}
            style={i + 1 <= step ? { backgroundColor: BRAND } : {}}>
            {i + 1}
          </div>
          <span className={`text-xs ${i + 1 === step ? "font-semibold text-gray-900" : "text-gray-400"}`}>{label}</span>
          {i < 2 && <ChevronRight className="h-3 w-3 text-gray-300" />}
        </div>
      ))}
    </div>
  )
}

export default function NewLeasePage() {
  const router   = useRouter()
  const [step,   setStep] = useState(1)

  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const { data: coa } = trpc.chartOfAccounts.getAll.useQuery({ organizationId: orgId }, { enabled: !!orgId })
  const accounts = coa ?? []

  const create = trpc.leases.create.useMutation({
    onSuccess: (d: any) => router.push(`/leases/${d.id}`),
  })

  // Step 1 fields
  const [ref,    setRef]    = useState("")
  const [desc,   setDesc]   = useState("")
  const [cls,    setCls]    = useState("PROPERTY")
  const [comm,   setComm]   = useState(new Date().toISOString().split("T")[0])
  const [endD,   setEndD]   = useState("")
  const [landlord, setLandlord] = useState("")
  const [address,  setAddress]  = useState("")

  // Step 2 fields
  const [treatment,  setTreatment]  = useState("IFRS16_FULL")
  const [annual,     setAnnual]     = useState("")
  const [freq,       setFreq]       = useState("MONTHLY")
  const [payDay,     setPayDay]     = useState("1")
  const [rentFree,   setRentFree]   = useState("0")
  const [ibr,        setIbr]        = useState("")

  // Step 3 fields
  const [rouAcct,   setRouAcct]   = useState("")
  const [liabAcct,  setLiabAcct]  = useState("")
  const [deprAcct,  setDeprAcct]  = useState("")
  const [intAcct,   setIntAcct]   = useState("")

  // Live PV estimate
  const pvEstimate = (() => {
    if (!annual || !ibr || !comm || !endD) return null
    const rate   = parseFloat(ibr) / 100
    const months = Math.round((new Date(endD).getTime() - new Date(comm).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    if (months <= 0 || rate <= 0) return null
    const payment = parseFloat(annual) / 12
    const pv = payment * (1 - Math.pow(1 + rate / 12, -months)) / (rate / 12)
    return pv
  })()

  const submit = () => {
    create.mutate({
      organizationId:         orgId,
      leaseReference:         ref,
      description:            desc,
      assetClass:             cls as any,
      commencementDate:       new Date(comm),
      endDate:                endD ? new Date(endD) : undefined,
      treatment:              treatment as any,
      annualPayment:          annual,
      paymentFrequency:       freq as any,
      paymentDayOfMonth:      parseInt(payDay),
      rentFreeMonths:         parseInt(rentFree),
      incrementalBorrowingRate: ibr || undefined,
      lessorName:             landlord || undefined,
      propertyAddress:        address || undefined,
      rouAssetAccountId:      rouAcct  || undefined,
      leaseLiabilityAccountId: liabAcct || undefined,
      depreciationAccountId:  deprAcct || undefined,
      interestAccountId:      intAcct  || undefined,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 flex h-14 items-center gap-3">
          <a href="/leases" className="text-gray-400 hover:text-gray-600"><ChevronLeft className="h-5 w-5" /></a>
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>New Lease</h1>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-7">
        <StepIndicator step={step} />

        {step === 1 && (
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Lease Details</CardTitle><CardDescription>Basic identification and asset class.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Reference *</Label>
                  <Input className="h-9 rounded-xl mt-1" placeholder="LEASE-001" value={ref} onChange={(e) => setRef(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Asset class</Label>
                  <select className="w-full border rounded-xl h-9 text-sm px-3 mt-1 bg-white" value={cls} onChange={(e) => setCls(e.target.value)}>
                    {ASSET_CLASSES.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Description *</Label>
                  <Input className="h-9 rounded-xl mt-1" placeholder="Registered office lease — 123 High St" value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Commencement date *</Label>
                  <Input type="date" className="h-9 rounded-xl mt-1" value={comm} onChange={(e) => setComm(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">End date</Label>
                  <Input type="date" className="h-9 rounded-xl mt-1" value={endD} onChange={(e) => setEndD(e.target.value)} />
                </div>
                {cls === "PROPERTY" && (
                  <>
                    <div>
                      <Label className="text-xs">Landlord name</Label>
                      <Input className="h-9 rounded-xl mt-1" value={landlord} onChange={(e) => setLandlord(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Property address</Label>
                      <Input className="h-9 rounded-xl mt-1" value={address} onChange={(e) => setAddress(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end">
                <Button className="rounded-xl text-sm gap-1" style={{ backgroundColor: BRAND }}
                  disabled={!ref || !desc || !comm}
                  onClick={() => setStep(2)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Financial Terms</CardTitle><CardDescription>Payment schedule and accounting treatment.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="text-xs mb-2 block">Treatment</Label>
                <div className="space-y-2">
                  {TREATMENTS.map((t) => (
                    <label key={t.value} className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${treatment === t.value ? "border-[#50B0E0] bg-blue-50/40" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" className="mt-0.5" checked={treatment === t.value} onChange={() => setTreatment(t.value)} />
                      <div>
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="text-xs text-gray-500">{t.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Annual rent amount *</Label>
                  <Input className="h-9 rounded-xl mt-1" placeholder="12000" value={annual} onChange={(e) => setAnnual(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Payment frequency</Label>
                  <select className="w-full border rounded-xl h-9 text-sm px-3 mt-1 bg-white" value={freq} onChange={(e) => setFreq(e.target.value)}>
                    {["MONTHLY", "QUARTERLY", "ANNUALLY"].map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Payment day of month</Label>
                  <Input type="number" min="1" max="28" className="h-9 rounded-xl mt-1" value={payDay} onChange={(e) => setPayDay(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Rent-free months</Label>
                  <Input type="number" min="0" className="h-9 rounded-xl mt-1" value={rentFree} onChange={(e) => setRentFree(e.target.value)} />
                </div>
                {treatment === "IFRS16_FULL" && (
                  <div className="col-span-2">
                    <Label className="text-xs flex items-center gap-1">
                      Incremental borrowing rate (%)
                      <span title="Use your bank's marginal lending rate if unsure."><Info className="h-3 w-3 text-gray-400" /></span>
                    </Label>
                    <Input className="h-9 rounded-xl mt-1" placeholder="5.5" value={ibr} onChange={(e) => setIbr(e.target.value)} />
                    {pvEstimate != null && (
                      <p className="text-xs text-[#50B0E0] mt-1">
                        Estimated present value: <strong>£{pvEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" className="rounded-xl text-sm" onClick={() => setStep(1)}>Back</Button>
                <Button className="rounded-xl text-sm gap-1" style={{ backgroundColor: BRAND }}
                  disabled={!annual}
                  onClick={() => setStep(3)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Account Mapping</CardTitle><CardDescription>Ledger accounts for day-1 and ongoing postings.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "ROU Asset account",         value: rouAcct,   set: setRouAcct },
                { label: "Lease Liability account",   value: liabAcct,  set: setLiabAcct },
                { label: "Depreciation account",      value: deprAcct,  set: setDeprAcct },
                { label: "Interest expense account",  value: intAcct,   set: setIntAcct },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <Label className="text-xs">{label}</Label>
                  <select className="w-full border rounded-xl h-9 text-sm px-3 mt-1 bg-white" value={value} onChange={(e) => set(e.target.value)}>
                    <option value="">— use default —</option>
                    {(accounts as any[]).map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
              ))}

              <div className="flex justify-between mt-4">
                <Button variant="outline" className="rounded-xl text-sm" onClick={() => setStep(2)}>Back</Button>
                <Button className="rounded-xl text-sm gap-1" style={{ backgroundColor: BRAND }}
                  disabled={create.isPending}
                  onClick={submit}>
                  {create.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Create Lease"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
