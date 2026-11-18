import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { AgentDecision } from '../../config/constants';
import { z } from 'zod';

export const AgentDecisionSchema = z.object({
  decision: z.enum(['REFUND', 'REPLACEMENT', 'REJECT', 'ESCALATE']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  customerMessage: z.string(),
  actionsTaken: z.array(z.string()),
});

export type AgentDecisionOutput = z.infer<typeof AgentDecisionSchema>;

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  runId: Annotation<string>(),
  ticketId: Annotation<string>(),
  userId: Annotation<string>(),
  orderNumber: Annotation<string | undefined>(),
  iterations: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  executedTools: Annotation<string[]>({
    reducer: (prev, next) => Array.from(new Set([...prev, ...next])),
    default: () => [],
  }),
  refundCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  decision: Annotation<AgentDecision | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  finalResult: Annotation<AgentDecisionOutput | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  forceEscalate: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  escalationReason: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;
