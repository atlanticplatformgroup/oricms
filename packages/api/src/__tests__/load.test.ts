/**
 * API Load Tests
 *
 * Basic load testing for critical API endpoints
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../auth/routes';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

describe('API Load Tests', () => {
  const CONCURRENT_REQUESTS = 10;
  const TOTAL_REQUESTS = 50;

  beforeAll(async () => {
    // Create test user for load testing
    const hashedPassword = await bcrypt.hash('LoadTest123!', 10);
    await prisma.user.create({
      data: {
        email: 'load-test@example.com',
        name: 'Load Test User',
        password: hashedPassword,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({
      where: { email: 'load-test@example.com' },
    });
  });

  describe('Login Endpoint Load', () => {
    it('should handle concurrent login requests', async () => {
      const requests = Array(CONCURRENT_REQUESTS).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'load-test@example.com',
            password: 'LoadTest123!',
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All requests should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(CONCURRENT_REQUESTS);

      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);

      console.log(`Concurrent logins: ${CONCURRENT_REQUESTS} requests in ${duration}ms`);
    });

    it('should handle sequential login requests', async () => {
      const results = [];
      const startTime = Date.now();

      for (let i = 0; i < TOTAL_REQUESTS; i++) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'load-test@example.com',
            password: 'LoadTest123!',
          });
        
        results.push(response.status);
      }

      const duration = Date.now() - startTime;
      const successCount = results.filter(s => s === 200).length;

      expect(successCount).toBe(TOTAL_REQUESTS);
      expect(duration).toBeLessThan(30000); // 30 seconds

      const avgResponseTime = duration / TOTAL_REQUESTS;
      console.log(`Sequential logins: ${TOTAL_REQUESTS} requests in ${duration}ms (avg: ${avgResponseTime.toFixed(2)}ms)`);
    });
  });

  describe('Registration Endpoint Load', () => {
    it('should handle registration rate limiting', async () => {
      const requests = Array(20).fill(null).map((_, i) =>
        request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `rate-limit-test-${Date.now()}-${i}@example.com`,
            name: 'Rate Limit Test',
            password: 'Password123!',
          })
      );

      const responses = await Promise.all(requests);
      
      // Most should succeed, some might be rate limited
      const successCount = responses.filter(r => r.status === 201).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount + rateLimitedCount).toBe(20);
      
      console.log(`Registrations: ${successCount} successful, ${rateLimitedCount} rate limited`);
    });
  });
});
