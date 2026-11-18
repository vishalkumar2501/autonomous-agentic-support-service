import { z } from 'zod';
import { prisma } from '../../../db/prisma';
import { ToolContext, ToolResult } from './types';

export const getCustomerProfileSchema = z.object({
  userId: z.string().describe('The unique user ID of the customer'),
});

export type GetCustomerProfileInput = z.infer<typeof getCustomerProfileSchema>;

export async function executeGetCustomerProfile(
  input: GetCustomerProfileInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = getCustomerProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }

  // Cross-user access prevention
  if (parsed.data.userId !== context.userId) {
    return {
      success: false,
      error: 'Security violation: Cannot query customer profile of another user',
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    return { success: false, error: `Customer with ID '${parsed.data.userId}' not found` };
  }

  // Count past refunds associated with this user's orders
  const pastRefundCount = await prisma.refund.count({
    where: {
      order: {
        userId: user.id,
      },
    },
  });

  return {
    success: true,
    data: {
      userId: user.id,
      name: user.name,
      email: user.email,
      tier: pastRefundCount > 2 ? 'FLAGGED' : 'STANDARD',
      pastRefundCount,
      memberSince: user.createdAt.toISOString(),
    },
  };
}
