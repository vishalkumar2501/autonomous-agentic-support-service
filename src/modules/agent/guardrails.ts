import { env } from '../../config/env';

export interface GuardrailResult {
  passed: boolean;
  blockedAction?: string;
  reason?: string;
  forceEscalate?: boolean;
}

export interface GuardrailStateContext {
  userId: string;
  ticketId: string;
  runId: string;
  executedTools: string[];
  refundCount: number;
}

// Known adversarial prompt injection heuristics
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /system\s+prompt/i,
  /override\s+(all\s+)?(guardrails|safety|rules)/i,
  /act\s+as\s+(a\s+)?(dan|jailbreak|unrestricted)/i,
  /bypass\s+(verification|approval|checks)/i,
  /grant\s+(me\s+)?(full\s+)?admin/i,
  /instant\s+refund\s+without\s+(checking|verification)/i,
];

export class Guardrails {
  /**
   * 1. Detect prompt injection patterns in incoming ticket complaint message
   */
  static checkPromptInjection(message: string): GuardrailResult {
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(message)) {
        return {
          passed: false,
          blockedAction: 'prompt_injection_guardrail',
          reason: 'Security violation: Prompt injection attempt detected in customer message.',
          forceEscalate: true,
        };
      }
    }
    return { passed: true };
  }

  /**
   * 2. Verify order belongs to the active customer (Cross-user protection)
   */
  static checkOrderOwnership(
    orderUserId: string,
    ticketUserId: string,
    orderNumber: string,
  ): GuardrailResult {
    if (orderUserId !== ticketUserId) {
      return {
        passed: false,
        blockedAction: 'cross_user_order_access',
        reason: `Security guardrail blocked: Order '${orderNumber}' belongs to another user.`,
        forceEscalate: true,
      };
    }
    return { passed: true };
  }

  /**
   * 3. Max 1 refund per agent run
   */
  static checkMaxRefundsPerRun(refundCountInRun: number): GuardrailResult {
    if (refundCountInRun >= 1) {
      return {
        passed: false,
        blockedAction: 'initiateRefund',
        reason: 'Guardrail blocked: Maximum 1 refund permitted per agent run.',
      };
    }
    return { passed: true };
  }

  /**
   * 4. Refund amount cannot exceed order total
   */
  static checkRefundAmountLimit(requestedAmount: number, orderTotal: number): GuardrailResult {
    if (requestedAmount > orderTotal) {
      return {
        passed: false,
        blockedAction: 'initiateRefund',
        reason: `Guardrail blocked: Refund amount (₹${requestedAmount}) exceeds total order value (₹${orderTotal}).`,
      };
    }
    return { passed: true };
  }

  /**
   * 5. High-value order/refund threshold check (> ₹20,000)
   */
  static checkHighValueThreshold(
    amount: number,
    threshold: number = env.HIGH_VALUE_THRESHOLD,
  ): GuardrailResult {
    if (amount > threshold) {
      return {
        passed: false,
        blockedAction: 'initiateRefund',
        reason: `Guardrail triggered: High-value transaction (₹${amount} > ₹${threshold}) requires mandatory human agent escalation.`,
        forceEscalate: true,
      };
    }
    return { passed: true };
  }

  /**
   * 6. Prerequisite check: No refund without prior successful checkReturnEligibility
   */
  static checkRefundPrerequisites(executedTools: string[]): GuardrailResult {
    const hasEligibilityCheck = executedTools.includes('checkReturnEligibility');
    if (!hasEligibilityCheck) {
      return {
        passed: false,
        blockedAction: 'initiateRefund',
        reason:
          'Guardrail blocked: Cannot initiate refund without a prior successful checkReturnEligibility step in this run.',
      };
    }
    return { passed: true };
  }

  /**
   * 7. Prerequisite check: No replacement without prior checkWarrantyStatus or checkReturnEligibility
   */
  static checkReplacementPrerequisites(executedTools: string[]): GuardrailResult {
    const hasWarrantyCheck = executedTools.includes('checkWarrantyStatus');
    const hasReturnCheck = executedTools.includes('checkReturnEligibility');

    if (!hasWarrantyCheck && !hasReturnCheck) {
      return {
        passed: false,
        blockedAction: 'createReplacementOrder',
        reason:
          'Guardrail blocked: Cannot create replacement order without prior checkWarrantyStatus or checkReturnEligibility.',
      };
    }
    return { passed: true };
  }

  /**
   * Comprehensive tool call evaluation against all codified guardrails
   */
  static validateToolCall(
    toolName: string,
    toolInput: Record<string, unknown>,
    state: GuardrailStateContext,
    orderInfo?: { userId: string; totalAmount: number; orderNumber: string },
  ): GuardrailResult {
    // Check order ownership if order info is available
    if (orderInfo) {
      const ownershipCheck = this.checkOrderOwnership(
        orderInfo.userId,
        state.userId,
        orderInfo.orderNumber,
      );
      if (!ownershipCheck.passed) return ownershipCheck;
    }

    if (toolName === 'initiateRefund') {
      // 1. Max 1 refund check
      const maxRefundCheck = this.checkMaxRefundsPerRun(state.refundCount);
      if (!maxRefundCheck.passed) return maxRefundCheck;

      // 2. Prerequisite check
      const prereqCheck = this.checkRefundPrerequisites(state.executedTools);
      if (!prereqCheck.passed) return prereqCheck;

      const amount = Number(toolInput.amount ?? 0);

      // 3. High value threshold check
      const highValCheck = this.checkHighValueThreshold(amount);
      if (!highValCheck.passed) return highValCheck;

      // 4. Refund amount vs order total
      if (orderInfo) {
        const limitCheck = this.checkRefundAmountLimit(amount, orderInfo.totalAmount);
        if (!limitCheck.passed) return limitCheck;
      }
    }

    if (toolName === 'createReplacementOrder') {
      const prereqCheck = this.checkReplacementPrerequisites(state.executedTools);
      if (!prereqCheck.passed) return prereqCheck;
    }

    return { passed: true };
  }
}
