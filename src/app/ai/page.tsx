"use client"

import { useState } from "react"
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
  AlertTriangle,
  CheckCircle,
  Clock,
  Brain
} from "lucide-react"
import { Logo } from "@/components/logo"

interface AIResponse {
  answer: string
  data?: any
  suggestions?: string[]
}

export default function AIPage() {
  const [query, setQuery] = useState("")
  const [responses, setResponses] = useState<AIResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  const handleQuery = async () => {
    if (!query.trim()) return

    setIsLoading(true)
    const userQuery = query.trim()
    setQuery("")

    // Add user query to responses
    setResponses(prev => [...prev, { answer: userQuery, data: null }])

    try {
      // This would call the AI service
      // For now, we'll simulate a response
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockResponse: AIResponse = {
        answer: `Based on your query "${userQuery}", here's what I found:

For the last quarter, you had 12 travel expenses totaling £3,450. The largest expense was £850 for a business trip to London in March. 

Key insights:
- Travel expenses increased 15% compared to the previous quarter
- Average expense per trip: £287
- Most common expense type: Accommodation (40%)

Would you like me to break this down further or show you the detailed expense report?`,
        suggestions: [
          "View detailed travel expense report",
          "Compare with previous quarter",
          "Export expense data",
          "Set up travel expense alerts"
        ]
      }

      setResponses(prev => [...prev, mockResponse])
    } catch (error) {
      setResponses(prev => [...prev, {
        answer: "I'm sorry, I couldn't process your query. Please try again.",
        suggestions: []
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleQuery()
    }
  }

  const exampleQueries = [
    "Show me all travel expenses over £500 last quarter",
    "What was our revenue last month?",
    "Which customers owe us money?",
    "How much did we spend on marketing this year?",
    "What's our cash flow trend?",
    "Find duplicate transactions",
    "Show me overdue invoices",
    "What are our top expense categories?"
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Main Content */}
      <main className="container mx-auto py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bot className="mr-2 h-5 w-5" />
                  Ask me anything about your finances
                </CardTitle>
                <CardDescription>
                  Use natural language to query your financial data
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  {responses.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Bot className="mx-auto h-12 w-12 mb-4" />
                      <p>Start a conversation by asking about your financial data</p>
                    </div>
                  ) : (
                    responses.map((response, index) => (
                      <div key={index} className={`flex ${index % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-lg ${
                          index % 2 === 0 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="whitespace-pre-wrap">{response.answer}</p>
                          {response.suggestions && response.suggestions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {response.suggestions.map((suggestion, i) => (
                                <Badge 
                                  key={i} 
                                  variant={index % 2 === 0 ? "secondary" : "outline"}
                                  className="cursor-pointer hover:bg-primary/10"
                                >
                                  {suggestion}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          <span>Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="flex space-x-2">
                  <Input
                    placeholder="Ask me about your finances..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                  />
                  <Button onClick={handleQuery} disabled={isLoading || !query.trim()}>
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
                <CardDescription>
                  Try these sample questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {exampleQueries.map((example, index) => (
                    <Button
                      key={index}
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
                <CardDescription>
                  Automated financial insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Cash Flow Positive</p>
                      <p className="text-xs text-muted-foreground">
                        Your cash flow improved 12% this month
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Expense Alert</p>
                      <p className="text-xs text-muted-foreground">
                        Travel expenses increased 25% this quarter
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Payment Reminder</p>
                      <p className="text-xs text-muted-foreground">
                        3 invoices are overdue by more than 30 days
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Capabilities */}
            <Card>
              <CardHeader>
                <CardTitle>What I Can Help With</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Financial data analysis</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Expense categorization</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Anomaly detection</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Cash flow predictions</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Invoice data extraction</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Tax compliance insights</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
