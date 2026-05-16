import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { verifyRevalidationWebhookRequest } from '../dist/index.js';

function sign(secret, timestamp, body) {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `sha256=${signature}`;
}

test('verifyRevalidationWebhookRequest validates signed payload', async () => {
  const secret = 'super-secret';
  const body = JSON.stringify({ projectId: 'project-1', branch: 'main' });
  const timestamp = '1772323200';
  const signature = sign(secret, timestamp, body);

  const result = await verifyRevalidationWebhookRequest({
    headers: {
      'x-oricms-revalidation-timestamp': timestamp,
      'x-oricms-revalidation-signature': signature,
    },
    rawBody: body,
    secret,
    nowMs: Number(timestamp) * 1000,
  });

  assert.equal(result.ok, true);
  assert.equal(result.metadata?.authMode, 'signed');
});

test('verifyRevalidationWebhookRequest rejects invalid signature', async () => {
  const result = await verifyRevalidationWebhookRequest({
    headers: {
      'x-oricms-revalidation-timestamp': '1772323200',
      'x-oricms-revalidation-signature': 'sha256=deadbeef',
    },
    rawBody: '{"projectId":"project-1"}',
    secret: 'super-secret',
    nowMs: 1772323200 * 1000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_SIGNATURE');
  assert.equal(result.status, 401);
});

test('verifyRevalidationWebhookRequest supports legacy header fallback', async () => {
  const result = await verifyRevalidationWebhookRequest({
    headers: {
      'x-oricms-revalidation-secret': 'legacy-secret',
    },
    rawBody: '{}',
    secret: 'legacy-secret',
    allowLegacySecretHeader: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.metadata?.authMode, 'legacy-secret-header');
});
