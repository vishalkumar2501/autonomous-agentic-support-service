import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../../src/app';
import { authenticate } from '../../src/middlewares/auth.middleware';
import { authorize } from '../../src/middlewares/rbac.middleware';
import { errorHandler } from '../../src/middlewares/error.middleware';
import { USER_ROLES } from '../../src/config/constants';

describe('Auth & RBAC Module (Phase 3)', () => {
  const app = createApp();

  // Isolated test app to verify RBAC middleware chain
  const rbacApp = express();
  rbacApp.use(express.json());
  rbacApp.get(
    '/test-agent-only',
    authenticate,
    authorize(USER_ROLES.AGENT, USER_ROLES.ADMIN),
    (req, res) => {
      res.status(200).json({ success: true, user: req.user });
    },
  );
  rbacApp.use(errorHandler);

  const testUser = {
    email: `test_user_${Date.now()}@example.com`,
    password: 'Password@123',
    name: 'Test Customer',
  };

  let customerAccessToken = '';
  let refreshToken = '';

  it('POST /api/v1/auth/register successfully creates a customer', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.user.role).toBe(USER_ROLES.CUSTOMER);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    customerAccessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /api/v1/auth/register fails on duplicate email with 409 Conflict', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login succeeds with valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
  });

  it('POST /api/v1/auth/login fails with invalid password (401)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/refresh succeeds with valid refresh token', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('POST /api/v1/auth/refresh fails with invalid refresh token', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: 'invalid-token',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('RBAC: Agent-only route denies unauthenticated access (401)', async () => {
    const res = await request(rbacApp).get('/test-agent-only');
    expect(res.status).toBe(401);
  });

  it('RBAC: Agent-only route denies CUSTOMER role (403 Forbidden)', async () => {
    const res = await request(rbacApp)
      .get('/test-agent-only')
      .set('Authorization', `Bearer ${customerAccessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('RBAC: Agent-only route allows seeded AGENT login and access (200 OK)', async () => {
    // Login with seeded agent
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'agent@example.com',
      password: 'Password@123',
    });

    expect(loginRes.status).toBe(200);
    const agentToken = loginRes.body.data.accessToken;

    const accessRes = await request(rbacApp)
      .get('/test-agent-only')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(accessRes.status).toBe(200);
    expect(accessRes.body.success).toBe(true);
    expect(accessRes.body.user.role).toBe(USER_ROLES.AGENT);
  });
});
