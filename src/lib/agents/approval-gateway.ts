import { prisma } from '@/lib/prisma'
import type { WorkflowEntityType } from '@prisma/client'

interface SubmitForApprovalParams {
  organizationId: string
  entityType: WorkflowEntityType
  agentActionId: string
  submittedBy: string
  notes?: string
  deadlineHours?: number
}

/**
 * Creates an ApprovalRequest linked to an AgentAction.
 * Looks up the active WorkflowPolicy for the entity type to determine
 * the approver and deadline.
 */
export async function submitAgentActionForApproval(
  params: SubmitForApprovalParams
): Promise<string> {
  const { organizationId, entityType, agentActionId, submittedBy, notes, deadlineHours } = params

  const policy = await prisma.workflowPolicy.findUnique({
    where: { organizationId_entityType: { organizationId, entityType } },
  })

  const resolvedDeadlineHours = deadlineHours ?? policy?.deadlineHours ?? 48
  const deadline = new Date(Date.now() + resolvedDeadlineHours * 3_600_000)

  const request = await prisma.approvalRequest.create({
    data: {
      organizationId,
      entityType,
      agentActionId,
      submittedBy,
      submittedAt: new Date(),
      assignedTo: policy?.approverUserId ?? null,
      deadline,
      notes: notes ?? null,
    },
  })

  await prisma.agentAction.update({
    where: { id: agentActionId },
    data: { status: 'PENDING_APPROVAL' },
  })

  return request.id
}

/**
 * Checks whether an agent-proposed journal amount exceeds the configured
 * threshold for the AGENT_JOURNAL entity type, requiring approval.
 */
export async function requiresApprovalForAmount(
  organizationId: string,
  amount: number
): Promise<boolean> {
  const policy = await prisma.workflowPolicy.findUnique({
    where: { organizationId_entityType: { organizationId, entityType: 'AGENT_JOURNAL' } },
  })

  if (!policy?.isActive) return false
  if (!policy.amountThreshold) return false

  return amount >= Number(policy.amountThreshold)
}
