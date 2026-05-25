import test from 'node:test';
import assert from 'node:assert/strict';

import { createClient, OriCmsClientError } from '../dist/index.js';

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

test('retries idempotent GET requests on 503', async () => {
  let callCount = 0;
  const mock = async () => {
    callCount++;
    if (callCount < 3) {
      return jsonResponse({ success: false, error: { message: 'Unavailable', code: 'SERVICE_UNAVAILABLE' } }, 503);
    }
    return jsonResponse({ success: true, data: { items: [] } });
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    const client = createClient({
      apiUrl: 'https://cms.example.com',
      projectId: 'project-123',
      mode: 'management',
      token: 'token-123',
    });

    const result = await client.collections.list();
    assert.equal(callCount, 3);
    assert.deepEqual(result, { items: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retries on network error for GET', async () => {
  let callCount = 0;
  const mock = async () => {
    callCount++;
    if (callCount < 2) {
      throw new TypeError('fetch failed');
    }
    return jsonResponse({ success: true, data: { items: [] } });
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    const client = createClient({
      apiUrl: 'https://cms.example.com',
      projectId: 'project-123',
      mode: 'management',
      token: 'token-123',
    });

    const result = await client.collections.list();
    assert.equal(callCount, 2);
    assert.deepEqual(result, { items: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not retry POST requests on failure', async () => {
  let callCount = 0;
  const mock = async () => {
    callCount++;
    return jsonResponse({ success: false, error: { message: 'Failed', code: 'REQUEST_FAILED' } }, 500);
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    const client = createClient({
      apiUrl: 'https://cms.example.com',
      projectId: 'project-123',
      mode: 'management',
      token: 'token-123',
    });

    await assert.rejects(
      () => client.collections.create({ id: 'test', name: 'Test', path: '/test' }),
      (error) => {
        assert.ok(error instanceof OriCmsClientError);
        assert.equal(error.statusCode, 500);
        return true;
      }
    );
    assert.equal(callCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('gives up after 3 failed attempts', async () => {
  let callCount = 0;
  const mock = async () => {
    callCount++;
    return jsonResponse({ success: false, error: { message: 'Unavailable', code: 'SERVICE_UNAVAILABLE' } }, 503);
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    const client = createClient({
      apiUrl: 'https://cms.example.com',
      projectId: 'project-123',
      mode: 'management',
      token: 'token-123',
    });

    await assert.rejects(
      () => client.collections.list(),
      (error) => {
        assert.ok(error instanceof OriCmsClientError);
        assert.equal(error.statusCode, 503);
        return true;
      }
    );
    assert.equal(callCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
