import { z } from 'zod';
import { ordersRepository } from '../../orders/orders.repository';
import { ToolContext, ToolResult } from './types';
import { OrderStatus } from '@prisma/client';

export const checkReturnEligibilitySchema = z.object({
  orderNumber: z.string().describe('The order number to check return window eligibility for'),
});

export type CheckReturnEligibilityInput = z.infer<typeof checkReturnEligibilitySchema>;

export async function executeCheckReturnEligibility(
  input: CheckReturnEligibilityInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = checkReturnEligibilitySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }

  const order = await ordersRepository.findByOrderNumber(parsed.data.orderNumber);
  if (!order) {
    return { success: false, error: `Order '${parsed.data.orderNumber}' not found` };
  }

  if (order.userId !== context.userId) {
    return {
      success: false,
      error: `Security violation: Order '${parsed.data.orderNumber}' does not belong to the user`,
    };
  }

  // If order is not delivered yet, it cannot be returned
  if (order.status !== OrderStatus.DELIVERED || !order.deliveredAt) {
    return {
      success: true,
      data: {
        eligible: false,
        daysLeft: 0,
        reason: `Order is not delivered yet (current status: ${order.status})`,
      },
    };
  }

  // If order is already refunded
  if (order.status === OrderStatus.REFUNDED) {
    return {
      success: true,
      data: {
        eligible: false,
        daysLeft: 0,
        reason: 'Order has already been refunded',
      },
    };
  }

  // Calculate return window based on item returnWindowDays (minimum window among items)
  const windowDays = Math.min(...order.items.map((i) => i.product.returnWindowDays));
  const deliveredTime = order.deliveredAt.getTime();
  const expiryTime = deliveredTime + windowDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const isEligible = now <= expiryTime;
  const msLeft = Math.max(0, expiryTime - now);
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  return {
    success: true,
    data: {
      eligible: isEligible,
      daysLeft: isEligible ? daysLeft : 0,
      windowDays,
      deliveredAt: order.deliveredAt.toISOString(),
      reason: isEligible
        ? `Order is within the ${windowDays}-day return window (${daysLeft} days remaining)`
        : `Order is outside the ${windowDays}-day return window`,
    },
  };
}
