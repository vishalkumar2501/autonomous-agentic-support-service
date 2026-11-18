import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createApp } from '../../src/app';
import { idempotencyMiddleware } from '../../src/middlewares/idempotency.middleware';
import { ApiError } from '../../src/utils/ApiError';
import { errorHandler } from '../../src/middlewares/error.middleware';

describe('Security, Hardening & Docs (Phase 10)', () => {
  const app = createApp();

  it('GET /docs and /api/v1/docs serve Swagger UI documentation', async () => {
    const res1 = await request(app).get('/docs/');
    expect([200, 301, 302]).toContain(res1.status);

    const res2 = await request(app).get('/api/v1/docs/');
    expect([200, 301, 302]).toContain(res2.status);
  });

  it('sets secure HTTP headers (Helmet)', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('generates and propagates X-Request-Id header', async () => {
    const res1 = await request(app).get('/api/v1/health');
    expect(res1.headers['x-request-id']).toBeDefined();

    const customId = 'test-trace-id-12345';
    const res2 = await request(app)
      .get('/api/v1/health')
      .set('x-request-id', customId);
    expect(res2.headers['x-request-id']).toBe(customId);
  });

  it('idempotency middleware caches and replays duplicate POST operations', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(idempotencyMiddleware);

    let callCount = 0;
    testApp.post('/api/v1/test-idemp', (_req, res) => {
      callCount += 1;
      res.status(201).json({ callCount, result: 'created' });
    });

    const key = `test-key-${Date.now()}`;

    // First call
    const res1 = await request(testApp)
      .post('/api/v1/test-idemp')
      .set('Idempotency-Key', key);
    expect(res1.status).toBe(201);
    expect(res1.body.callCount).toBe(1);

    // Second call with same key
    const res2 = await request(testApp)
      .post('/api/v1/test-idemp')
      .set('Idempotency-Key', key);
    expect(res2.status).toBe(201);
    expect(res2.headers['x-idempotent-replay']).toBe('true');
    expect(res2.headers['x-cache']).toBe('HIT');
    expect(res2.body.callCount).toBe(1); // handler was not executed again
    expect(callCount).toBe(1);
  });

  it('rate limiter triggers 429 when threshold exceeded', async () => {
    const rateApp = express();
    const limiter = rateLimit({
      windowMs: 10000,
      max: 2, // limit to 2 requests
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(ApiError.tooManyRequests('Too many requests'));
      },
    });

    rateApp.use('/limited', limiter, (_req, res) => {
      res.json({ ok: true });
    });
    rateApp.use(errorHandler);

    const r1 = await request(rateApp).get('/limited');
    expect(r1.status).toBe(200);

    const r2 = await request(rateApp).get('/limited');
    expect(r2.status).toBe(200);

    const r3 = await request(rateApp).get('/limited');
    expect(r3.status).toBe(429);
    expect(r3.body.error.message).toContain('Too many requests');
  });

  it('readiness endpoint GET /api/v1/ready returns database health', async () => {
    const res = await request(app).get('/api/v1/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.database).toBe('ok');
  });
});
