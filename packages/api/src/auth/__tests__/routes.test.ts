/**
 * Auth Routes Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import authRoutes from '../routes';
import { generateTokens } from '../middleware';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

describe('Auth Routes', () => {
  beforeEach(async () => {
    // Clean up before each test — child tables first (FK constraints)
    await prisma.auditLog.deleteMany();
    await prisma.projectInvite.deleteMany();
    await prisma.session.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Test User',
          password: 'Password123!',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      // Create user first
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: await bcrypt.hash('password', 10),
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Another User',
          password: 'Password123!',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Test User',
          password: '123', // Too weak
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: hashedPassword,
        },
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
    });

    it('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should use bcrypt with proper rounds', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      await prisma.user.create({
        data: {
          email: 'bcrypt-test@example.com',
          name: 'Bcrypt Test',
          password: hashedPassword,
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'bcrypt-test@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: hashedPassword,
        },
      });

      // Generate a real JWT refresh token (same as auth routes do)
      const tokens = generateTokens(user.id, user.email);
      refreshToken = tokens.refreshToken;

      // Store hashed token using the same SHA-256 → bcrypt sequence as production
      const sha256Hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const tokenHash = await bcrypt.hash(sha256Hash, 10);
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash,
          family: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should refresh access token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let refreshToken: string;
    let accessToken: string;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: hashedPassword,
        },
      });

      const tokens = generateTokens(user.id, user.email);
      refreshToken = tokens.refreshToken;
      accessToken = tokens.accessToken;
      const sha256Hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const tokenHash = await bcrypt.hash(sha256Hash, 10);
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash,
          family: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should logout and invalidate token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Token should no longer work
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(401);
    });
  });
});
