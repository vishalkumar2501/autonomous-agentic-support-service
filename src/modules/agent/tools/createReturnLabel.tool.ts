import { z } from 'zod';
import { ordersRepository } from '../../orders/orders.repository';
import { ToolContext, ToolResult } from './types';

export const createReturnLabelSchema = z.object({
  orderNumber: z.string().describe('The order number for generating a return shipping label'),
});

export type CreateReturnLabelInput = z.infer<typeof createReturnLabelSchema>;

export async function executeCreateReturnLabel(
  input: CreateReturnLabelInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = createReturnLabelSchema.safeParse(input);
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

  // Generate prepaid return pickup label (estimated pickup in 2 business days)
  const pickupDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const labelId = `RET-LBL-${parsed.data.orderNumber.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-6)}`;

  return {
    success: true,
    data: {
      labelId,
      orderNumber: parsed.data.orderNumber,
      pickupDate,
      carrier: 'Express Logistics Return Service',
      instructions: 'Please securely pack the item in original packaging and hand it to the pickup courier.',
    },
  };
}
