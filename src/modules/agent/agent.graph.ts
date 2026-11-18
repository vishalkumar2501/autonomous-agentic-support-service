import { StateGraph, START, END } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { AgentStateAnnotation, AgentState, AgentDecisionSchema, AgentDecisionOutput } from './agent.state';
import { getSystemPrompt } from './agent.prompts';
import { getChatModel } from './llm.factory';
import { createAgentTools } from './tools';
import { Guardrails, GuardrailStateContext } from './guardrails';
import { prisma } from '../../db/prisma';
import { ordersRepository } from '../orders/orders.repository';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { withRetry } from '../../utils/retry';
import {
  executeGetOrderDetails,
  executeGetCustomerProfile,
  executeCheckReturnEligibility,
  executeCheckWarrantyStatus,
  executeCreateReturnLabel,
  executeInitiateRefund,
  executeCreateReplacementOrder,
  executeSendNotification,
  executeEscalateToHuman,
  ToolContext,
} from './tools';
import { AgentDecision, AgentRunStatus, AgentStepType, TicketStatus, Prisma } from '@prisma/client';

export class AgentGraphBuilder {
  static createGraph() {
    const workflow = new StateGraph(AgentStateAnnotation)
      .addNode('loadContext', this.loadContextNode)
      .addNode('agentNode', this.agentNode)
      .addNode('guardrailCheck', this.guardrailCheckNode)
      .addNode('toolExecutor', this.toolExecutorNode)
      .addNode('finalizeDecision', this.finalizeDecisionNode)

      .addEdge(START, 'loadContext')
      .addConditionalEdges('loadContext', (state: AgentState) => {
        if (state.forceEscalate) return 'finalizeDecision';
        return 'agentNode';
      })
      .addConditionalEdges('agentNode', (state: AgentState) => {
        if (state.forceEscalate) return 'finalizeDecision';

        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
          return 'guardrailCheck';
        }
        return 'finalizeDecision';
      })
      .addConditionalEdges('guardrailCheck', (state: AgentState) => {
        if (state.forceEscalate) return 'finalizeDecision';
        return 'toolExecutor';
      })
      .addEdge('toolExecutor', 'agentNode')
      .addEdge('finalizeDecision', END);

    return workflow.compile();
  }

  // Node 1: loadContext - checks ticket, customer, order, and prompt injection
  private static async loadContextNode(state: AgentState): Promise<Partial<AgentState>> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: state.ticketId },
      include: { order: true, user: true },
    });

    if (!ticket) {
      return {
        forceEscalate: true,
        escalationReason: `Ticket '${state.ticketId}' not found`,
      };
    }

    // Step audit: record run start
    await prisma.agentRun.update({
      where: { id: state.runId },
      data: { status: AgentRunStatus.RUNNING, startedAt: new Date() },
    });

    // 1. Guardrail Check: Prompt Injection in ticket complaint
    const injectionCheck = Guardrails.checkPromptInjection(ticket.message);
    if (!injectionCheck.passed) {
      await prisma.agentStep.create({
        data: {
          runId: state.runId,
          stepNumber: 1,
          type: AgentStepType.GUARDRAIL,
          toolName: 'prompt_injection_guardrail',
          input: { message: ticket.message },
          output: { reason: injectionCheck.reason, forceEscalate: true },
        },
      });

      return {
        forceEscalate: true,
        escalationReason: injectionCheck.reason,
      };
    }

    // Build initial conversation messages
    const initialPrompt = `Customer complaint for investigation:
Ticket ID: ${ticket.id}
User ID: ${ticket.userId}
Customer Name: ${ticket.user.name}
Customer Email: ${ticket.user.email}
Associated Order Number: ${ticket.order ? ticket.order.orderNumber : state.orderNumber || 'None provided'}
Complaint Message: "${ticket.message}"

Please investigate this case, call necessary tools, and arrive at a resolution.`;

    return {
      messages: [new HumanMessage(initialPrompt)],
      userId: ticket.userId,
      orderNumber: ticket.order ? ticket.order.orderNumber : state.orderNumber,
    };
  }

  // Node 2: agentNode - calls LLM model with tool definitions
  private static async agentNode(state: AgentState): Promise<Partial<AgentState>> {
    const nextIteration = (state.iterations || 0) + 1;

    // Guardrail: Enforce max iterations
    if (nextIteration > env.AGENT_MAX_STEPS) {
      logger.warn({ runId: state.runId, iterations: nextIteration }, 'Exceeded max iterations limit');
      return {
        iterations: nextIteration,
        forceEscalate: true,
        escalationReason: `Exceeded maximum agent steps limit (${env.AGENT_MAX_STEPS}). Escalating to human.`,
      };
    }

    const toolContext: ToolContext = {
      userId: state.userId,
      ticketId: state.ticketId,
      runId: state.runId,
    };

    const tools = createAgentTools(toolContext);
    const model = getChatModel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boundModel = (model as any).bindTools ? (model as any).bindTools(tools) : model;

    const messagesToSend: BaseMessage[] = [
      new SystemMessage(getSystemPrompt()),
      ...state.messages,
    ];

    const startTime = Date.now();
    // LLM call with retry and timeout abstraction
    const response = await withRetry(async () => {
      return boundModel.invoke(messagesToSend);
    }, { maxRetries: 2, timeoutMs: 30000 });

    const latencyMs = Date.now() - startTime;

    // Audit step persistence
    const stepCount = await prisma.agentStep.count({ where: { runId: state.runId } });
    const hasToolCalls = response.tool_calls && response.tool_calls.length > 0;

    await prisma.agentStep.create({
      data: {
        runId: state.runId,
        stepNumber: stepCount + 1,
        type: hasToolCalls ? AgentStepType.TOOL_CALL : AgentStepType.LLM_THOUGHT,
        input: { messagesCount: messagesToSend.length },
        output: hasToolCalls ? { toolCalls: response.tool_calls } : { content: response.content },
        latencyMs,
      },
    });

    return {
      iterations: nextIteration,
      messages: [response],
    };
  }

  // Node 3: guardrailCheckNode - intercepts tool calls before execution
  private static async guardrailCheckNode(state: AgentState): Promise<Partial<AgentState>> {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const toolCalls = lastMessage.tool_calls || [];

    const guardrailContext: GuardrailStateContext = {
      userId: state.userId,
      ticketId: state.ticketId,
      runId: state.runId,
      executedTools: state.executedTools,
      refundCount: state.refundCount,
    };

    for (const tc of toolCalls) {
      let orderInfo: { userId: string; totalAmount: number; orderNumber: string } | undefined;
      const orderNum = (tc.args as { orderNumber?: string })?.orderNumber || state.orderNumber;

      if (orderNum) {
        const order = await ordersRepository.findByOrderNumber(orderNum);
        if (order) {
          orderInfo = {
            userId: order.userId,
            totalAmount: Number(order.totalAmount),
            orderNumber: order.orderNumber,
          };
        }
      }

      const check = Guardrails.validateToolCall(tc.name, tc.args, guardrailContext, orderInfo);

      if (!check.passed) {
        const stepCount = await prisma.agentStep.count({ where: { runId: state.runId } });
        await prisma.agentStep.create({
          data: {
            runId: state.runId,
            stepNumber: stepCount + 1,
            type: AgentStepType.GUARDRAIL,
            toolName: tc.name,
            input: tc.args,
            output: { reason: check.reason, forceEscalate: check.forceEscalate },
          },
        });

        if (check.forceEscalate) {
          // Force execute escalation
          const toolContext: ToolContext = {
            userId: state.userId,
            ticketId: state.ticketId,
            runId: state.runId,
          };
          await executeEscalateToHuman(
            { ticketId: state.ticketId, reason: check.reason || 'Guardrail violation' },
            toolContext,
          );

          return {
            forceEscalate: true,
            escalationReason: check.reason,
            messages: [
              new ToolMessage({
                tool_call_id: tc.id || 'blocked_call',
                content: JSON.stringify({
                  success: false,
                  error: check.reason,
                  status: 'ESCALATED_BY_GUARDRAIL',
                }),
              }),
            ],
          };
        }

        // Return block message back to LLM to recover
        return {
          messages: [
            new ToolMessage({
              tool_call_id: tc.id || 'blocked_call',
              content: JSON.stringify({ success: false, error: check.reason }),
            }),
          ],
        };
      }
    }

    return {};
  }

  // Node 4: toolExecutorNode - executes validated tools & logs results
  private static async toolExecutorNode(state: AgentState): Promise<Partial<AgentState>> {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const toolCalls = lastMessage.tool_calls || [];

    const toolContext: ToolContext = {
      userId: state.userId,
      ticketId: state.ticketId,
      runId: state.runId,
    };

    const newMessages: ToolMessage[] = [];
    const newExecutedTools: string[] = [];
    let addedRefund = 0;

    for (const tc of toolCalls) {
      const startTime = Date.now();
      let result: unknown;

      try {
        switch (tc.name) {
          case 'getOrderDetails':
            result = await executeGetOrderDetails(tc.args as { orderNumber: string }, toolContext);
            break;
          case 'getCustomerProfile':
            result = await executeGetCustomerProfile(tc.args as { userId: string }, toolContext);
            break;
          case 'checkReturnEligibility':
            result = await executeCheckReturnEligibility(tc.args as { orderNumber: string }, toolContext);
            break;
          case 'checkWarrantyStatus':
            result = await executeCheckWarrantyStatus(tc.args as { orderNumber: string }, toolContext);
            break;
          case 'createReturnLabel':
            result = await executeCreateReturnLabel(tc.args as { orderNumber: string }, toolContext);
            break;
          case 'initiateRefund':
            result = await executeInitiateRefund(
              tc.args as { orderNumber: string; amount: number; reason: string },
              toolContext,
            );
            if ((result as { success: boolean }).success) addedRefund++;
            break;
          case 'createReplacementOrder':
            result = await executeCreateReplacementOrder(
              tc.args as { orderNumber: string; reason: string },
              toolContext,
            );
            break;
          case 'sendNotification':
            result = await executeSendNotification(
              tc.args as { userId: string; channel: 'EMAIL' | 'SMS'; message: string },
              toolContext,
            );
            break;
          case 'escalateToHuman':
            result = await executeEscalateToHuman(
              tc.args as { ticketId: string; reason: string },
              toolContext,
            );
            break;
          default:
            result = { success: false, error: `Unknown tool '${tc.name}'` };
        }
      } catch (err) {
        result = { success: false, error: (err as Error).message };
      }

      const latencyMs = Date.now() - startTime;
      newExecutedTools.push(tc.name);

      const stepCount = await prisma.agentStep.count({ where: { runId: state.runId } });
      await prisma.agentStep.create({
        data: {
          runId: state.runId,
          stepNumber: stepCount + 1,
          type: AgentStepType.TOOL_RESULT,
          toolName: tc.name,
          input: tc.args,
          output: result as Prisma.InputJsonValue,
          latencyMs,
        },
      });

      newMessages.push(
        new ToolMessage({
          tool_call_id: tc.id || `call_${tc.name}`,
          content: JSON.stringify(result),
        }),
      );
    }

    return {
      messages: newMessages,
      executedTools: [...state.executedTools, ...newExecutedTools],
      refundCount: state.refundCount + addedRefund,
    };
  }

  // Node 5: finalizeDecisionNode - parses structured output & completes AgentRun
  private static async finalizeDecisionNode(state: AgentState): Promise<Partial<AgentState>> {
    let finalDecision: AgentDecisionOutput;

    if (state.forceEscalate) {
      finalDecision = {
        decision: AgentDecision.ESCALATE,
        confidence: 0.9,
        reasoning: state.escalationReason || 'Action flagged by automated compliance guardrails.',
        customerMessage:
          'Your request has been escalated to our senior customer support team for manual review. A representative will contact you shortly.',
        actionsTaken: state.executedTools,
      };
    } else {
      const lastMessage = state.messages[state.messages.length - 1];
      const rawText = lastMessage?.content ? lastMessage.content.toString() : '';

      try {
        // Extract JSON block if surrounded by markdown code blocks
        let jsonStr = rawText.trim();
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonStr = jsonMatch[1];
        }

        const parsedJson = JSON.parse(jsonStr);
        finalDecision = AgentDecisionSchema.parse(parsedJson);
      } catch {
        // Fallback if model output was not strictly valid JSON
        finalDecision = {
          decision: AgentDecision.ESCALATE,
          confidence: 0.5,
          reasoning: 'Model output did not adhere to structured JSON schema. Escalating safely.',
          customerMessage:
            'We are reviewing your request and a support specialist will follow up with you.',
          actionsTaken: state.executedTools,
        };
      }
    }

    // Persist final step audit
    const stepCount = await prisma.agentStep.count({ where: { runId: state.runId } });
    await prisma.agentStep.create({
      data: {
        runId: state.runId,
        stepNumber: stepCount + 1,
        type: AgentStepType.FINAL,
        output: finalDecision as unknown as Prisma.InputJsonValue,
      },
    });

    // Update AgentRun status and decision
    const runStatus =
      finalDecision.decision === AgentDecision.ESCALATE
        ? AgentRunStatus.NEEDS_HUMAN
        : AgentRunStatus.COMPLETED;

    await prisma.agentRun.update({
      where: { id: state.runId },
      data: {
        status: runStatus,
        decision: finalDecision.decision as AgentDecision,
        finalMessage: finalDecision.customerMessage,
        finishedAt: new Date(),
      },
    });

    // Update parent ticket status
    const newTicketStatus =
      finalDecision.decision === AgentDecision.ESCALATE
        ? TicketStatus.ESCALATED
        : TicketStatus.RESOLVED;

    await prisma.ticket.update({
      where: { id: state.ticketId },
      data: { status: newTicketStatus },
    });

    return {
      decision: finalDecision.decision as AgentDecision,
      finalResult: finalDecision,
    };
  }
}
