/**
 * Receipt / invoice OCR
 *
 * Strategy:
 * 1. Run tesseract.js on the raw image buffer for text extraction
 * 2. If confidence >= 55 and enough text found, parse extracted text with GPT-4o-mini
 * 3. Otherwise fall back to GPT-4o vision for direct image understanding
 */

import OpenAI from "openai"
import { resolveModels, getModelId } from "./model-registry"

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

export interface ReceiptLineItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
  taxRate: number
}

export interface ReceiptData {
  vendorName?: string
  vendorAddress?: string
  invoiceReference?: string    // supplier's invoice/receipt number
  date?: string                // ISO YYYY-MM-DD
  dueDate?: string
  currency?: string
  subtotal?: number
  taxAmount?: number
  taxRate?: number             // dominant rate e.g. 20
  total?: number
  items: ReceiptLineItem[]
  notes?: string
  confidence: number           // 0–1 overall extraction confidence
  rawText?: string             // only populated from tesseract path
}

// ── Tesseract path ────────────────────────────────────────────────────────────

async function runTesseract(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
  // Dynamic import so tesseract is only loaded server-side when needed
  const Tesseract = (await import("tesseract.js")).default
  const { data } = await Tesseract.recognize(imageBuffer, "eng", { logger: () => {} })
  return { text: data.text ?? "", confidence: (data.confidence ?? 0) / 100 }
}

async function parseTextWithGPT(text: string, modelOverride?: string): Promise<ReceiptData> {
  const model = modelOverride ?? getModelId("FAST")
  const prompt = `Extract structured data from this receipt/invoice text.

TEXT:
${text}

Return JSON matching this schema exactly (use null for missing fields):
{
  "vendorName": string | null,
  "vendorAddress": string | null,
  "invoiceReference": string | null,
  "date": "YYYY-MM-DD" | null,
  "dueDate": "YYYY-MM-DD" | null,
  "currency": "GBP" | "USD" | "EUR" | string | null,
  "subtotal": number | null,
  "taxAmount": number | null,
  "taxRate": number | null,
  "total": number | null,
  "items": [{ "description": string, "quantity": number, "unitPrice": number, "total": number, "taxRate": number }],
  "notes": string | null
}`

  const res = await getOpenAI().chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 800,
  })

  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}")
  return { ...parsed, items: parsed.items ?? [], confidence: 0.75 }
}

// ── GPT vision path ──────────────────────────────────────────────────────────

async function extractWithVision(imageBuffer: Buffer, mimeType = "image/jpeg", modelOverride?: string): Promise<ReceiptData> {
  const model = modelOverride ?? getModelId("VISION")
  const base64 = imageBuffer.toString("base64")
  const dataUrl = `data:${mimeType};base64,${base64}`

  const res = await getOpenAI().chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract all structured data from this receipt or invoice image. Return JSON:
{
  "vendorName": string | null,
  "vendorAddress": string | null,
  "invoiceReference": string | null,
  "date": "YYYY-MM-DD" | null,
  "dueDate": "YYYY-MM-DD" | null,
  "currency": string | null,
  "subtotal": number | null,
  "taxAmount": number | null,
  "taxRate": number | null,
  "total": number | null,
  "items": [{ "description": string, "quantity": number, "unitPrice": number, "total": number, "taxRate": number }],
  "notes": string | null
}`,
          },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1000,
  })

  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}")
  return { ...parsed, items: parsed.items ?? [], confidence: 0.9 }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function scanReceipt(
  imageBuffer: Buffer,
  mimeType = "image/jpeg",
  modelOverrides?: { fast?: string; vision?: string }
): Promise<ReceiptData> {
  // Warm the model cache before use
  await resolveModels(openai)
  try {
    const { text, confidence } = await runTesseract(imageBuffer)

    if (confidence >= 0.55 && text.replace(/\s/g, "").length > 80) {
      const result = await parseTextWithGPT(text, modelOverrides?.fast)
      return { ...result, rawText: text.slice(0, 2000) }
    }
  } catch {
    // tesseract not available or failed — fall through to vision
  }

  return extractWithVision(imageBuffer, mimeType, modelOverrides?.vision)
}

// ── Expense categorization against real COA ──────────────────────────────────

export interface CategorizedExpense {
  suggestedAccountId: string
  suggestedAccountName: string
  suggestedAccountCode: string
  confidence: number
  reasoning: string
}

export async function categorizeAgainstCOA(
  description: string,
  amount: number,
  merchantName: string | undefined,
  expenseAccounts: Array<{ id: string; name: string; code: string }>,
  modelOverride?: string
): Promise<CategorizedExpense> {
  if (expenseAccounts.length === 0) {
    return {
      suggestedAccountId: "",
      suggestedAccountName: "No expense accounts found",
      suggestedAccountCode: "",
      confidence: 0,
      reasoning: "No expense accounts configured in chart of accounts.",
    }
  }

  const accountList = expenseAccounts
    .map((a, i) => `${i + 1}. [${a.code}] ${a.name} (id: ${a.id})`)
    .join("\n")

  const prompt = `Match this business expense to the most appropriate account.

EXPENSE:
  Description: ${description}
  Amount: £${amount}${merchantName ? `\n  Merchant: ${merchantName}` : ""}

AVAILABLE EXPENSE ACCOUNTS:
${accountList}

Return JSON:
{
  "accountIndex": <1-based index into the list above>,
  "confidence": <0.0-1.0>,
  "reasoning": "<one sentence>"
}`

  const model = modelOverride ?? getModelId("FAST")
  const res = await getOpenAI().chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 150,
  })

  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}")
  const idx = (parsed.accountIndex ?? 1) - 1
  const account = expenseAccounts[Math.min(Math.max(idx, 0), expenseAccounts.length - 1)]

  return {
    suggestedAccountId: account.id,
    suggestedAccountName: account.name,
    suggestedAccountCode: account.code,
    confidence: parsed.confidence ?? 0.6,
    reasoning: parsed.reasoning ?? "",
  }
}
