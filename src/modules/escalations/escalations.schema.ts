import { z } from 'zod';
import { EscalationStatus } from '@prisma/client';

export const getEscalationsSchema = z.object({
  query: z.object({
    status: z.nativeEnum(EscalationStatus).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).default({}),
});

export const resolveEscalationSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid escalation ID format'),
  }),
  body: z.object({
    resolution: z.string().min(5, 'Resolution note must be at least 5 characters').max(1000),
    decision: z.enum(['REFUND', 'REPLACEMENT', 'REJECT']).optional(),
  }),
});

export type GetEscalationsQuery = z.infer<typeof getEscalationsSchema>['query'];
export type ResolveEscalationInput = z.infer<typeof resolveEscalationSchema>['body'];
