import { z } from 'zod';
import { ordersRepository } from '../../orders/orders.repository';
import { ToolContext, ToolResult } from './types';

export const checkWarrantyStatusSchema = z.object({
  orderNumber: z.string().describe('The order number to check warranty status for'),
});

export type CheckWarrantyStatusInput = z.infer<typeof checkWarrantyStatusSchema>;

export async function executeCheckWarrantyStatus(
  input: CheckWarrantyStatusInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = checkWarrantyStatusSchema.safeParse(input);
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

  // Warranty applies from delivery date or order date
  const startDate = order.deliveredAt || order.orderedAt;
  const maxWarrantyMonths = Math.max(...order.items.map((i) => i.product.warrantyMonths));

  const expiresOn = new Date(startDate);
  expiresOn.setMonth(expiresOn.getMonth() + maxWarrantyMonths);

  const now = new Date();
  const inWarranty = now <= expiresOn;

  return {
    success: true,
    data: {
      inWarranty,
      warrantyMonths: maxWarrantyMonths,
      startDate: startDate.toISOString(),
      expiresOn: expiresOn.toISOString(),
      reason: inWarranty
        ? `Order is under valid warranty until ${expiresOn.toLocaleDateString()}`
        : `Order warranty expired on ${expiresOn.toLocaleDateString()}`,
    },
  };
}
