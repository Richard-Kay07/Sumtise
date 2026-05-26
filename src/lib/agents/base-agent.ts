import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient } from './client'
import { prisma } from '@/lib/prisma'
import type { AgentRunResult, AgentContext, ProposedAction } from './types'

export abstract class BaseAgent {
  abstract readonly agentType: string
  abstract readonly systemPrompt: string
  abstract readonly tools: Anthropic.Tool[]

  protected abstract executeToolCall(
    toolName: string,
    toolInput: Record<string, unknown>,
    ctx: AgentContext
  ): Promise<unknown>

  async run(
    userMessage: string,
    ctx: AgentContext,
    maxTurns = 8
  ): Promise<AgentRunResult> {
    const startedAt = new Date()
    const client = getAnthropicClient()

    const action = await prisma.agentAction.create({
      data: {
        organizationId: ctx.organizationId,
        agentType: this.agentType as any,
        triggeredBy: ctx.triggeredBy,
        jobId: ctx.jobId,
        status: 'RUNNING',
        inputSummary: userMessage.slice(0, 500),
        startedAt,
      },
    })

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userMessage },
    ]

    let totalTokens = 0
    let toolCallCount = 0
    const proposedActions: ProposedAction[] = []

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        const response = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: this.systemPrompt,
          tools: this.tools,
          messages,
        })

        totalTokens += response.usage.input_tokens + response.usage.output_tokens

        if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
          const textBlock = response.content.find(b => b.type === 'text')
          const answer = textBlock?.type === 'text' ? textBlock.text : ''

          await prisma.agentAction.update({
            where: { id: action.id },
            data: {
              status: 'COMPLETED',
              outputSummary: answer.slice(0, 500),
              tokensUsed: totalTokens,
              toolCallCount,
              completedAt: new Date(),
              durationMs: Date.now() - startedAt.getTime(),
              proposedActions: proposedActions as any,
            },
          })

          return {
            agentActionId: action.id,
            answer,
            toolCallCount,
            tokensUsed: totalTokens,
            requiresApproval: false,
            proposedActions,
          }
        }

        messages.push({ role: 'assistant', content: response.content })
        const toolResults: Anthropic.ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue
          toolCallCount++

          const result = await this.executeToolCall(
            block.name,
            block.input as Record<string, unknown>,
            ctx
          )
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }

        messages.push({ role: 'user', content: toolResults })
      }

      throw new Error('Max turns exceeded')
    } catch (err) {
      await prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: 'FAILED',
          error: String(err),
          completedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
        },
      })
      throw err
    }
  }
}
