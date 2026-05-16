import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetWebhookDnsCacheForTests,
  buildSignedRevalidationHeaders,
  isWebhookUrlAllowed,
  resolveRevalidationAuthMode,
} from '../security';

describe('webhooks security', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.WEBHOOK_ALLOWED_HOSTS;
    delete process.env.BUILD_WEBHOOK_ALLOWED_HOSTS;
    delete process.env.REVALIDATION_WEBHOOK_ALLOWED_HOSTS;
    delete process.env.WEBHOOK_ALLOW_INSECURE_HTTP;
    delete process.env.WEBHOOK_BLOCK_PRIVATE_NETWORKS;
    delete process.env.BUILD_WEBHOOK_BLOCK_PRIVATE_NETWORKS;
    delete process.env.REVALIDATION_WEBHOOK_BLOCK_PRIVATE_NETWORKS;
    delete process.env.WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS;
    delete process.env.BUILD_WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS;
    delete process.env.REVALIDATION_WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS;
    delete process.env.WEBHOOK_DNS_CACHE_TTL_MS;
    delete process.env.REVALIDATION_WEBHOOK_AUTH_MODE;
    __resetWebhookDnsCacheForTests();
  });

  it('allows http in non-production by default', () => {
    process.env.NODE_ENV = 'development';
    expect(isWebhookUrlAllowed('http://localhost:3000/hook', 'build')).toBe(true);
  });

  it('blocks insecure http in production unless explicitly allowed', () => {
    process.env.NODE_ENV = 'production';
    expect(isWebhookUrlAllowed('http://hooks.example.com/revalidate', 'revalidation')).toBe(false);
    process.env.WEBHOOK_ALLOW_INSECURE_HTTP = 'true';
    expect(isWebhookUrlAllowed('http://hooks.example.com/revalidate', 'revalidation')).toBe(true);
  });

  it('enforces host allowlist with wildcard support', () => {
    process.env.WEBHOOK_ALLOWED_HOSTS = 'hooks.example.com,*.internal.example.com';
    expect(isWebhookUrlAllowed('https://hooks.example.com/revalidate', 'revalidation')).toBe(true);
    expect(isWebhookUrlAllowed('https://a.internal.example.com/revalidate', 'revalidation')).toBe(true);
    expect(isWebhookUrlAllowed('https://evil.example.org/revalidate', 'revalidation')).toBe(false);
  });

  it('uses specific allowlist over global one', () => {
    process.env.WEBHOOK_ALLOWED_HOSTS = 'hooks.example.com';
    process.env.BUILD_WEBHOOK_ALLOWED_HOSTS = 'build.example.com';
    expect(isWebhookUrlAllowed('https://build.example.com/hook', 'build')).toBe(true);
    expect(isWebhookUrlAllowed('https://hooks.example.com/hook', 'build')).toBe(false);
    expect(isWebhookUrlAllowed('https://hooks.example.com/hook', 'revalidation')).toBe(true);
  });

  it('normalizes revalidation auth mode', () => {
    expect(resolveRevalidationAuthMode()).toBe('signed');
    process.env.REVALIDATION_WEBHOOK_AUTH_MODE = 'legacy-secret-header';
    expect(resolveRevalidationAuthMode()).toBe('legacy-secret-header');
    process.env.REVALIDATION_WEBHOOK_AUTH_MODE = 'signed-with-legacy';
    expect(resolveRevalidationAuthMode()).toBe('signed-with-legacy');
    process.env.REVALIDATION_WEBHOOK_AUTH_MODE = 'none';
    expect(resolveRevalidationAuthMode()).toBe('none');
  });

  it('blocks private-network hosts when enabled', () => {
    process.env.WEBHOOK_BLOCK_PRIVATE_NETWORKS = 'true';
    expect(isWebhookUrlAllowed('https://localhost:3000/hook', 'build')).toBe(false);
    expect(isWebhookUrlAllowed('https://127.0.0.1/hook', 'build')).toBe(false);
    expect(isWebhookUrlAllowed('https://192.168.1.10/hook', 'revalidation')).toBe(false);
    expect(isWebhookUrlAllowed('https://10.1.2.3/hook', 'revalidation')).toBe(false);
    expect(isWebhookUrlAllowed('https://hooks.example.com/hook', 'build')).toBe(true);
  });

  it('supports per-kind private-network override', () => {
    process.env.WEBHOOK_BLOCK_PRIVATE_NETWORKS = 'true';
    process.env.BUILD_WEBHOOK_BLOCK_PRIVATE_NETWORKS = 'false';
    expect(isWebhookUrlAllowed('https://127.0.0.1/hook', 'build')).toBe(true);
    expect(isWebhookUrlAllowed('https://127.0.0.1/hook', 'revalidation')).toBe(false);
  });

  it('builds deterministic signed revalidation headers', () => {
    const headers = buildSignedRevalidationHeaders('secret', { projectId: 'project-1', branch: 'main' });
    expect(headers['x-oricms-revalidation-timestamp']).toBe('1772323200');
    expect(headers['x-oricms-revalidation-signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});
