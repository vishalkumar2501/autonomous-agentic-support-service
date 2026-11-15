import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

describe('Health and Liveness Endpoints', () => {
  const app = createApp();

  it('GET /health returns 200 and healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'autonomous-agentic-support-service');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/v1/health returns 200 with request id', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('x-request-id');
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('GET /api/v1/non-existent-route returns 404 with structured error', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toHaveProperty('message');
    expect(res.body.error).toHaveProperty('statusCode', 404);
    expect(res.body.error).toHaveProperty('requestId');
  });
});
