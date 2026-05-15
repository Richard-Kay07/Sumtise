"use client"

import { useState, Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { format } from "date-fns"
import { RefreshCw, Plus, Trash2, Save, DollarSign } from "lucide-react"

const COMMON_CURRENCIES = [
  "GBP", "USD", "EUR", "JPY", "CHF", "CAD", "AUD", "NZD",
  "SEK", "NOK", "DKK", "HKD", "SGD", "ZAR", "INR", "CNY",
]

function CurrencySettingsContent() {
  const utils = trpc.useContext()

  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const { data: settings, isLoading: settingsLoading } = trpc.fxRates.getSettings.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const updateSettings = trpc.fxRates.updateSettings.useMutation({
    onSuccess: () => utils.fxRates.getSettings.invalidate(),
  })

  const syncEcb = trpc.fxRates.syncEcb.useMutation({
    onSuccess: () => utils.fxRates.list.invalidate(),
  })

  const { data: ratesData, isLoading: ratesLoading } = trpc.fxRates.list.useQuery(
    { organizationId: orgId, limit: 100 },
    { enabled: !!orgId }
  )

  const upsertRate = trpc.fxRates.upsert.useMutation({
    onSuccess: () => {
      utils.fxRates.list.invalidate()
      setNewRate({ fromCurrency: "", toCurrency: "", rate: "", date: format(new Date(), "yyyy-MM-dd") })
    },
  })

  const deleteRate = trpc.fxRates.delete.useMutation({
    onSuccess: () => utils.fxRates.list.invalidate(),
  })

  const [functionalCurrency, setFunctionalCurrency] = useState("")
  const [enableMultiCurrency, setEnableMultiCurrency] = useState(false)
  const [newRate, setNewRate] = useState({
    fromCurrency: "",
    toCurrency: "",
    rate: "",
    date: format(new Date(), "yyyy-MM-dd"),
  })
  const [settingsInitialised, setSettingsInitialised] = useState(false)

  if (settings && !settingsInitialised) {
    setFunctionalCurrency(settings.functionalCurrency ?? "GBP")
    setEnableMultiCurrency(settings.enableMultiCurrencyFX ?? false)
    setSettingsInitialised(true)
  }

  const handleSaveSettings = () => {
    updateSettings.mutate({
      organizationId: orgId,
      functionalCurrency: functionalCurrency || "GBP",
      enableMultiCurrencyFX: enableMultiCurrency,
    })
  }

  const handleAddRate = () => {
    if (!newRate.fromCurrency || !newRate.toCurrency || !newRate.rate) return
    upsertRate.mutate({
      organizationId: orgId,
      fromCurrency: newRate.fromCurrency.toUpperCase(),
      toCurrency: newRate.toCurrency.toUpperCase(),
      rate: parseFloat(newRate.rate),
      date: new Date(newRate.date),
    })
  }

  const handleSyncEcb = () => {
    syncEcb.mutate({ organizationId: orgId })
  }

  if (!orgId || settingsLoading) {
    return <div className="p-6 text-muted-foreground text-sm">Loading…</div>
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Multi-Currency Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your functional currency and manage FX exchange rates used at posting time.
        </p>
      </div>

      {/* Functional Currency */}
      <Card>
        <CardHeader>
          <CardTitle>Functional Currency</CardTitle>
          <CardDescription>
            The currency in which your books are kept. All foreign-currency transactions are
            translated to this currency when posted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1 max-w-xs">
              <Label>Functional Currency</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={functionalCurrency}
                onChange={e => setFunctionalCurrency(e.target.value)}
              >
                {COMMON_CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Multi-currency enabled</Label>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="enableMultiCurrency"
                  checked={enableMultiCurrency}
                  onChange={e => setEnableMultiCurrency(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="enableMultiCurrency" className="text-sm">
                  Enable FX conversion at posting time
                </label>
              </div>
            </div>
          </div>
          <Button onClick={handleSaveSettings} disabled={updateSettings.isPending} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {updateSettings.isPending ? "Saving…" : "Save settings"}
          </Button>
          {updateSettings.isSuccess && (
            <p className="text-sm text-green-600">Settings saved.</p>
          )}
        </CardContent>
      </Card>

      {/* ECB Sync */}
      <Card>
        <CardHeader>
          <CardTitle>Import Rates from ECB</CardTitle>
          <CardDescription>
            Fetch today&apos;s reference rates from the European Central Bank (free, no API key).
            Rates are stored as EUR-based and GBP cross-rates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSyncEcb} disabled={syncEcb.isPending} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncEcb.isPending ? "animate-spin" : ""}`} />
            {syncEcb.isPending ? "Fetching…" : "Sync from ECB"}
          </Button>
          {syncEcb.isSuccess && (
            <p className="text-sm text-green-600 mt-2">
              Imported {syncEcb.data?.count} rates for {syncEcb.data?.date ? format(new Date(syncEcb.data.date), "dd MMM yyyy") : ""}.
            </p>
          )}
          {syncEcb.isError && (
            <p className="text-sm text-red-600 mt-2">
              Sync failed. Check network access to ECB.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Manual Rate Entry */}
      <Card>
        <CardHeader>
          <CardTitle>Add Manual Rate</CardTitle>
          <CardDescription>
            Enter a spot rate for a specific date. 1 unit of From = Rate units of To.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label>From</Label>
              <Input
                className="w-24 uppercase"
                placeholder="USD"
                maxLength={3}
                value={newRate.fromCurrency}
                onChange={e => setNewRate(p => ({ ...p, fromCurrency: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input
                className="w-24 uppercase"
                placeholder="GBP"
                maxLength={3}
                value={newRate.toCurrency}
                onChange={e => setNewRate(p => ({ ...p, toCurrency: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Rate</Label>
              <Input
                className="w-32"
                placeholder="0.7850"
                type="number"
                step="0.000001"
                value={newRate.rate}
                onChange={e => setNewRate(p => ({ ...p, rate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                className="w-40"
                value={newRate.date}
                onChange={e => setNewRate(p => ({ ...p, date: e.target.value }))}
              />
            </div>
            <Button
              onClick={handleAddRate}
              disabled={upsertRate.isPending || !newRate.fromCurrency || !newRate.toCurrency || !newRate.rate}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stored Rates</CardTitle>
          <CardDescription>
            {ratesData?.total ?? 0} rate{ratesData?.total !== 1 ? "s" : ""} stored
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ratesLoading ? (
            <p className="text-sm text-muted-foreground">Loading rates…</p>
          ) : !ratesData?.rates.length ? (
            <p className="text-sm text-muted-foreground">
              No rates stored yet. Sync from ECB or add manually above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-left py-2 pr-4">From</th>
                    <th className="text-left py-2 pr-4">To</th>
                    <th className="text-right py-2 pr-4">Rate</th>
                    <th className="text-left py-2 pr-4">Source</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {ratesData.rates.map(r => (
                    <tr key={r.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 pr-4">{format(new Date(r.date), "dd MMM yyyy")}</td>
                      <td className="py-2 pr-4 font-mono">{r.fromCurrency}</td>
                      <td className="py-2 pr-4 font-mono">{r.toCurrency}</td>
                      <td className="py-2 pr-4 text-right font-mono">{Number(r.rate).toFixed(6)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={r.source === "ECB" ? "secondary" : "outline"} className="text-xs">
                          {r.source}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRate.mutate({ organizationId: orgId, id: r.id })}
                          disabled={deleteRate.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function CurrencySettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground text-sm">Loading…</div>}>
      <CurrencySettingsContent />
    </Suspense>
  )
}
