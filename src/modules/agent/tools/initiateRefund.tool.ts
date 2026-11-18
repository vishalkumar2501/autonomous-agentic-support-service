import { z } from 'zod';
import { prisma } from '../../../db/prisma';
import { ordersRepository } from '../../orders/orders.repository';
import { ToolContext, ToolResult } from './types';
import { OrderStatus } from '@prisma/client';

export const initiateRefundSchema = z.object({
  orderNumber: z.string().describe('The order number to process refund for'),
  amount: z.number().positive().describe('The refund amount in rupees'),
  reason: z.string().min(3).describe('The business or defect reason for issuing refund'),
});

export type InitiateRefundInput = z.infer<typeof initiateRefundSchema>;

export async function executeInitiateRefund(
  input: InitiateRefundInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = initiateRefundSchema.safeParse(input);
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

  // 2. Idempotency Check: if refund already exists for this run and order, return existing record
  const existingRefund = await prisma.refund.findFirst({
    where: {
      orderId: order.id,
      runId: context.runId,
    },
  });

  if (existingRefund) {
    return {
      success: true,
      data: {
        refundId: existingRefund.id,
        orderNumber: order.orderNumber,
        amount: Number(existingRefund.amount),
        status: existingRefund.status,
        idempotent: true,
        message: 'Refund previously created in this run, returning existing record',
      },
    };
  }

  // 3. Prevent refund if already refunded in a previous run/order lifecycle
  if (order.status === OrderStatus.REFUNDED) {
    return {
      success: false,
      error: `Order '${parsed.data.orderNumber}' is already marked as REFUNDED`,
    };
  }

  // 4. Create refund record & update order status inside a transaction
  const [createdRefund] = await prisma.$transaction([
    prisma.refund.create({
      data: {
        orderId: order.id,
        runId: context.runId,
        amount: parsed.data.amount,
        reason: parsed.data.reason,
        status: 'COMPLETED',
      },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.REFUNDED },
    }),
  ]);

  return {
    success: true,
    data: {
      refundId: createdRefund.id,
      orderNumber: order.orderNumber,
      amount: Number(createdRefund.amount),
      status: createdRefund.status,
      idempotent: false,
    },
  };
}
