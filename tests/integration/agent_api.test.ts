import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';

describe('Agent API Endpoints & SSE Streaming (Phase 8)', () => {
  const app = createApp();

  let customerToken = '';
  let customerTicketId = '';
  let otherCustomerTicketId = '';
  let createdRunId = '';

  beforeAll(async () => {
    // 1. Login customer
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@example.com',
      password: 'Password@123',
    });
    customerToken = loginRes.body.data.accessToken;

    // 2. Create customer ticket
    const ticket = await prisma.ticket.create({
      data: {
        userId: 'usr-customer-001',
        message: 'Agent API verification ticket',
      },
    });
    customerTicketId = ticket.id;

    // 3. Create other customer ticket
    const otherTicket = await prisma.ticket.create({
      data: {
        userId: 'usr-customer-002',
        message: 'Other customer ticket',
      },
    });
    otherCustomerTicketId = otherTicket.id;
  });

  it('POST /api/v1/agent/runs returns 202 Accepted and starts run', async () => {
    const res = await request(app)
      .post('/api/v1/agent/runs')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        ticketId: customerTicketId,
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('runId');
    expect(res.body.data.status).toBe('QUEUED');

    createdRunId = res.body.data.runId;
  });

  it('POST /api/v1/agent/runs returns idempotent response for duplicate key', async () => {
    const key = `idemp-api-test-${Date.now()}`;

    const res1 = await request(app)
      .post('/api/v1/agent/runs')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', key)
      .send({
        ticketId: customerTicketId,
      });

    expect(res1.status).toBe(202);
    expect(res1.body.data.idempotent).toBe(false);

    const res2 = await request(app)
      .post('/api/v1/agent/runs')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', key)
      .send({
        ticketId: customerTicketId,
      });

    expect(res2.status).toBe(202);
    expect(res2.body.data.idempotent).toBe(true);
    expect(res2.body.data.runId).toBe(res1.body.data.runId);
  });

  it('POST /api/v1/agent/runs denies running agent for another user ticket (403)', async () => {
    const res = await request(app)
      .post('/api/v1/agent/runs')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        ticketId: otherCustomerTicketId,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/agent/runs/:id returns run details', async () => {
    const res = await request(app)
      .get(`/api/v1/agent/runs/${createdRunId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdRunId);
  });

  it('GET /api/v1/agent/runs/:id/steps returns step audit trail', async () => {
    // Create a mock step in DB for this run
    await prisma.agentStep.create({
      data: {
        runId: createdRunId,
        stepNumber: 1,
        type: 'LLM_THOUGHT',
        output: { thought: 'Initial investigation' },
      },
    });

    const res = await request(app)
      .get(`/api/v1/agent/runs/${createdRunId}/steps`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/agent/runs/:id/stream initializes SSE connection', async () => {
    // Mark run as COMPLETED so the stream terminates cleanly after delivering events
    await prisma.agentRun.update({
      where: { id: createdRunId },
      data: {
        status: 'COMPLETED',
        decision: 'REFUND',
        finalMessage: 'Refund initiated successfully',
      },
    });

    const res = await request(app)
      .get(`/api/v1/agent/runs/${createdRunId}/stream`)
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Accept', 'text/event-stream');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: connected');
    expect(res.text).toContain('event: complete');
  });
});
