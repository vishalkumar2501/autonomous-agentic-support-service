import { DynamicStructuredTool } from '@langchain/core/tools';
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

// Factory creating LangChain DynamicStructuredTools bounded to the active ticket & user context
export function createAgentTools(context: ToolContext) {
  return [
    new DynamicStructuredTool({
      name: 'getOrderDetails',
      description: 'Retrieve order items, dates, payment amounts, and delivery status for an order number.',
      schema: getOrderDetailsSchema,
      func: async (input) => JSON.stringify(await executeGetOrderDetails(input, context)),
    }),

    new DynamicStructuredTool({
      name: 'getCustomerProfile',
      description: 'Retrieve customer account profile, risk tier, and past refund history.',
      schema: getCustomerProfileSchema,
      func: async (input) => JSON.stringify(await executeGetCustomerProfile(input, context)),
    }),

    new DynamicStructuredTool({
      name: 'checkReturnEligibility',
      description: 'Verify if an order is currently within its return window policy.',
      schema: checkReturnEligibilitySchema,
      func: async (input) => JSON.stringify(await executeCheckReturnEligibility(input, context)),
    }),

    new DynamicStructuredTool({
      name: 'checkWarrantyStatus',
      description: 'Verify if an order is covered under active manufacturer warranty.',
      schema: checkWarrantyStatusSchema,
      func: async (input) => JSON.stringify(await executeCheckWarrantyStatus(input, context)),
    }),

    new DynamicStructuredTool({
      name: 'createReturnLabel',
      description: 'Generate a prepaid return shipping pickup label for eligible return items.',
      schema: createReturnLabelSchema,
      func: async (input) => JSON.stringify(await executeCreateReturnLabel(input, context)),
    }),

    new DynamicStructuredTool({
      name: 'initiateRefund',
      description: 'Issue a monetary refund for an eligible defective or returned order.',
      schema: initiateRefundSchema,
      func: async (input) => JSON.stringify(await executeInitiateRefund(input, context)),
    }),

    new DynamicStructuredTool({
      name: 'createReplacementOrder',
      description: 'Dispatch a replacement product for an item covered under warranty.',
      schema: createReplacementOrderSchema,
      func: async (input) => JSON.stringify(await executeCreateReplacementOrder(input, context)),
    }),

    new DynamicStructuredTool({
      name: 'sendNotification',
      description: 'Send an email or SMS notification update to the customer.',
      schema: sendNotificationSchema,
      func: async (input) => JSON.stringify(await executeSendNotification(input, context)),
    }),

    new DynamicStructuredTool({
      name: 'escalateToHuman',
      description: 'Escalate complex complaints, high value items, or ambiguous requests to human agents.',
      schema: escalateToHumanSchema,
      func: async (input) => JSON.stringify(await executeEscalateToHuman(input, context)),
    }),
  ];
}
