import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/db/prisma';
import { AgentGraphBuilder } from '../../src/modules/agent/agent.graph';
import { setCustomChatModel } from '../../src/modules/agent/llm.factory';
import { MockChatModel } from '../mocks/mockLLM';

describe('LangGraph Agent State Machine (Phase 7)', () => {
  const customerId = 'usr-customer-001';
  let ticketId = '';
  let runId = '';
  let graphOrderNumber = '';

  beforeAll(async () => {
    graphOrderNumber = `ORD-GRAPH-${Date.now()}`;
    const product = await prisma.product.findFirst();

    // Create dedicated order for graph test so seeded ORD-1001 remains clean
    await prisma.order.create({
      data: {
        orderNumber: graphOrderNumber,
        userId: customerId,
        status: 'DELIVERED',
        totalAmount: 2499.0,
        deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // delivered 2 days ago
        items: product
          ? {
              create: [{ productId: product.id, quantity: 1, unitPrice: product.price }],
            }
          : undefined,
      },
    });

    // 1. Create a ticket in DB
    const ticket = await prisma.ticket.create({
      data: {
        userId: customerId,
        message: `My wireless earbuds (${graphOrderNumber}) arrived broken.`,
      },
    });
    ticketId = ticket.id;

    // 2. Create an AgentRun in DB
    runId = `run-graph-test-${Date.now()}`;
    await prisma.agentRun.create({
      data: {
        id: runId,
        ticketId: ticket.id,
        status: 'QUEUED',
        idempotencyKey: `idemp-graph-${Date.now()}`,
      },
    });
  });

  afterAll(async () => {
    setCustomChatModel(null);
  });

  it('executes LangGraph agentic loop with MockLLM and produces full audit trail', async () => {
    // Script Mock LLM: Turn 1 requests tools, Turn 2 provides final decision
    const mockModel = new MockChatModel([
      {
        toolCalls: [
          {
            name: 'getOrderDetails',
            args: { orderNumber: graphOrderNumber },
          },
          {
            name: 'checkReturnEligibility',
            args: { orderNumber: graphOrderNumber },
          },
        ],
      },
      {
        toolCalls: [
          {
            name: 'initiateRefund',
            args: { orderNumber: graphOrderNumber, amount: 2499.0, reason: 'Defective earbuds inside return window' },
          },
        ],
      },
      {
        content: JSON.stringify({
          decision: 'REFUND',
          confidence: 0.99,
          reasoning: `Order ${graphOrderNumber} is inside the 14-day return window with confirmed defect.`,
          customerMessage: `We have processed your refund of ₹2499.00 for order ${graphOrderNumber}.`,
          actionsTaken: ['checkReturnEligibility', 'initiateRefund'],
        }),
      },
    ]);

    setCustomChatModel(mockModel);

    const graph = AgentGraphBuilder.createGraph();
    const finalState = await graph.invoke({
      runId,
      ticketId,
      userId: customerId,
      orderNumber: graphOrderNumber,
    });

    // 1. Verify final in-memory graph state
    expect(finalState.decision).toBe('REFUND');
    expect(finalState.finalResult).toHaveProperty('confidence', 0.99);
    expect(finalState.finalResult?.actionsTaken).toContain('initiateRefund');

    // 2. Verify AgentRun record in PostgreSQL database
    const runInDb = await prisma.agentRun.findUnique({
      where: { id: runId },
    });
    expect(runInDb?.status).toBe('COMPLETED');
    expect(runInDb?.decision).toBe('REFUND');
    expect(runInDb?.finalMessage).toContain('We have processed your refund');

    // 3. Verify AgentStep records audit trail
    const steps = await prisma.agentStep.findMany({
      where: { runId },
      orderBy: { stepNumber: 'asc' },
    });

    expect(steps.length).toBeGreaterThanOrEqual(4);
    const stepTypes = steps.map((s) => s.type);
    expect(stepTypes).toContain('TOOL_CALL');
    expect(stepTypes).toContain('TOOL_RESULT');
    expect(stepTypes).toContain('FINAL');
  });
});
