import { z } from 'zod';
import { ToolContext, ToolResult } from './types';
import { logger } from '../../../config/logger';

export const sendNotificationSchema = z.object({
  userId: z.string().describe('Target recipient customer user ID'),
  channel: z.enum(['EMAIL', 'SMS']).describe('Preferred customer notification channel'),
  message: z.string().min(5).describe('Status update or notification text sent to customer'),
});

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;

export async function executeSendNotification(
  input: SendNotificationInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = sendNotificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }

  // Cross-user safety check
  if (parsed.data.userId !== context.userId) {
    return {
      success: false,
      error: 'Security violation: Cannot send notification to a different user',
    };
  }

  logger.info(
    { userId: parsed.data.userId, channel: parsed.data.channel, message: parsed.data.message },
    'Dispatched customer notification',
  );

  return {
    success: true,
    data: {
      sent: true,
      channel: parsed.data.channel,
      userId: parsed.data.userId,
      timestamp: new Date().toISOString(),
    },
  };
}
