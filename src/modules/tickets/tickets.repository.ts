import { prisma } from '../../db/prisma';
import { Ticket, TicketStatus } from '@prisma/client';

export class TicketsRepository {
  async create(data: {
    userId: string;
    orderId?: string | null;
    message: string;
    status?: TicketStatus;
  }): Promise<Ticket> {
    return prisma.ticket.create({
      data: {
        userId: data.userId,
        orderId: data.orderId || null,
        message: data.message,
        status: data.status || TicketStatus.OPEN,
      },
      include: {
        order: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: {
              include: { product: true },
            },
          },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        agentRuns: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            steps: {
              orderBy: { stepNumber: 'asc' },
            },
            refunds: true,
            replacementOrders: true,
            escalations: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string): Promise<Ticket[]> {
    return prisma.ticket.findMany({
      where: { userId },
      include: {
        order: true,
        agentRuns: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: TicketStatus): Promise<Ticket> {
    return prisma.ticket.update({
      where: { id },
      data: { status },
    });
  }
}

export const ticketsRepository = new TicketsRepository();
