import { DynamicStructuredTool, DynamicStructuredToolInput } from '@langchain/core/tools';
import { z } from 'zod';
import { ToolContext } from './types';

// Tool schemas and raw executors
import { getOrderDetailsSchema, executeGetOrderDetails } from './getOrderDetails.tool';
import { getCustomerProfileSchema, executeGetCustomerProfile } from './getCustomerProfile.tool';
import { checkReturnEligibilitySchema, executeCheckReturnEligibility } from './checkReturnEligibility.tool';
import { checkWarrantyStatusSchema, executeCheckWarrantyStatus } from './checkWarrantyStatus.tool';
import { createReturnLabelSchema, executeCreateReturnLabel } from './createReturnLabel.tool';
import { initiateRefundSchema, executeInitiateRefund } from './initiateRefund.tool';
import { createReplacementOrderSchema, executeCreateReplacementOrder } from './createReplacementOrder.tool';
import { sendNotificationSchema, executeSendNotification } from './sendNotification.tool';
import { escalateToHumanSchema, executeEscalateToHuman } from './escalateToHuman.tool';

export * from './types';
export * from './getOrderDetails.tool';
export * from './getCustomerProfile.tool';
export * from './checkReturnEligibility.tool';
export * from './checkWarrantyStatus.tool';
export * from './createReturnLabel.tool';
export * from './initiateRefund.tool';
export * from './createReplacementOrder.tool';
export * from './sendNotification.tool';
export * from './escalateToHuman.tool';

// Helper to construct typed DynamicStructuredTool without combinatorial type explosion
function buildTool<T extends z.ZodTypeAny>(
  name: string,
  description: string,
  schema: T,
  func: (input: z.infer<T>) => Promise<string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name,
    description,
    schema,
    func: async (input: unknown) => func(input as z.infer<T>),
  } as unknown as DynamicStructuredToolInput);
}

// Factory creating LangChain DynamicStructuredTools bounded to the active ticket & user context
export function createAgentTools(context: ToolContext): DynamicStructuredTool[] {
  return [
    buildTool(
      'getOrderDetails',
      'Retrieve order items, dates, payment amounts, and delivery status for an order number.',
      getOrderDetailsSchema,
      async (input) => JSON.stringify(await executeGetOrderDetails(input, context)),
    ),

    buildTool(
      'getCustomerProfile',
      'Retrieve customer account profile, risk tier, and past refund history.',
      getCustomerProfileSchema,
      async (input) => JSON.stringify(await executeGetCustomerProfile(input, context)),
    ),

    buildTool(
      'checkReturnEligibility',
      'Verify if an order is currently within its return window policy.',
      checkReturnEligibilitySchema,
      async (input) => JSON.stringify(await executeCheckReturnEligibility(input, context)),
    ),

    buildTool(
      'checkWarrantyStatus',
      'Verify if an order is covered under active manufacturer warranty.',
      checkWarrantyStatusSchema,
      async (input) => JSON.stringify(await executeCheckWarrantyStatus(input, context)),
    ),

    buildTool(
      'createReturnLabel',
      'Generate a prepaid return shipping pickup label for eligible return items.',
      createReturnLabelSchema,
      async (input) => JSON.stringify(await executeCreateReturnLabel(input, context)),
    ),

    buildTool(
      'initiateRefund',
      'Issue a monetary refund for an eligible defective or returned order.',
      initiateRefundSchema,
      async (input) => JSON.stringify(await executeInitiateRefund(input, context)),
    ),

    buildTool(
      'createReplacementOrder',
      'Dispatch a replacement product for an item covered under warranty.',
      createReplacementOrderSchema,
      async (input) => JSON.stringify(await executeCreateReplacementOrder(input, context)),
    ),

    buildTool(
      'sendNotification',
      'Send an email or SMS notification update to the customer.',
      sendNotificationSchema,
      async (input) => JSON.stringify(await executeSendNotification(input, context)),
    ),

    buildTool(
      'escalateToHuman',
      'Escalate complex complaints, high value items, or ambiguous requests to human agents.',
      escalateToHumanSchema,
      async (input) => JSON.stringify(await executeEscalateToHuman(input, context)),
    ),
  ];
}
