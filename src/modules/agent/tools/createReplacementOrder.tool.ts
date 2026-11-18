import { z } from 'zod';
import { prisma } from '../../../db/prisma';
import { ordersRepository } from '../../orders/orders.repository';
import { ToolContext, ToolResult } from './types';

export const createReplacementOrderSchema = z.object({
  orderNumber: z.string().describe('The original order number to dispatch replacement for'),
  reason: z.string().min(3).describe('Defect description or warranty claim reason'),
});

export type CreateReplacementOrderInput = z.infer<typeof createReplacementOrderSchema>;

export async function executeCreateReplacementOrder(
  input: CreateReplacementOrderInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = createReplacementOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }

  const order = await ordersRepository.findByOrderNumber(parsed.data.orderNumber);
  if (!order) {
    return { success: false, error: `Order '${parsed.data.orderNumber}' not found` };
  }

  // 1. Ownership check
  if (order.userId !== context.userId) {
    return {
      success: false,
      error: `Security violation: Order '${parsed.data.orderNumber}' does not belong to the user`,
    };
  }

  // 2. Idempotency Check: if replacement already dispatched in this run, return existing record
  const existingReplacement = await prisma.replacementOrder.findFirst({
    where: {
      originalOrderId: order.id,
      runId: context.runId,
    },
  });

  if (existingReplacement) {
    return {
      success: true,
      data: {
        replacementId: existingReplacement.id,
        originalOrderId: order.id,
        status: existingReplacement.status,
        idempotent: true,
        message: 'Replacement order already recorded in this run, returning existing record',
      },
    };
  }

  // 3. Create Replacement Order in DB
  const replacement = await prisma.replacementOrder.create({
    data: {
      originalOrderId: order.id,
      runId: context.runId,
      status: 'CREATED',
    },
  });

  return {
    success: true,
    data: {
      replacementId: replacement.id,
      originalOrderId: order.id,
      orderNumber: order.orderNumber,
      status: replacement.status,
      idempotent: false,
    },
  };
}
