import { escalationsRepository, EscalationsRepository } from './escalations.repository';
import { GetEscalationsQuery, ResolveEscalationInput } from './escalations.schema';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import { EscalationStatus } from '@prisma/client';

export class EscalationsService {
  constructor(private readonly repo: EscalationsRepository = escalationsRepository) {}

  // WHY: Support human supervisors and support agents in querying pending and past escalation queues.
  async listEscalations(query: GetEscalationsQuery) {
    const skip = (query.page - 1) * query.limit;
    const { items, total } = await this.repo.findEscalations({
      status: query.status,
      skip,
      take: query.limit,
    });

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  // WHY: Allow human customer support agents to resolve escalated cases and close tickets.
  async resolveEscalation(id: string, agentId: string, input: ResolveEscalationInput) {
    const escalation = await this.repo.findById(id);
    if (!escalation) {
      throw ApiError.notFound('Escalation not found');
    }

    if (escalation.status === EscalationStatus.RESOLVED) {
      throw ApiError.badRequest('This escalation has already been resolved');
    }

    const resolved = await this.repo.resolve(id, agentId, escalation.ticketId);

    logger.info(
      {
        escalationId: id,
        agentId,
        ticketId: escalation.ticketId,
        decision: input.decision,
        resolution: input.resolution,
      },
      'Human support agent resolved ticket escalation',
    );

    return resolved;
  }
}

export const escalationsService = new EscalationsService();
