// Central constants to avoid magic strings and enforce consistent business rules

export const USER_ROLES = {
  CUSTOMER: 'CUSTOMER',
  AGENT: 'AGENT',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ORDER_STATUS = {
  PLACED: 'PLACED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
  REFUNDED: 'REFUNDED',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  ESCALATED: 'ESCALATED',
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

export const AGENT_RUN_STATUS = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  NEEDS_HUMAN: 'NEEDS_HUMAN',
} as const;

export type AgentRunStatus = (typeof AGENT_RUN_STATUS)[keyof typeof AGENT_RUN_STATUS];

export const AGENT_DECISION = {
  REFUND: 'REFUND',
  REPLACEMENT: 'REPLACEMENT',
  REJECT: 'REJECT',
  ESCALATE: 'ESCALATE',
} as const;

export type AgentDecision = (typeof AGENT_DECISION)[keyof typeof AGENT_DECISION];

export const AGENT_STEP_TYPE = {
  LLM_THOUGHT: 'LLM_THOUGHT',
  TOOL_CALL: 'TOOL_CALL',
  TOOL_RESULT: 'TOOL_RESULT',
  GUARDRAIL: 'GUARDRAIL',
  FINAL: 'FINAL',
} as const;

export type AgentStepType = (typeof AGENT_STEP_TYPE)[keyof typeof AGENT_STEP_TYPE];

export const PROMPT_VERSION = 'v1.0.0';
export const AGENT_JOB_QUEUE_NAME = 'agent-support-queue';
