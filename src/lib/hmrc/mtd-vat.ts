import { refreshAccessToken } from './oauth'
import { buildFraudPreventionHeaders } from './fraud-prevention'
import { prisma } from '@/lib/prisma'

const HMRC_BASE_URL = process.env.HMRC_BASE_URL ?? 'https://test-api.service.hmrc.gov.uk'

interface HmrcObligation {
  start: string
  end: string
  due: string
  status: 'O' | 'F'
  periodKey: string
  received?: string
}

interface HmrcObligationsResponse {
  obligations: Array<{ periodKey: string; start: string; end: string; due: string; status: 'O' | 'F'; received?: string }>
}

interface VatReturnPayload {
  periodKey: string
  vatDueSales: number
  vatDueAcquisitions: number
  totalVatDue: number
  vatReclaimedCurrPeriod: number
  netVatDue: number
  totalValueSalesExVAT: number
  totalValuePurchasesExVAT: number
  totalValueGoodsSuppliedExVAT: number
  totalAcquisitionsExVAT: number
  finalised: boolean
}

async function hmrcFetch(
  organizationId: string,
  path: string,
  options: RequestInit & { userAgent?: string; userId?: string } = {}
): Promise<Response> {
  const token = await refreshAccessToken(organizationId)
  const userAgent = options.userAgent ?? 'sumtise/1.0.0'
  const userId = options.userId ?? 'system'

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.hmrc.1.0+json',
    'Content-Type': 'application/json',
    ...buildFraudPreventionHeaders(userAgent, userId),
    ...(options.headers as Record<string, string> ?? {}),
  }

  return fetch(`${HMRC_BASE_URL}${path}`, { ...options, headers })
}

export async function getVatObligations(
  organizationId: string,
  vrn: string,
  fromDate: string,
  toDate: string,
  userId = 'system'
): Promise<HmrcObligation[]> {
  const res = await hmrcFetch(
    organizationId,
    `/organisations/vat/${vrn}/obligations?from=${fromDate}&to=${toDate}`,
    { userId }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HMRC getVatObligations failed: ${res.status} ${body}`)
  }

  const data: HmrcObligationsResponse = await res.json()
  const conn = await prisma.hmrcConnection.findUnique({ where: { organizationId } })
  if (!conn) throw new Error('No HMRC connection')

  for (const obl of data.obligations) {
    await prisma.vatPeriod.upsert({
      where: { organizationId_periodKey: { organizationId, periodKey: obl.periodKey } },
      create: {
        organizationId,
        hmrcConnectionId: conn.id,
        vrn,
        periodKey: obl.periodKey,
        periodStart: new Date(obl.start),
        periodEnd: new Date(obl.end),
        dueDate: new Date(obl.due),
        status: obl.status === 'F' ? 'FULFILLED' : new Date(obl.due) < new Date() ? 'OVERDUE' : 'OPEN',
        lastSyncedAt: new Date(),
      },
      update: {
        status: obl.status === 'F' ? 'FULFILLED' : new Date(obl.due) < new Date() ? 'OVERDUE' : 'OPEN',
        lastSyncedAt: new Date(),
      },
    })
  }

  await prisma.hmrcConnection.update({
    where: { organizationId },
    data: { lastSyncAt: new Date() },
  })

  return data.obligations
}

export async function submitVatReturn(
  organizationId: string,
  vrn: string,
  payload: VatReturnPayload,
  userId = 'system'
): Promise<{ formBundleNumber: string; processingDate: string }> {
  const res = await hmrcFetch(
    organizationId,
    `/organisations/vat/${vrn}/returns`,
    { method: 'POST', body: JSON.stringify(payload), userId }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HMRC submitVatReturn failed: ${res.status} ${body}`)
  }

  const result = await res.json()

  await prisma.vatPeriod.updateMany({
    where: { organizationId, periodKey: payload.periodKey },
    data: {
      status: 'FULFILLED',
      hmrcReceiptId: result.formBundleNumber,
      submittedAt: new Date(),
    },
  })

  return result
}
