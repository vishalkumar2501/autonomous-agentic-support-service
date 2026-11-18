import { Queue } from 'bullmq';
import { env } from '../config/env';
import { AGENT_JOB_QUEUE_NAME } from '../config/constants';
import { logger } from '../config/logger';

export interface AgentJobPayload {
  runId: string;
  ticketId: string;
  userId: string;
  orderNumber?: string;
}

// Queue options connecting to Redis
const queueConnection = {
  url: env.REDIS_URL,
};

let agentQueueInstance: Queue<AgentJobPayload> | null = null;

export function getAgentQueue(): Queue<AgentJobPayload> | null {
  if (env.NODE_ENV === 'test') {
    return null; // In test mode, jobs are processed in-process or mocked
  }

  if (!agentQueueInstance) {
    try {
      agentQueueInstance = new Queue<AgentJobPayload>(AGENT_JOB_QUEUE_NAME, {
        connection: queueConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      });
      logger.info('BullMQ agent queue initialized');
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize BullMQ queue, running with direct fallback');
    }
  }

  return agentQueueInstance;
}
