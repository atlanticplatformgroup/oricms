import test from 'node:test';
import assert from 'node:assert/strict';

import { createClient, OriCmsClientError } from '../dist/index.js';

function createFetchMock(handler) {
  const calls = [];
  const mock = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || 'GET';
    const headers = init.headers || {};
    const body = init.body;
    calls.push({ url, method, headers, body });
    return handler({ url, method, headers, body, calls });
  };
  return { mock, calls };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

function textResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      throw new Error('not json');
    },
    async text() {
      return body;
    },
  };
}

test('graphql.executePersisted targets delivery GraphQL endpoint without auth header', async () => {
  const { mock, calls } = createFetchMock(() => jsonResponse({
    success: true,
    data: {
      records: [],
    },
  }));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    const client = createClient({
      apiUrl: 'https://cms.example.com/',
      projectId: 'project-123',
      mode: 'delivery',
    });

    const result = await client.graphql.executePersisted('persisted-homepage-query', {
      variables: { locale: 'en' },
    });

    assert.deepEqual(result, { records: [] });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://cms.example.com/api/v1/delivery/projects/project-123/graphql');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].headers.Authorization, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('graphql.getSchemaSdl falls back to default error for non-json failures', async () => {
  const { mock } = createFetchMock(() => textResponse('upstream error', 502));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    const client = createClient({
      apiUrl: 'https://cms.example.com',
      projectId: 'project-123',
      mode: 'delivery',
    });

    await assert.rejects(
      () => client.graphql.getSchemaSdl(),
      (error) => {
        assert.ok(error instanceof OriCmsClientError);
        assert.equal(error.code, 'REQUEST_FAILED');
        assert.equal(error.statusCode, 502);
        assert.equal(error.message, 'Failed to fetch GraphQL schema SDL');
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
