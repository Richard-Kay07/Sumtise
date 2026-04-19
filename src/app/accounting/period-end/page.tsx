"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckSquare, Lock } from "lucide-react"

const tasks = [
  { task: "Reconcile bank accounts", category: "Banking", done: true },
  { task: "Review accounts receivable", category: "Debtors", done: true },
  { task: "Review accounts payable", category: "Creditors", done: true },
  { task: "Post depreciation journals", category: "Assets", done: true },
  { task: "Accrue expenses", category: "Accruals", done: false },
  { task: "Prepayment adjustments", category: "Prepayments", done: false },
  { task: "VAT reconciliation", category: "Tax", done: false },
  { task: "Intercompany reconciliation", category: "Group", done: false },
  { task: "Review P&L variance", category: "Reporting", done: false },
  { task: "Lock period", category: "Admin", done: false },
]

export default function PeriodEndPage() {
  const done = tasks.filter(t => t.done).length
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Period End</h1>
            <p className="text-gray-500">Month-end close checklist – March 2024</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2">
            <Lock className="h-4 w-4" />Lock Period
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Period Close Progress</span>
              <span className="text-sm text-gray-500">{done}/{tasks.length} tasks</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="h-3 rounded-full transition-all" style={{ width: `${(done / tasks.length) * 100}%`, backgroundColor: "#50B0E0" }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">{Math.round((done / tasks.length) * 100)}% complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5" />Close Checklist</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${t.done ? "bg-green-500" : "border-2 border-gray-300"}`}>
                    {t.done && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className={`flex-1 text-sm ${t.done ? "line-through text-gray-400" : "text-gray-700"}`}>{t.task}</span>
                  <Badge variant="outline" className="text-xs">{t.category}</Badge>
                  <Badge className={t.done ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>{t.done ? "Done" : "Pending"}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
