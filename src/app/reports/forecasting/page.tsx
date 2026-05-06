"use client"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, Clock } from "lucide-react"

export default function ForecastingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Forecasting</h1>
          <p className="text-gray-500">Revenue and expense projections</p>
        </div>

        <Card>
          <CardContent className="py-20 flex flex-col items-center text-center gap-4">
            <div className="rounded-full bg-blue-50 p-5">
              <TrendingUp className="h-10 w-10 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Forecasting Coming Soon</h2>
            <p className="text-gray-500 max-w-md">
              AI-powered revenue and expense forecasting is under development. It will use your
              historical transactions, invoices, and budgets to generate rolling projections.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
              <Clock className="h-4 w-4" />
              <span>Planned for a future release</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
