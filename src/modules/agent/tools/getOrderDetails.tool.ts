import { z } from 'zod';
import { ordersRepository } from '../../orders/orders.repository';
import { ToolContext, ToolResult } from './types';

export const getOrderDetailsSchema = z.object({
  orderNumber: z.string().describe('The alphanumeric order number (e.g. ORD-1001)'),
});

export type GetOrderDetailsInput = z.infer<typeof getOrderDetailsSchema>;

export async function executeGetOrderDetails(
  input: GetOrderDetailsInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = getOrderDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }

  const order = await ordersRepository.findByOrderNumber(parsed.data.orderNumber);
  if (!order) {
    return { success: false, error: `Order '${parsed.data.orderNumber}' was not found in database` };
  }

  // Ownership verification: user can only query their own order
  if (order.userId !== context.userId) {
    return {
      success: false,
      error: `Security violation: Order '${parsed.data.orderNumber}' belongs to a different user`,
    };
  }

  return {
    success: true,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      orderedAt: order.orderedAt.toISOString(),
      deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        warrantyMonths: item.product.warrantyMonths,
        returnWindowDays: item.product.returnWindowDays,
      })),
    },
  };
}
