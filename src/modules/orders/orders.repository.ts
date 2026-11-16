import { prisma } from '../../db/prisma';
import { Order, OrderItem, Product } from '@prisma/client';

export type OrderWithDetails = Order & {
  items: (OrderItem & { product: Product })[];
};

export class OrdersRepository {
  async findByUserId(userId: string): Promise<OrderWithDetails[]> {
    return prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    });
  }

  async findByOrderNumber(orderNumber: string): Promise<OrderWithDetails | null> {
    return prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async findById(id: string): Promise<OrderWithDetails | null> {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }
}

export const ordersRepository = new OrdersRepository();
