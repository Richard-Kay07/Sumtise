import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface AIQueryResult {
  answer: string
  data?: any
  suggestions?: string[]
}

export interface ExpenseCategorization {
  category: string
  confidence: number
  subcategory?: string
  description?: string
}

export interface InvoiceData {
  invoiceNumber?: string
  date?: string
  dueDate?: string
  customerName?: string
  items?: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal?: number
  taxAmount?: number
  total?: number
  currency?: string
}

export class AIService {
  /**
   * Process natural language queries about financial data
   */
  static async processQuery(query: string, organizationId: string): Promise<AIQueryResult> {
    try {
      const systemPrompt = `You are an AI assistant for Sumtise, an accounting software for SMEs in UK and African markets. 
      You help users understand their financial data through natural language queries.
      
      When users ask questions like:
      - "Show me all travel expenses over £500 last quarter"
      - "What was our revenue last month?"
      - "Which customers owe us money?"
      - "How much did we spend on marketing this year?"
      
      Provide helpful, accurate responses based on the context provided. If you need specific data, 
      suggest the appropriate reports or data points to look at.`

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        temperature: 0.3,
        max_tokens: 500,
      })

      const answer = response.choices[0]?.message?.content || "I couldn't process your query."

      return {
        answer,
        suggestions: [
          "View detailed expense report",
          "Check customer aging report",
          "Generate profit & loss statement",
          "Review cash flow analysis"
        ]
      }
    } catch (error) {
      console.error("AI query processing error:", error)
      return {
        answer: "I'm sorry, I couldn't process your query at the moment. Please try again later.",
        suggestions: []
      }
    }
  }

  /**
   * Categorize expenses using AI
   */
  static async categorizeExpense(description: string, amount: number, merchant?: string): Promise<ExpenseCategorization> {
    try {
      const prompt = `Categorize this business expense:
      
      Description: ${description}
      Amount: £${amount}
      ${merchant ? `Merchant: ${merchant}` : ''}
      
      Choose the most appropriate category from these options:
      - Office Supplies
      - Travel & Transport
      - Marketing & Advertising
      - Professional Services
      - Utilities
      - Rent & Property
      - Equipment & Technology
      - Training & Development
      - Insurance
      - Other
      
      Respond with JSON format:
      {
        "category": "category name",
        "confidence": 0.95,
        "subcategory": "optional subcategory",
        "description": "brief explanation"
      }`

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
      })

      const result = JSON.parse(response.choices[0]?.message?.content || "{}")
      
      return {
        category: result.category || "Other",
        confidence: result.confidence || 0.5,
        subcategory: result.subcategory,
        description: result.description
      }
    } catch (error) {
      console.error("Expense categorization error:", error)
      return {
        category: "Other",
        confidence: 0.1,
        description: "Unable to categorize automatically"
      }
    }
  }

  /**
   * Extract data from invoice images/PDFs
   */
  static async extractInvoiceData(imageBase64: string): Promise<InvoiceData> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all relevant information from this invoice image. Return JSON format with fields: invoiceNumber, date, dueDate, customerName, items (array with description, quantity, unitPrice, total), subtotal, taxAmount, total, currency."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
      })

      const result = JSON.parse(response.choices[0]?.message?.content || "{}")
      return result as InvoiceData
    } catch (error) {
      console.error("Invoice data extraction error:", error)
      return {}
    }
  }

  /**
   * Generate financial insights and recommendations
   */
  static async generateInsights(organizationId: string, period: string = "last 30 days"): Promise<string[]> {
    try {
      const prompt = `Generate 5 actionable financial insights for an SME based on common patterns. 
      Focus on:
      - Cash flow optimization
      - Expense reduction opportunities
      - Revenue growth suggestions
      - Tax optimization
      - Financial health improvements
      
      Make insights specific and actionable for UK and African markets.`

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
      })

      const insights = response.choices[0]?.message?.content || ""
      return insights.split('\n').filter(line => line.trim().length > 0).slice(0, 5)
    } catch (error) {
      console.error("Insights generation error:", error)
      return [
        "Review your cash flow patterns to identify optimization opportunities",
        "Consider automating recurring expenses to reduce manual work",
        "Analyze customer payment patterns to improve collection times",
        "Evaluate expense categories for potential cost savings",
        "Monitor key financial ratios to maintain healthy business metrics"
      ]
    }
  }

  /**
   * Detect anomalies in financial data
   */
  static async detectAnomalies(transactions: any[]): Promise<Array<{
    type: string
    description: string
    severity: 'low' | 'medium' | 'high'
    transactionId?: string
  }>> {
    try {
      // This would typically involve more sophisticated anomaly detection
      // For now, we'll use a simple rule-based approach with AI enhancement
      
      const anomalies: Array<{
        type: string
        description: string
        severity: 'low' | 'medium' | 'high'
        transactionId?: string
      }> = []

      // Check for unusually large transactions
      const avgAmount = transactions.reduce((sum, t) => sum + Math.abs(t.debit + t.credit), 0) / transactions.length
      const largeTransactions = transactions.filter(t => 
        Math.abs(t.debit + t.credit) > avgAmount * 3
      )

      largeTransactions.forEach(transaction => {
        anomalies.push({
          type: "unusual_amount",
          description: `Unusually large transaction: ${transaction.description}`,
          severity: "medium",
          transactionId: transaction.id
        })
      })

      // Check for duplicate transactions
      const duplicates = transactions.filter((t, i) => 
        transactions.findIndex(other => 
          other.description === t.description && 
          Math.abs(other.debit - t.debit) < 0.01 &&
          Math.abs(other.credit - t.credit) < 0.01 &&
          other.id !== t.id
        ) !== -1
      )

      duplicates.forEach(transaction => {
        anomalies.push({
          type: "duplicate",
          description: `Potential duplicate transaction: ${transaction.description}`,
          severity: "high",
          transactionId: transaction.id
        })
      })

      return anomalies
    } catch (error) {
      console.error("Anomaly detection error:", error)
      return []
    }
  }

  /**
   * Generate cash flow predictions
   */
  static async predictCashFlow(historicalData: any[], days: number = 30): Promise<{
    predictions: Array<{ date: string; predicted: number; confidence: number }>
    insights: string[]
  }> {
    try {
      // This would typically use time series analysis
      // For now, we'll provide a simple trend-based prediction
      
      const recentData = historicalData.slice(-30) // Last 30 days
      const avgDailyFlow = recentData.reduce((sum, day) => sum + day.netFlow, 0) / recentData.length
      
      const predictions = []
      const insights = []
      
      for (let i = 1; i <= days; i++) {
        const date = new Date()
        date.setDate(date.getDate() + i)
        
        predictions.push({
          date: date.toISOString().split('T')[0],
          predicted: avgDailyFlow * i,
          confidence: Math.max(0.6, 1 - (i / days) * 0.4) // Decreasing confidence over time
        })
      }

      if (avgDailyFlow > 0) {
        insights.push("Positive cash flow trend detected")
      } else {
        insights.push("Negative cash flow trend - consider cost reduction")
      }

      return { predictions, insights }
    } catch (error) {
      console.error("Cash flow prediction error:", error)
      return { predictions: [], insights: ["Unable to generate predictions"] }
    }
  }
}
