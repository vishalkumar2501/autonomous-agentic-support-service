import { z } from 'zod';

export const getOrderParamsSchema = z.object({
  params: z.object({
    orderNumber: z.string().min(1, 'Order number is required'),
  }),
});
