import { prisma } from '../../db/prisma';
import { EscalationStatus, TicketStatus } from '@prisma/client';

export class EscalationsRepository {
  // WHY: Repository centralizes DB queries so business service logic is clean and decoupled from ORM.
  async findEscalations(filter: {
    status?: EscalationStatus;
    skip: number;
    take: number;
  }) {
    const where = filter.status ? { status: filter.status } : {};

    const [items, total] = await Promise.all([
      prisma.escalation.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
        include: {
          ticket: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
              order: true,
            },
          },
          run: {
            select: {
              id: true,
              status: true,
              decision: true,
              finalMessage: true,
            },
          },
          agent: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.escalation.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string) {
    return prisma.escalation.findUnique({
      where: { id },
      include: {
        ticket: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            order: true,
          },
        },
        run: true,
        agent: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async resolve(
    id: string,
    agentId: string,
    ticketId: string,
  ) {
    // WHY: Use a transaction to atomically update escalation status and mark the ticket RESOLVED.
    return prisma.$transaction(async (tx) => {
      const updatedEscalation = await tx.escalation.update({
        where: { id },
        data: {
          status: EscalationStatus.RESOLVED,
          assignedTo: agentId,
        },
        include: {
          ticket: true,
          agent: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.RESOLVED,
        },
      });

      return updatedEscalation;
    });
  }
}

export const escalationsRepository = new EscalationsRepository();
