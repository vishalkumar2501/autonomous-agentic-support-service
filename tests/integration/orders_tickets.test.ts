import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

describe('Orders and Tickets Modules (Phase 4)', () => {
  const app = createApp();

  let customerToken = '';
  let agentToken = '';
  let createdTicketId = '';

  beforeAll(async () => {
    // 1. Login as seeded customer
    const custLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@example.com',
      password: 'Password@123',
    });
    customerToken = custLogin.body.data.accessToken;

    // 2. Login as seeded agent
    const agLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'agent@example.com',
      password: 'Password@123',
    });
    agentToken = agLogin.body.data.accessToken;
  });

  it('GET /api/v1/orders returns customer orders', async () => {
    const res = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/orders/:orderNumber returns detail for own order', async () => {
    const res = await request(app)
      .get('/api/v1/orders/ORD-1001')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderNumber).toBe('ORD-1001');
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/orders/:orderNumber blocks access to another user order (403)', async () => {
    const res = await request(app)
      .get('/api/v1/orders/ORD-1007') // Belonging to priya@example.com
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/orders/:orderNumber allows AGENT to view any order', async () => {
    const res = await request(app)
      .get('/api/v1/orders/ORD-1007')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderNumber).toBe('ORD-1007');
  });

  it('POST /api/v1/tickets creates complaint for customer order', async () => {
    const res = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderNumber: 'ORD-1001',
        message: 'My wireless earbuds arrived with the left earbud not working properly.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('OPEN');

    createdTicketId = res.body.data.id;
  });

  it('POST /api/v1/tickets rejects ticket creation for another user order (403)', async () => {
    const res = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderNumber: 'ORD-1007', // Not customer's order
        message: 'Trying to complain about someone else order.',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/tickets/:id returns ticket details', async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${createdTicketId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdTicketId);
    expect(res.body.data.order.orderNumber).toBe('ORD-1001');
  });
});
