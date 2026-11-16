import { z } from 'zod';

export const createTicketSchema = z.object({
  body: z.object({
    orderId: z.string().optional(),
    orderNumber: z.string().optional(),
    message: z.string().min(5, 'Complaint message must be at least 5 characters long'),
  }),
});

export const getTicketParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Ticket ID is required'),
  }),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>['body'];
