/**
 * Manual Journals Router
 *
 * Manages draft journal entries with an optional approval workflow.
 * Flow: DRAFT → PENDING_APPROVAL → APPROVED/REJECTED → POSTED
 *
 * If no WorkflowPolicy exists for MANUAL_JOURNAL, submitting a journal
 * posts it immediately. When a policy is active it routes to an approver.
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure } from "@/lib/trpc"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { Prisma } from "@prisma/client"
import { parseJournalCSV } from "@/lib/journal-import/csv-parser"

// ─── Shared validation ────────────────────────────────────────────────────────

const journalLineSchema = z.object({
  accountId: z.string().min(1),
  description: z.string().optional(),
  debit: z.number().min(0),
  credit: z.number().min(0),
  sortOrder: z.number().int().optional(),
})

const journalBodySchema = z.object({
  reference: z.string().min(1, "Reference is required"),
  description: z.string().min(1, "Description is required"),
  date: z.union([z.date(), z.string()]),
  currency: z.string().default("GBP"),
  exchangeRate: z.number().default(1),
  notes: z.string().optional(),
  lines: z.array(journalLineSchema).min(2, "At least 2 lines required"),
})

// ─── Helper: validate balance ────────────────────────────────────────────────

function assertBalanced(lines: { debit: number; credit: number }[]) {
  const totalDebits  = lines.reduce((s, l) => s + l.debit,  0)
  const totalCredits = lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Debits (${totalDebits.toFixed(2)}) must equal credits (${totalCredits.toFixed(2)})`,
    })
  }
  for (const l of lines) {
    if (l.debit > 0 && l.credit > 0)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Each line must have a debit OR a credit, not both" })
    if (l.debit === 0 && l.credit === 0)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Each line must have a non-zero debit or credit" })
  }
}

// ─── Helper: post a ManualJournal → create Transaction rows ──────────────────

async function postJournal(
  journalId: string,
  organizationId: string,
  postedBy: string,
) {
  const journal = await prisma.manualJournal.findFirst({
    where: { id: journalId, organizationId },
    include: { lines: true },
  })
  if (!journal) throw new TRPCError({ code: "NOT_FOUND" })

  const journalDate = typeof journal.date === "string" ? new Date(journal.date) : journal.date

  await prisma.$transaction(async (tx) => {
    // Create one Transaction row per journal line
    await Promise.all(
      journal.lines.map((line) =>
        tx.transaction.create({
          data: {
            organizationId,
            accountId: line.accountId,
            date: journalDate,
            description: journal.description,
            reference: journal.reference,
            debit: line.debit,
            credit: line.credit,
            currency: journal.currency,
            exchangeRate: journal.exchangeRate,
            metadata: {
              source: "manual_journal",
              manualJournalId: journal.id,
              lineDescription: line.description ?? null,
            },
          },
        })
      )
    )

    // Mark journal as POSTED
    await tx.manualJournal.update({
      where: { id: journalId },
      data: { status: "POSTED", postedAt: new Date(), postedBy },
    })
  })
}

// ─── Helper: resolve approver from policy ────────────────────────────────────

async function resolveApprover(organizationId: string): Promise<{
  assignedTo: string | null
  deadline: Date | null
  policy: { deadlineHours: number; reminderHours: number; maxReminders: number; delegateUserId: string | null } | null
}> {
  const policy = await prisma.workflowPolicy.findUnique({
    where: { organizationId_entityType: { organizationId, entityType: "MANUAL_JOURNAL" } },
  })

  if (!policy || !policy.isActive) return { assignedTo: null, deadline: null, policy: null }

  let assignedTo: string | null = policy.approverUserId ?? null

  if (!assignedTo && policy.approverRole) {
    const member = await prisma.organizationMember.findFirst({
      where: { organizationId, role: policy.approverRole as any },
    })
    assignedTo = member?.userId ?? null
  }

  const deadline = policy.deadlineHours
    ? new Date(Date.now() + policy.deadlineHours * 3_600_000)
    : null

  return { assignedTo, deadline, policy }
}

// ─── Helper: send notification ────────────────────────────────────────────────

async function sendNotification(opts: {
  organizationId: string
  userId: string | null
  type: "APPROVAL_REQUIRED" | "APPROVAL_REMINDER" | "APPROVAL_OVERDUE" | "APPROVAL_COMPLETED"
  title: string
  message: string
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  metadata?: Record<string, unknown>
}) {
  if (!opts.userId) return
  await prisma.notification.create({
    data: {
      organizationId: opts.organizationId,
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      priority: opts.priority ?? "HIGH",
      status: "PENDING",
      scheduledFor: new Date(),
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : undefined,
    },
  })
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const manualJournalsRouter = createTRPCRouter({

  // ── Create draft ────────────────────────────────────────────────────────────
  create: orgScopedProcedure
    .input(journalBodySchema.extend({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertBalanced(input.lines)
      const date = typeof input.date === "string" ? new Date(input.date) : input.date

      const journal = await prisma.manualJournal.create({
        data: {
          organizationId: ctx.organizationId,
          reference: input.reference,
          description: input.description,
          date,
          currency: input.currency,
          exchangeRate: new Prisma.Decimal(input.exchangeRate),
          notes: input.notes,
          preparedBy: ctx.userId,
          status: "DRAFT",
          lines: {
            create: input.lines.map((l, i) => ({
              accountId: l.accountId,
              description: l.description,
              debit: new Prisma.Decimal(l.debit),
              credit: new Prisma.Decimal(l.credit),
              sortOrder: l.sortOrder ?? i,
            })),
          },
        },
        include: { lines: { include: { account: true }, orderBy: { sortOrder: "asc" } } },
      })

      await recordAudit({
        entity: "manual_journal",
        entityId: journal.id,
        action: "create",
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        details: `Created draft journal ${journal.reference} with ${journal.lines.length} lines`,
      })

      return journal
    }),

  // ── Update draft ─────────────────────────────────────────────────────────────
  update: orgScopedProcedure
    .input(journalBodySchema.extend({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.manualJournal.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      if (!["DRAFT", "REJECTED"].includes(existing.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only DRAFT or REJECTED journals can be edited" })
      }

      assertBalanced(input.lines)
      const date = typeof input.date === "string" ? new Date(input.date) : input.date

      // Replace lines
      await prisma.manualJournalLine.deleteMany({ where: { manualJournalId: input.id } })

      const journal = await prisma.manualJournal.update({
        where: { id: input.id },
        data: {
          reference: input.reference,
          description: input.description,
          date,
          currency: input.currency,
          exchangeRate: new Prisma.Decimal(input.exchangeRate),
          notes: input.notes,
          lines: {
            create: input.lines.map((l, i) => ({
              accountId: l.accountId,
              description: l.description,
              debit: new Prisma.Decimal(l.debit),
              credit: new Prisma.Decimal(l.credit),
              sortOrder: l.sortOrder ?? i,
            })),
          },
        },
        include: { lines: { include: { account: true }, orderBy: { sortOrder: "asc" } } },
      })

      await recordAudit({
        entity: "manual_journal",
        entityId: journal.id,
        action: "update",
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        details: `Updated draft journal ${journal.reference}`,
      })

      return journal
    }),

  // ── Delete draft ─────────────────────────────────────────────────────────────
  delete: orgScopedProcedure
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.manualJournal.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      if (!["DRAFT", "REJECTED"].includes(existing.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only DRAFT or REJECTED journals can be deleted" })
      }

      await prisma.manualJournal.delete({ where: { id: input.id } })
      return { success: true }
    }),

  // ── Submit for approval (or post directly if no policy) ──────────────────────
  submit: orgScopedProcedure
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const journal = await prisma.manualJournal.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        include: { lines: true },
      })
      if (!journal) throw new TRPCError({ code: "NOT_FOUND" })
      if (!["DRAFT", "REJECTED"].includes(journal.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only DRAFT or REJECTED journals can be submitted" })
      }

      assertBalanced(journal.lines.map((l) => ({
        debit: Number(l.debit),
        credit: Number(l.credit),
      })))

      const { assignedTo, deadline, policy } = await resolveApprover(ctx.organizationId)

      // No active policy → post immediately
      if (!policy) {
        await postJournal(journal.id, ctx.organizationId, ctx.userId)
        await recordAudit({
          entity: "manual_journal",
          entityId: journal.id,
          action: "post",
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          details: `Journal ${journal.reference} posted immediately (no approval policy)`,
        })
        return { posted: true, journalId: journal.id }
      }

      // Delete any prior approval request (re-submit after rejection)
      await prisma.approvalRequest.deleteMany({ where: { manualJournalId: journal.id } })

      const [updatedJournal, approvalRequest] = await prisma.$transaction([
        prisma.manualJournal.update({
          where: { id: journal.id },
          data: { status: "PENDING_APPROVAL", submittedAt: new Date() },
        }),
        prisma.approvalRequest.create({
          data: {
            organizationId: ctx.organizationId,
            entityType: "MANUAL_JOURNAL",
            manualJournalId: journal.id,
            submittedBy: ctx.userId,
            assignedTo,
            deadline,
            status: "PENDING",
            actions: {
              create: [{ actionType: "SUBMITTED", actorId: ctx.userId }],
            },
          },
        }),
      ])

      await sendNotification({
        organizationId: ctx.organizationId,
        userId: assignedTo,
        type: "APPROVAL_REQUIRED",
        title: "Journal Awaiting Your Approval",
        message: `Journal ${journal.reference} — "${journal.description}" has been submitted for your approval.`,
        priority: "HIGH",
        metadata: { approvalRequestId: approvalRequest.id, journalId: journal.id },
      })

      await recordAudit({
        entity: "manual_journal",
        entityId: journal.id,
        action: "submit",
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        details: `Journal ${journal.reference} submitted for approval, assigned to ${assignedTo ?? "unassigned"}`,
      })

      return { posted: false, journalId: journal.id, approvalRequestId: approvalRequest.id }
    }),

  // ── Approve ──────────────────────────────────────────────────────────────────
  approve: orgScopedProcedure
    .input(z.object({ id: z.string(), organizationId: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const journal = await prisma.manualJournal.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        include: { approvalRequest: true },
      })
      if (!journal) throw new TRPCError({ code: "NOT_FOUND" })
      if (journal.status !== "PENDING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Journal is not pending approval" })
      }

      // Update approval request
      if (journal.approvalRequest) {
        await prisma.approvalRequest.update({
          where: { id: journal.approvalRequest.id },
          data: {
            status: "APPROVED",
            completedAt: new Date(),
            completedBy: ctx.userId,
            notes: input.notes,
            actions: {
              create: [{ actionType: "APPROVED", actorId: ctx.userId, notes: input.notes }],
            },
          },
        })
      }

      // Post the journal
      await postJournal(journal.id, ctx.organizationId, ctx.userId)

      // Notify the submitter
      await sendNotification({
        organizationId: ctx.organizationId,
        userId: journal.approvalRequest?.submittedBy ?? null,
        type: "APPROVAL_COMPLETED",
        title: "Journal Approved & Posted",
        message: `Journal ${journal.reference} has been approved and posted to the ledger.`,
        priority: "MEDIUM",
        metadata: { journalId: journal.id },
      })

      await recordAudit({
        entity: "manual_journal",
        entityId: journal.id,
        action: "approve",
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        details: `Journal ${journal.reference} approved and posted`,
      })

      return { success: true }
    }),

  // ── Reject ───────────────────────────────────────────────────────────────────
  reject: orgScopedProcedure
    .input(z.object({ id: z.string(), organizationId: z.string(), reason: z.string().min(1, "Rejection reason required") }))
    .mutation(async ({ ctx, input }) => {
      const journal = await prisma.manualJournal.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        include: { approvalRequest: true },
      })
      if (!journal) throw new TRPCError({ code: "NOT_FOUND" })
      if (journal.status !== "PENDING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Journal is not pending approval" })
      }

      await prisma.$transaction([
        prisma.manualJournal.update({
          where: { id: journal.id },
          data: { status: "REJECTED" },
        }),
        ...(journal.approvalRequest
          ? [prisma.approvalRequest.update({
              where: { id: journal.approvalRequest.id },
              data: {
                status: "REJECTED",
                completedAt: new Date(),
                completedBy: ctx.userId,
                notes: input.reason,
                actions: {
                  create: [{ actionType: "REJECTED", actorId: ctx.userId, notes: input.reason }],
                },
              },
            })]
          : []),
      ])

      // Notify submitter
      await sendNotification({
        organizationId: ctx.organizationId,
        userId: journal.approvalRequest?.submittedBy ?? null,
        type: "APPROVAL_COMPLETED",
        title: "Journal Rejected",
        message: `Journal ${journal.reference} was rejected. Reason: ${input.reason}`,
        priority: "HIGH",
        metadata: { journalId: journal.id, reason: input.reason },
      })

      await recordAudit({
        entity: "manual_journal",
        entityId: journal.id,
        action: "reject",
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        details: `Journal ${journal.reference} rejected: ${input.reason}`,
      })

      return { success: true }
    }),

  // ── Withdraw ─────────────────────────────────────────────────────────────────
  withdraw: orgScopedProcedure
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const journal = await prisma.manualJournal.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        include: { approvalRequest: true },
      })
      if (!journal) throw new TRPCError({ code: "NOT_FOUND" })
      if (journal.status !== "PENDING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending journals can be withdrawn" })
      }

      await prisma.$transaction([
        prisma.manualJournal.update({
          where: { id: journal.id },
          data: { status: "DRAFT", submittedAt: null },
        }),
        ...(journal.approvalRequest
          ? [prisma.approvalRequest.update({
              where: { id: journal.approvalRequest.id },
              data: {
                status: "WITHDRAWN",
                completedAt: new Date(),
                completedBy: ctx.userId,
                actions: {
                  create: [{ actionType: "WITHDRAWN", actorId: ctx.userId }],
                },
              },
            })]
          : []),
      ])

      return { success: true }
    }),

  // ── List ─────────────────────────────────────────────────────────────────────
  list: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(),
      status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "POSTED"]).optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.ManualJournalWhereInput = {
        organizationId: ctx.organizationId,
        ...(input.status ? { status: input.status } : {}),
      }

      const [journals, total] = await Promise.all([
        prisma.manualJournal.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          include: {
            lines: { include: { account: true }, orderBy: { sortOrder: "asc" } },
            approvalRequest: { include: { actions: { orderBy: { createdAt: "asc" } } } },
          },
        }),
        prisma.manualJournal.count({ where }),
      ])

      return { journals, total, page: input.page, limit: input.limit }
    }),

  // ── Get single ───────────────────────────────────────────────────────────────
  get: orgScopedProcedure
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const journal = await prisma.manualJournal.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        include: {
          lines: { include: { account: true }, orderBy: { sortOrder: "asc" } },
          approvalRequest: { include: { actions: { orderBy: { createdAt: "asc" } } } },
        },
      })
      if (!journal) throw new TRPCError({ code: "NOT_FOUND" })
      return journal
    }),

  // ── List approvals assigned to current user ──────────────────────────────────
  myPendingApprovals: orgScopedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const requests = await prisma.approvalRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          assignedTo: ctx.userId,
          status: "PENDING",
        },
        orderBy: { submittedAt: "asc" },
        include: {
          manualJournal: {
            include: { lines: { include: { account: true }, orderBy: { sortOrder: "asc" } } },
          },
          actions: { orderBy: { createdAt: "asc" } },
        },
      })
      return requests
    }),

  // ── All org approvals (admin view) ───────────────────────────────────────────
  allApprovals: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "ESCALATED", "WITHDRAWN"]).optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.ApprovalRequestWhereInput = {
        organizationId: ctx.organizationId,
        ...(input.status ? { status: input.status } : {}),
      }

      const [requests, total] = await Promise.all([
        prisma.approvalRequest.findMany({
          where,
          orderBy: { submittedAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          include: {
            manualJournal: { include: { lines: { include: { account: true }, orderBy: { sortOrder: "asc" } } } },
            agentAction: true,
            actions: { orderBy: { createdAt: "asc" } },
          },
        }),
        prisma.approvalRequest.count({ where }),
      ])

      return { requests, total, page: input.page, limit: input.limit }
    }),

  // ── Preview CSV import ────────────────────────────────────────────────────────
  previewImport: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(),
      csvBase64: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Decode base64
      const csvText = Buffer.from(input.csvBase64, "base64").toString("utf-8")
      const parsed = parseJournalCSV(csvText)

      // Resolve account codes to IDs for the org
      const codes = [...new Set(
        parsed.journals.flatMap((j) => j.lines.map((l) => l.accountCode))
      )]
      const accounts = await prisma.chartOfAccount.findMany({
        where: { organizationId: ctx.organizationId, code: { in: codes } },
        select: { id: true, code: true, name: true, type: true },
      })
      const accountByCode = new Map(accounts.map((a) => [a.code, a]))

      // Enrich groups with resolved accounts; flag missing codes
      const extraErrors: typeof parsed.errors = []
      const preview = parsed.journals.map((group) => ({
        ...group,
        lines: group.lines.map((line, li) => {
          const account = accountByCode.get(line.accountCode)
          if (!account) {
            extraErrors.push({
              row: group.rowNumbers[li] ?? group.rowNumbers[0],
              message: `Account code "${line.accountCode}" not found in chart of accounts`,
            })
          }
          return { ...line, accountId: account?.id ?? null, accountName: account?.name ?? null }
        }),
      }))

      return {
        journals: preview,
        errors: [...parsed.errors, ...extraErrors],
        metadata: parsed.metadata,
      }
    }),

  // ── Import journals from CSV ──────────────────────────────────────────────────
  importJournals: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(),
      csvBase64: z.string().min(1),
      currency: z.string().default("GBP"),
    }))
    .mutation(async ({ ctx, input }) => {
      const csvText = Buffer.from(input.csvBase64, "base64").toString("utf-8")
      const parsed = parseJournalCSV(csvText)

      if (parsed.errors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `CSV has ${parsed.errors.length} error(s). Fix them before importing.`,
        })
      }

      // Resolve all account codes up front
      const codes = [...new Set(
        parsed.journals.flatMap((j) => j.lines.map((l) => l.accountCode))
      )]
      const accounts = await prisma.chartOfAccount.findMany({
        where: { organizationId: ctx.organizationId, code: { in: codes } },
        select: { id: true, code: true },
      })
      const accountByCode = new Map(accounts.map((a) => [a.code, a.id]))

      // Validate all codes resolve before writing anything
      const missing = codes.filter((c) => !accountByCode.has(c))
      if (missing.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown account codes: ${missing.join(", ")}`,
        })
      }

      // Validate all journals balanced and have ≥ 2 lines
      for (const group of parsed.journals) {
        if (!group.isBalanced) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Journal "${group.reference}" is not balanced`,
          })
        }
        if (group.lines.length < 2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Journal "${group.reference}" has fewer than 2 lines`,
          })
        }
      }

      // Create all journals
      const created: string[] = []
      for (const group of parsed.journals) {
        const journal = await prisma.manualJournal.create({
          data: {
            organizationId: ctx.organizationId,
            reference: group.reference,
            description: group.description,
            date: new Date(group.date),
            currency: group.currency,
            exchangeRate: new Prisma.Decimal(1),
            notes: group.notes,
            preparedBy: ctx.userId,
            status: "DRAFT",
            lines: {
              create: group.lines.map((line, i) => ({
                accountId: accountByCode.get(line.accountCode)!,
                description: line.lineDescription,
                debit: new Prisma.Decimal(line.debit),
                credit: new Prisma.Decimal(line.credit),
                sortOrder: i,
              })),
            },
          },
        })
        created.push(journal.id)
      }

      await recordAudit({
        entity: "manual_journal",
        entityId: created[0] ?? "",
        action: "import",
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        details: `Imported ${created.length} journal(s) from CSV`,
      })

      return {
        imported: created.length,
        journalIds: created,
      }
    }),
})
