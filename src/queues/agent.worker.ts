import { Worker, Job } from 'bullmq';
import { env } from '../config/env';
import { AGENT_JOB_QUEUE_NAME } from '../config/constants';
import { AgentJobPayload } from './agent.queue';
import { AgentGraphBuilder } from '../modules/agent/agent.graph';
import { prisma } from '../db/prisma';
import { logger } from '../config/logger';
import { AgentRunStatus } from '@prisma/client';

export function createAgentWorker(): Worker<AgentJobPayload> {
  const worker = new Worker<AgentJobPayload>(
    AGENT_JOB_QUEUE_NAME,
    async (job: Job<AgentJobPayload>) => {
      const { runId, ticketId, userId, orderNumber } = job.data;
      logger.info({ runId, ticketId }, 'Worker picked up agent run job');

      try {
        const graph = AgentGraphBuilder.createGraph();
        await graph.invoke({
          runId,
          ticketId,
          userId,
          orderNumber,
        });

        logger.info({ runId }, 'Agent run job completed successfully');
      } catch (error) {
        logger.error({ error, runId }, 'Agent run execution failed');

        // Dead-letter handling: mark AgentRun as FAILED in database
        await prisma.agentRun.update({
          where: { id: runId },
          data: {
            status: AgentRunStatus.FAILED,
            finalMessage: (error as Error).message,
            finishedAt: new Date(),
          },
        });

        throw error;
      }
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Agent worker job failed permanently');
  });

  return worker;
}
