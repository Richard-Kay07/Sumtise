"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import {
  Bot,
  Send,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Brain,
  Loader2,
} from "lucide-react"
import { Logo } from "@/components/logo"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  suggestions?: string[]
}

const EXAMPLE_QUERIES = [
  "Show me all travel expenses over £500 last quarter",
  "What was our revenue last month?",
  "Which customers owe us money?",
  "How much did we spend on marketing this year?",
  "What's our cash flow trend?",
  "Find duplicate transactions",
  "Show me overdue invoices",
  "What are our top expense categories?",
]

export default function AIPage() {
  const [query, setQuery] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = organizations?.[0]?.id ?? ""

  const { data: insights, isLoading: insightsLoading } = trpc.ai.generateInsights.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const processQuery = trpc.ai.processQuery.useMutation({
    onSuccess: (result) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer, suggestions: result.suggestions },
      ])
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}. Please try again.` },
      ])
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, processQuery.isPending])

  const handleQuery = () => {
    const q = query.trim()
    if (!q || !orgId) return
    setQuery("")
    setMessages((prev) => [...prev, { role: "user", content: q }])
    processQuery.mutate({ organizationId: orgId, query: q })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleQuery()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a className="mr-6" href="/">
              <Logo size={32} showText={true} />
            </a>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <h1 className="text-2xl font-bold flex items-center">
                <Brain className="mr-2 h-6 w-6" />
                AI Assistant
              </h1>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Chat */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bot className="mr-2 h-5 w-5" />
                  Ask me anything about your finances
                </CardTitle>
                <CardDescription>Use natural language to query your financial data</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Bot className="mx-auto h-12 w-12 mb-4 opacity-40" />
                      <p>Start a conversation by asking about your financial data</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] p-4 rounded-lg ${
                            msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                          {msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {msg.suggestions.map((s, j) => (
                                <Badge
                                  key={j}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-primary/10 text-xs"
                                  onClick={() => setQuery(s)}
                                >
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {processQuery.isPending && (
                    <div className="flex justify-start">
                      <div className="bg-muted p-4 rounded-lg flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking…
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Ask me about your finances..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={processQuery.isPending || !orgId}
                  />
                  <Button onClick={handleQuery} disabled={processQuery.isPending || !query.trim() || !orgId}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Example Queries */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lightbulb className="mr-2 h-5 w-5" />
                  Example Queries
                </CardTitle>
                <CardDescription>Try these sample questions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {EXAMPLE_QUERIES.map((example, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="w-full justify-start text-left h-auto p-3"
                      onClick={() => setQuery(example)}
                    >
                      <span className="text-sm">{example}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  AI Insights
                </CardTitle>
                <CardDescription>Automated financial insights</CardDescription>
              </CardHeader>
              <CardContent>
                {insightsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : insights && insights.length > 0 ? (
                  <div className="space-y-4">
                    {insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-3">
                        {i % 2 === 0 ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                        )}
                        <p className="text-sm text-muted-foreground leading-snug">{insight}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {orgId ? "No insights available yet." : "Sign in to an organisation to see insights."}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Capabilities */}
            <Card>
              <CardHeader><CardTitle>What I Can Help With</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    "Financial data analysis",
                    "Expense categorization",
                    "Anomaly detection",
                    "Cash flow predictions",
                    "Invoice data extraction",
                    "Tax compliance insights",
                  ].map((cap) => (
                    <div key={cap} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{cap}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
