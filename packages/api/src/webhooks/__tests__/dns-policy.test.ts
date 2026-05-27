import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { lookupMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
}));

vi.mock('node:dns/promises', () => ({
  lookup: lookupMock,
}));

import { __resetWebhookDnsCacheForTests, evaluateWebhookUrlPolicy } from '../security';

describe('webhook dns policy', () => {
  afterEach(() => {
    delete process.env.WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS;
    delete process.env.WEBHOOK_DNS_CACHE_TTL_MS;
    __resetWebhookDnsCacheForTests();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    lookupMock.mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
  });

  it('allows public dns resolution', async () => {
    process.env.WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS = 'true';
    const result = await evaluateWebhookUrlPolicy('https://hooks.example.com/revalidate', 'revalidation');
    expect(result.allowed).toBe(true);
    expect(lookupMock).toHaveBeenCalled();
  });

  it('blocks when dns resolves to private address', async () => {
    process.env.WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS = 'true';
    lookupMock.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);

    const result = await evaluateWebhookUrlPolicy('https://hooks.example.com/revalidate', 'revalidation');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('DNS resolution includes private-network address');
  });

  it('blocks when dns lookup fails', async () => {
    process.env.WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS = 'true';
    lookupMock.mockRejectedValueOnce(new Error('dns unavailable'));

    const result = await evaluateWebhookUrlPolicy('https://hooks.example.com/revalidate', 'revalidation');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('DNS resolution failed for webhook host');
  });

  it('uses dns decision cache within ttl', async () => {
    process.env.WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS = 'true';
    process.env.WEBHOOK_DNS_CACHE_TTL_MS = '120000';

    await evaluateWebhookUrlPolicy('https://hooks.example.com/revalidate', 'revalidation');
    await evaluateWebhookUrlPolicy('https://hooks.example.com/revalidate', 'revalidation');

    expect(lookupMock).toHaveBeenCalledTimes(1);
  });
});

