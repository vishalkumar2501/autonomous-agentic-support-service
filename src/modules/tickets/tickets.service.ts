import { ticketsRepository } from './tickets.repository';
import { ordersRepository } from '../orders/orders.repository';
import { ApiError } from '../../utils/ApiError';
import { AuthUser } from '../../types';
import { CreateTicketInput } from './tickets.schema';
import { USER_ROLES } from '../../config/constants';

export class TicketsService {
  async createTicket(input: CreateTicketInput, user: AuthUser) {
    let resolvedOrderId: string | null = null;

    if (input.orderNumber) {
      const order = await ordersRepository.findByOrderNumber(input.orderNumber);
      if (!order) {
        throw ApiError.notFound(`Order with number '${input.orderNumber}' not found`);
      }
      if (user.role === USER_ROLES.CUSTOMER && order.userId !== user.id) {
        throw ApiError.forbidden('You can only create complaint tickets for your own orders');
      }
      resolvedOrderId = order.id;
    } else if (input.orderId) {
      const order = await ordersRepository.findById(input.orderId);
      if (!order) {
        throw ApiError.notFound(`Order with ID '${input.orderId}' not found`);
      }
      if (user.role === USER_ROLES.CUSTOMER && order.userId !== user.id) {
        throw ApiError.forbidden('You can only create complaint tickets for your own orders');
      }
      resolvedOrderId = order.id;
    }

    return ticketsRepository.create({
      userId: user.id,
      orderId: resolvedOrderId,
      message: input.message,
    });
  }

  async getTicketById(id: string, user: AuthUser) {
    const ticket = await ticketsRepository.findById(id);
    if (!ticket) {
      throw ApiError.notFound(`Ticket with ID '${id}' not found`);
    }

    if (user.role === USER_ROLES.CUSTOMER && ticket.userId !== user.id) {
      throw ApiError.forbidden('You do not have permission to view this ticket');
    }

    return ticket;
  }

  async getMyTickets(userId: string) {
    return ticketsRepository.findByUserId(userId);
  }
}

export const ticketsService = new TicketsService();
