import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../db/prisma';
import { getAgentQueue } from '../../queues/agent.queue';
import { AgentGraphBuilder } from './agent.graph';
import { ApiError } from '../../utils/ApiError';
import { AuthUser } from '../../types';
import { StartRunInput } from './agent.schema';
import { USER_ROLES } from '../../config/constants';
import { AgentRunStatus } from '@prisma/client';
import { logger } from '../../config/logger';

export class AgentService {
  async startRun(input: StartRunInput, user: AuthUser, headerIdempotencyKey?: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: input.ticketId },
      include: { order: true },
    });

    if (!ticket) {
      throw ApiError.notFound(`Ticket with ID '${input.ticketId}' not found`);
    }

    // Customer can only run agent on their own ticket
    if (user.role === USER_ROLES.CUSTOMER && ticket.userId !== user.id) {
      throw ApiError.forbidden('You can only run the agent for your own tickets');
    }

    const idempotencyKey = input.idempotencyKey || headerIdempotencyKey || uuidv4();

    // Idempotency check: if run already created with this key, return existing run
    const existingRun = await prisma.agentRun.findUnique({
      where: { idempotencyKey },
    });

    if (existingRun) {
      return {
        runId: existingRun.id,
        status: existingRun.status,
        idempotent: true,
      };
    }

    const runId = uuidv4();

    // Create AgentRun in DB with QUEUED status
    const run = await prisma.agentRun.create({
      data: {
        id: runId,
        ticketId: ticket.id,
        status: AgentRunStatus.QUEUED,
        idempotencyKey,
      },
    });

    const queue = getAgentQueue();

    if (queue) {
      // Production: Enqueue background job in BullMQ
      await queue.add(
        'process-agent-run',
        {
          runId: run.id,
          ticketId: ticket.id,
          userId: ticket.userId,
          orderNumber: ticket.order?.orderNumber,
        },
        { jobId: run.id },
      );
    } else {
      // Test environment or fallback: execute asynchronously in-process
      setImmediate(async () => {
        try {
          const graph = AgentGraphBuilder.createGraph();
          await graph.invoke({
            runId: run.id,
            ticketId: ticket.id,
            userId: ticket.userId,
            orderNumber: ticket.order?.orderNumber,
          });
        } catch (err) {
          logger.error({ err, runId: run.id }, 'In-process agent run failed');
        }
      });
    }

    return {
      runId: run.id,
      status: run.status,
      idempotent: false,
    };
  }

  async getRunById(runId: string, user: AuthUser) {
    const run = await prisma.agentRun.findUnique({
      where: { id: runId },
      include: {
        ticket: {
          select: { id: true, userId: true, orderId: true, status: true },
        },
        refunds: true,
        replacementOrders: true,
        escalations: true,
      },
    });

    if (!run) {
      throw ApiError.notFound(`Agent run '${runId}' not found`);
    }

    if (user.role === USER_ROLES.CUSTOMER && run.ticket.userId !== user.id) {
      throw ApiError.forbidden('You do not have permission to view this agent run');
    }

    return run;
  }

  async getRunSteps(runId: string, user: AuthUser) {
    const run = await this.getRunById(runId, user);

    const steps = await prisma.agentStep.findMany({
      where: { runId: run.id },
      orderBy: { stepNumber: 'asc' },
    });

    return steps;
  }

  async streamRun(runId: string, user: AuthUser, req: Request, res: Response) {
    // 1. Authorize access
    await this.getRunById(runId, user);

    // 2. Set Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let lastStepNumber = 0;
    let isFinished = false;

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ runId, message: 'SSE stream connected' })}\n\n`);

    const intervalId = setInterval(async () => {
      try {
        // Fetch new steps
        const steps = await prisma.agentStep.findMany({
          where: {
            runId,
            stepNumber: { gt: lastStepNumber },
          },
          orderBy: { stepNumber: 'asc' },
        });

        for (const step of steps) {
          res.write(`event: step\ndata: ${JSON.stringify(step)}\n\n`);
          lastStepNumber = step.stepNumber;
        }

        // Check if run reached terminal state
        const currentRun = await prisma.agentRun.findUnique({
          where: { id: runId },
          select: { status: true, decision: true, finalMessage: true },
        });

        const terminalStatuses: AgentRunStatus[] = [
          AgentRunStatus.COMPLETED,
          AgentRunStatus.FAILED,
          AgentRunStatus.NEEDS_HUMAN,
        ];
        if (currentRun && terminalStatuses.includes(currentRun.status)) {
          isFinished = true;
          res.write(
            `event: complete\ndata: ${JSON.stringify({
              status: currentRun.status,
              decision: currentRun.decision,
              finalMessage: currentRun.finalMessage,
            })}\n\n`,
          );
          clearInterval(intervalId);
          res.end();
        }
      } catch (err) {
        logger.error({ err, runId }, 'Error polling steps in SSE stream');
      }
    }, 500);

    // Clean up interval if client disconnects
    req.on('close', () => {
      if (!isFinished) {
        clearInterval(intervalId);
      }
    });
  }
}

export const agentService = new AgentService();
