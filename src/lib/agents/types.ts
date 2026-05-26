export interface AgentRunResult {
  agentActionId: string
  answer: string
  toolCallCount: number
  tokensUsed: number
  requiresApproval: boolean
  proposedActions: ProposedAction[]
}

export interface ProposedAction {
  type: 'journal_entry' | 'payment' | 'tax_submission' | 'payroll_run'
  description: string
  data: Record<string, unknown>
  estimatedAmount?: number
}

export interface AgentContext {
  organizationId: string
  triggeredBy: string
  jobId?: string
}
