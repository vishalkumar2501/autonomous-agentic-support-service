import { z } from 'zod';
import { prisma } from '../../../db/prisma';
import { ToolContext, ToolResult } from './types';
import { TicketStatus, EscalationStatus } from '@prisma/client';

export const escalateToHumanSchema = z.object({
  ticketId: z.string().describe('The ticket ID requiring human agent intervention'),
  reason: z.string().min(5).describe('Detailed reason for escalating to a human agent'),
});

export type EscalateToHumanInput = z.infer<typeof escalateToHumanSchema>;

export async function executeEscalateToHuman(
  input: EscalateToHumanInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = escalateToHumanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }

  if (parsed.data.ticketId !== context.ticketId) {
    return {
      success: false,
      error: `Security violation: Mismatched ticket ID. Current ticket is '${context.ticketId}'`,
    };
  }

  // Check if an escalation was already logged in this run
  const existingEscalation = await prisma.escalation.findFirst({
    where: {
      ticketId: context.ticketId,
      runId: context.runId,
    },
  });

  if (existingEscalation) {
    return {
      success: true,
      data: {
        escalationId: existingEscalation.id,
        ticketId: context.ticketId,
        status: existingEscalation.status,
        reason: existingEscalation.reason,
        idempotent: true,
      },
    };
  }

  // Create escalation record & update ticket status inside a transaction
  const [createdEscalation] = await prisma.$transaction([
    prisma.escalation.create({
      data: {
        ticketId: context.ticketId,
        runId: context.runId,
        reason: parsed.data.reason,
        status: EscalationStatus.PENDING,
      },
    }),
    prisma.ticket.update({
      where: { id: context.ticketId },
      data: { status: TicketStatus.ESCALATED },
    }),
  ]);

  return {
    success: true,
    data: {
      escalationId: createdEscalation.id,
      ticketId: context.ticketId,
      status: createdEscalation.status,
      reason: createdEscalation.reason,
      idempotent: false,
    },
  };
}
