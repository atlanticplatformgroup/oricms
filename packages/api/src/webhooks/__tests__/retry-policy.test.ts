import { afterEach, describe, expect, it } from 'vitest';
import { resolveWebhookRetryPolicy } from '../retry-policy';

describe('resolveWebhookRetryPolicy', () => {
  afterEach(() => {
    delete process.env.WEBHOOK_RETRY_ATTEMPTS;
    delete process.env.WEBHOOK_TIMEOUT_MS;
    delete process.env.WEBHOOK_BACKOFF_MS;
    delete process.env.BUILD_WEBHOOK_RETRY_ATTEMPTS;
    delete process.env.BUILD_WEBHOOK_TIMEOUT_MS;
    delete process.env.BUILD_WEBHOOK_BACKOFF_MS;
    delete process.env.REVALIDATION_WEBHOOK_RETRY_ATTEMPTS;
    delete process.env.REVALIDATION_WEBHOOK_TIMEOUT_MS;
    delete process.env.REVALIDATION_WEBHOOK_BACKOFF_MS;
  });

  it('uses defaults when env vars are missing', () => {
    expect(resolveWebhookRetryPolicy('build')).toEqual({
      attempts: 3,
      timeoutMs: 5000,
      backoffMs: 300,
    });
  });

  it('applies global webhook env vars', () => {
    process.env.WEBHOOK_RETRY_ATTEMPTS = '4';
    process.env.WEBHOOK_TIMEOUT_MS = '9000';
    process.env.WEBHOOK_BACKOFF_MS = '750';

    expect(resolveWebhookRetryPolicy('build')).toEqual({
      attempts: 4,
      timeoutMs: 9000,
      backoffMs: 750,
    });
    expect(resolveWebhookRetryPolicy('revalidation')).toEqual({
      attempts: 4,
      timeoutMs: 9000,
      backoffMs: 750,
    });
  });

  it('prefers kind-specific overrides over global values', () => {
    process.env.WEBHOOK_RETRY_ATTEMPTS = '3';
    process.env.REVALIDATION_WEBHOOK_RETRY_ATTEMPTS = '6';

    expect(resolveWebhookRetryPolicy('build').attempts).toBe(3);
    expect(resolveWebhookRetryPolicy('revalidation').attempts).toBe(6);
  });

  it('clamps out-of-range values', () => {
    process.env.BUILD_WEBHOOK_RETRY_ATTEMPTS = '99';
    process.env.BUILD_WEBHOOK_TIMEOUT_MS = '1';
    process.env.BUILD_WEBHOOK_BACKOFF_MS = '-5';

    expect(resolveWebhookRetryPolicy('build')).toEqual({
      attempts: 10,
      timeoutMs: 250,
      backoffMs: 1,
    });
  });
});
