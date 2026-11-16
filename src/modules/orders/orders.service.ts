import { ordersRepository, OrderWithDetails } from './orders.repository';
import { cacheService } from '../../db/redis';
import { ApiError } from '../../utils/ApiError';
import { AuthUser } from '../../types';
import { USER_ROLES } from '../../config/constants';

export class OrdersService {
  async getMyOrders(userId: string): Promise<OrderWithDetails[]> {
    return ordersRepository.findByUserId(userId);
  }

  async getOrderByNumber(orderNumber: string, user: AuthUser): Promise<OrderWithDetails> {
    const cacheKey = `order:${orderNumber}`;

    // 1. Try cache first
    const cached = await cacheService.get<OrderWithDetails>(cacheKey);
    if (cached) {
      if (user.role === USER_ROLES.CUSTOMER && cached.userId !== user.id) {
        throw ApiError.forbidden('You do not have permission to view this order');
      }
      return cached;
    }

    // 2. Query database repository
    const order = await ordersRepository.findByOrderNumber(orderNumber);
    if (!order) {
      throw ApiError.notFound(`Order with number '${orderNumber}' not found`);
    }

    // 3. Ownership enforcement
    if (user.role === USER_ROLES.CUSTOMER && order.userId !== user.id) {
      throw ApiError.forbidden('You do not have permission to view this order');
    }

    // 4. Cache order details for 60 seconds (Section 8 spec)
    await cacheService.set(cacheKey, order, 60);

    return order;
  }
}

export const ordersService = new OrdersService();
