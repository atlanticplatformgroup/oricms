import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApiRuntime, type ApiAppRuntime } from '../../app';
import {
  parseTrustProxySetting,
  resolveRateLimitConfig,
} from '../index';

async function createMountedRuntime(): Promise<ApiAppRuntime> {
  return createApiRuntime({
    rateLimit: {
      storeMode: 'memory',
      trustProxy: true,
      policies: {
        authCredentials: {
          limit: 2,
          windowMs: 60 * 1000,
        },
        api: {
          limit: 2,
          windowMs: 120 * 1000,
        },
        agent: {
          limit: 2,
          windowMs: 180 * 1000,
        },
        system: {
          limit: 5,
          windowMs: 60 * 1000,
        },
      },
    },
  });
}

function expectRateLimitHeaders(
  response: request.Response,
  expectedPolicy: string,
): void {
  expect(response.headers.ratelimit).toBeDefined();
  expect(response.headers['ratelimit-policy']).toBe(expectedPolicy);
}

describe('rate limit config', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.RATE_LIMIT_REDIS_URL;
    delete process.env.RATE_LIMIT_STORE;
    delete process.env.TRUST_PROXY;
  });

  it('requires Redis-backed limits in production', () => {
    process.env.NODE_ENV = 'production';

    expect(() => resolveRateLimitConfig()).toThrow(
      'Production API rate limiting requires RATE_LIMIT_REDIS_URL',
    );
  });

  it('parses trust proxy values', () => {
    expect(parseTrustProxySetting(undefined)).toBe(false);
    expect(parseTrustProxySetting('true')).toBe(true);
    expect(parseTrustProxySetting('2')).toBe(2);
    expect(parseTrustProxySetting('loopback, linklocal')).toEqual(['loopback', 'linklocal']);
    expect(parseTrustProxySetting('uniquelocal')).toBe('uniquelocal');
  });
});

describe('rate limit middleware', () => {
  let runtime: ApiAppRuntime | undefined;

  afterEach(async () => {
    await runtime?.shutdown();
    runtime = undefined;
  });

  it('returns stable 429 behavior for auth abuse and keeps auth traffic isolated from system routes', async () => {
    runtime = await createMountedRuntime();

    const firstIp = '203.0.113.10';
    const secondIp = '203.0.113.11';

    const firstAttempt = await request(runtime.app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', firstIp)
      .send({ email: 'author@example.com', password: 'wrong-password' });
    const secondAttempt = await request(runtime.app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', firstIp)
      .send({ email: 'author@example.com', password: 'wrong-password' });
    const limitedAttempt = await request(runtime.app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', firstIp)
      .send({ email: 'author@example.com', password: 'wrong-password' });
    const secondClientAttempt = await request(runtime.app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', secondIp)
      .send({ email: 'author@example.com', password: 'wrong-password' });
    const systemAttempt = await request(runtime.app)
      .get('/api/v1/system/status')
      .set('X-Forwarded-For', firstIp);

    expect(firstAttempt.status).toBe(401);
    expect(secondAttempt.status).toBe(401);
    expect(limitedAttempt.status).toBe(429);
    expect(limitedAttempt.body.error.code).toBe('RATE_LIMITED');
    expect(limitedAttempt.body.error.message).toBe('Too many authentication attempts. Please try again later.');
    expectRateLimitHeaders(limitedAttempt, '2;w=60');
    expect(secondClientAttempt.status).toBe(401);
    expect(systemAttempt.status).toBe(401);
  });

  it('shares the core API budget across mounted project routes and returns the API tier contract', async () => {
    runtime = await createMountedRuntime();

    const clientIp = '203.0.113.25';

    const firstAttempt = await request(runtime.app)
      .get('/api/v1/projects')
      .set('X-Forwarded-For', clientIp);
    const secondAttempt = await request(runtime.app)
      .get('/api/v1/projects/not-a-project-id/git/status')
      .set('X-Forwarded-For', clientIp);
    const limitedAttempt = await request(runtime.app)
      .get('/api/v1/projects')
      .set('X-Forwarded-For', clientIp);
    const authAttempt = await request(runtime.app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', clientIp)
      .send({ email: 'author@example.com', password: 'wrong-password' });

    expect(firstAttempt.status).toBe(401);
    expect(secondAttempt.status).toBe(401);
    expect(limitedAttempt.status).toBe(429);
    expect(limitedAttempt.body.error.code).toBe('RATE_LIMITED');
    expect(limitedAttempt.body.error.message).toBe('Too many API requests. Please slow down and try again shortly.');
    expectRateLimitHeaders(limitedAttempt, '2;w=120');
    expect(authAttempt.status).toBe(401);
  });

  it('applies token-aware throttling on agent routes without collapsing different tokens together', async () => {
    runtime = await createMountedRuntime();

    const sharedIp = '203.0.113.40';

    const firstAttempt = await request(runtime.app)
      .get('/api/v1/agent/v1/status')
      .set('X-Forwarded-For', sharedIp)
      .set('Authorization', 'Bearer invalid-agent-token-a');
    const secondAttempt = await request(runtime.app)
      .get('/api/v1/agent/v1/history')
      .set('X-Forwarded-For', sharedIp)
      .set('Authorization', 'Bearer invalid-agent-token-a');
    const limitedAttempt = await request(runtime.app)
      .get('/api/v1/agent/v1/status')
      .set('X-Forwarded-For', sharedIp)
      .set('Authorization', 'Bearer invalid-agent-token-a');
    const differentTokenAttempt = await request(runtime.app)
      .get('/api/v1/agent/v1/status')
      .set('X-Forwarded-For', sharedIp)
      .set('Authorization', 'Bearer invalid-agent-token-b');

    expect(firstAttempt.status).toBe(401);
    expect(secondAttempt.status).toBe(401);
    expect(limitedAttempt.status).toBe(429);
    expect(limitedAttempt.body.error.code).toBe('RATE_LIMITED');
    expect(limitedAttempt.body.error.message).toBe('Too many agent API requests. Please retry shortly.');
    expectRateLimitHeaders(limitedAttempt, '2;w=180');
    expect(differentTokenAttempt.status).toBe(401);
  });
});
