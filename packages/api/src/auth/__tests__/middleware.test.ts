import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticate, optionalAuth, generateTokens } from '../middleware';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.get('/api/protected', authenticate, (req, res) => {
    res.json({ success: true, user: req.user });
  });
  app.get('/api/optional', optionalAuth, (req, res) => {
    res.json({ success: true, user: req.user || null });
  });
  return app;
}

describe('Auth Middleware', () => {
  let testUser: { id: string; email: string; name: string };

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    testUser = await prisma.user.create({
      data: {
        email: 'auth-test@example.com',
        name: 'Auth Test User',
        password: 'hash',
      },
    });
  });

  it('should allow requests with valid token', async () => {
    const app = createTestApp();
    const accessToken = generateTokens(testUser.id, testUser.email).accessToken;

    const response = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.id).toBe(testUser.id);
  });

  it('should reject requests without token', async () => {
    const app = createTestApp();
    const response = await request(app).get('/api/protected');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject requests with malformed token', async () => {
    const app = createTestApp();
    const response = await request(app)
      .get('/api/protected')
      .set('Authorization', 'Bearer not-a-valid-jwt');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('should reject expired tokens', async () => {
    const app = createTestApp();
    const expiredToken = jwt.sign(
      { userId: testUser.id, email: testUser.email, type: 'access' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '-1s' }
    );

    const response = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('should reject tokens for non-existent users', async () => {
    const app = createTestApp();
    const accessToken = generateTokens('non-existent-user-id', 'ghost@example.com').accessToken;

    const response = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('should reject refresh tokens used as access tokens', async () => {
    const app = createTestApp();
    const refreshToken = generateTokens(testUser.id, testUser.email).refreshToken;

    const response = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${refreshToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('should allow optional auth without token', async () => {
    const app = createTestApp();
    const response = await request(app).get('/api/optional');

    expect(response.status).toBe(200);
    expect(response.body.user).toBeNull();
  });

  it('should attach user in optional auth when token is valid', async () => {
    const app = createTestApp();
    const accessToken = generateTokens(testUser.id, testUser.email).accessToken;

    const response = await request(app)
      .get('/api/optional')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(testUser.id);
  });
});
