/**
 * Permissions Middleware Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { requirePermission } from '../middleware';
import { authenticate, generateTokens } from '../../auth/middleware';
import { PrismaClient, ProjectRole } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Create a test app
function createTestApp(requiredPermission?: [string, string]) {
  const app = express();
  app.use(express.json());

  // Auth middleware for testing
  app.use('/api', authenticate);

  // Protected routes with different permissions — use :projectId route param
  if (requiredPermission) {
    const [resource, action] = requiredPermission;
    app.get('/api/protected/:projectId', requirePermission(resource as any, action as any), (req, res) => {
      res.json({ success: true, user: req.user });
    });
    // Also add a route without projectId for the "requires projectId" test
    app.get('/api/protected', requirePermission(resource as any, action as any), (req, res) => {
      res.json({ success: true, user: req.user });
    });
  } else {
    app.get('/api/protected', (req, res) => {
      res.json({ success: true, user: req.user });
    });
  }

  return app;
}

describe('Permissions Middleware', () => {
  let testUser: { id: string; email: string; name: string };
  let testProject: { id: string; name: string };
  let accessToken: string;

  beforeEach(async () => {
    // Clean up
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'perms-test@example.com',
        name: 'Test User',
        password: 'hash',
      },
    });

    // Create test project
    testProject = await prisma.project.create({
      data: {
        name: 'Test Project',
        slug: 'test-project',
        repoUrl: 'https://github.com/test/repo',
        repoProvider: 'github',
        defaultBranch: 'main',
      },
    });

    // Generate token
    accessToken = generateTokens(testUser.id, testUser.email).accessToken;
  });

  describe('requireAuth', () => {
    it('should allow requests with valid token', async () => {
      const app = createTestApp();
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject requests without token', async () => {
      const app = createTestApp();
      const response = await request(app).get('/api/protected');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject requests with invalid token', async () => {
      const app = createTestApp();
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('requirePermission', () => {
    it('should allow owner to perform any action', async () => {
      await prisma.projectMember.create({
        data: {
          projectId: testProject.id,
          userId: testUser.id,
          role: 'owner' as ProjectRole,
        },
      });

      const app = createTestApp(['pages', 'delete']);
      const response = await request(app)
        .get(`/api/protected/${testProject.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow admin to manage content', async () => {
      await prisma.projectMember.create({
        data: {
          projectId: testProject.id,
          userId: testUser.id,
          role: 'admin' as ProjectRole,
        },
      });

      const app = createTestApp(['pages', 'update']);
      const response = await request(app)
        .get(`/api/protected/${testProject.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject admin trying to delete project', async () => {
      await prisma.projectMember.create({
        data: {
          projectId: testProject.id,
          userId: testUser.id,
          role: 'admin' as ProjectRole,
        },
      });

      const app = createTestApp(['settings', 'delete']);
      const response = await request(app)
        .get(`/api/protected/${testProject.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });

    it('should allow editor to edit pages', async () => {
      await prisma.projectMember.create({
        data: {
          projectId: testProject.id,
          userId: testUser.id,
          role: 'editor' as ProjectRole,
        },
      });

      const app = createTestApp(['pages', 'update']);
      const response = await request(app)
        .get(`/api/protected/${testProject.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject editor trying to edit schemas', async () => {
      await prisma.projectMember.create({
        data: {
          projectId: testProject.id,
          userId: testUser.id,
          role: 'editor' as ProjectRole,
        },
      });

      const app = createTestApp(['schemas', 'update']);
      const response = await request(app)
        .get(`/api/protected/${testProject.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject viewer trying to edit pages', async () => {
      await prisma.projectMember.create({
        data: {
          projectId: testProject.id,
          userId: testUser.id,
          role: 'viewer' as ProjectRole,
        },
      });

      const app = createTestApp(['pages', 'update']);
      const response = await request(app)
        .get(`/api/protected/${testProject.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject non-member', async () => {
      // Don't add user as member
      const app = createTestApp(['pages', 'read']);
      const response = await request(app)
        .get(`/api/protected/${testProject.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });

    it('should require projectId parameter', async () => {
      const app = createTestApp(['pages', 'read']);
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
    });
  });
});
