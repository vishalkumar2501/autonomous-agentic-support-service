import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';

describe('Escalations Module (Phase 9)', () => {
  const app = createApp();

  let customerToken = '';
  let agentToken = '';
  let testEscalationId = '';
  let testTicketId = '';

  beforeAll(async () => {
    // 1. Login customer
    const custRes = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@example.com',
      password: 'Password@123',
    });
    customerToken = custRes.body.data.accessToken;

    // 2. Login agent
    const agentRes = await request(app).post('/api/v1/auth/login').send({
      email: 'agent@example.com',
      password: 'Password@123',
    });
    agentToken = agentRes.body.data.accessToken;

    // 3. Create a test ticket and agent run with an escalation
    const ticket = await prisma.ticket.create({
      data: {
        userId: 'usr-customer-001',
        message: 'High value item damaged escalation test',
        status: 'ESCALATED',
      },
    });
    testTicketId = ticket.id;

    const run = await prisma.agentRun.create({
      data: {
        ticketId: ticket.id,
        status: 'NEEDS_HUMAN',
        decision: 'ESCALATE',
        finalMessage: 'Escalated to human supervisor',
        idempotencyKey: `idemp-esc-${Date.now()}`,
      },
    });

    const escalation = await prisma.escalation.create({
      data: {
        ticketId: ticket.id,
        runId: run.id,
        reason: 'Refund amount exceeds high-value threshold ₹20,000',
        status: 'PENDING',
      },
    });
    testEscalationId = escalation.id;
  });

  it('GET /api/v1/escalations denies access to customers (403)', async () => {
    const res = await request(app)
      .get('/api/v1/escalations')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/escalations allows agents to list pending escalations', async () => {
    const res = await request(app)
      .get('/api/v1/escalations?status=PENDING')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const found = res.body.data.find((e: { id: string }) => e.id === testEscalationId);
    expect(found).toBeDefined();
    expect(found.reason).toContain('Refund amount exceeds high-value threshold');
  });

  it('POST /api/v1/escalations/:id/resolve validates request body', async () => {
    const res = await request(app)
      .post(`/api/v1/escalations/${testEscalationId}/resolve`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        resolution: 'shrt', // Less than 5 characters
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/escalations/:id/resolve resolves escalation and updates ticket', async () => {
    const res = await request(app)
      .post(`/api/v1/escalations/${testEscalationId}/resolve`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        resolution: 'Approved manual replacement order with expedited shipping',
        decision: 'REPLACEMENT',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('RESOLVED');
    expect(res.body.data.assignedTo).toBe('usr-agent-001');

    // Verify database updates
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: testTicketId },
    });
    expect(updatedTicket?.status).toBe('RESOLVED');
  });

  it('POST /api/v1/escalations/:id/resolve rejects resolving already resolved escalation (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/escalations/${testEscalationId}/resolve`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        resolution: 'Attempting duplicate resolution',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('already been resolved');
  });
});
