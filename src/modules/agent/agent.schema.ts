import { z } from 'zod';

export const startRunSchema = z.object({
  body: z.object({
    ticketId: z.string().min(1, 'Ticket ID is required'),
    idempotencyKey: z.string().optional(),
  }),
});

export const getRunParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Run ID is required'),
  }),
});

export type StartRunInput = z.infer<typeof startRunSchema>['body'];
