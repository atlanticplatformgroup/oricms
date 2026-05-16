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

test('plugins.listEvents sends auth + query params in management mode', async () => {
  const { mock, calls } = createFetchMock(() => jsonResponse({
    success: true,
    data: {
      events: [],
      pagination: {
        page: 2,
        pageSize: 10,
        pageCount: 1,
        total: 0,
      },
    },
  }));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    const client = createClient({
      apiUrl: 'https://cms.example.com/',
      projectId: 'project-123',
      mode: 'management',
      token: 'token-123',
    });

    const result = await client.plugins.listEvents({
      page: 2,
      limit: 10,
      status: 'failed',
      pluginId: 'seo-tools',
      event: 'collection.record.updated',
    });

    assert.equal(result.pagination.page, 2);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      'https://cms.example.com/api/v1/projects/project-123/plugins/events?page=2&limit=10&status=failed&pluginId=seo-tools&event=collection.record.updated'
    );
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[0].headers.Authorization, 'Bearer token-123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('plugins.previewPolicyRollback maps API errors with code/status', async () => {
  const { mock } = createFetchMock(() => jsonResponse({
    success: false,
    error: {
      code: 'POLICY_EVENT_NOT_FOUND',
      message: 'Policy event not found',
    },
  }, 404));

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
      () => client.plugins.previewPolicyRollback('missing-event'),
      (error) => {
        assert.ok(error instanceof OriCmsClientError);
        assert.equal(error.code, 'POLICY_EVENT_NOT_FOUND');
        assert.equal(error.statusCode, 404);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('plugins.rollbackPolicyEvent requires management token', async () => {
  const client = createClient({
    apiUrl: 'https://cms.example.com',
    projectId: 'project-123',
    mode: 'delivery',
  });

  await assert.rejects(
    () => client.plugins.rollbackPolicyEvent('evt-1'),
    (error) => {
      assert.ok(error instanceof OriCmsClientError);
      assert.equal(error.code, 'UNAUTHORIZED');
      assert.equal(error.statusCode, 401);
      return true;
    }
  );
});

test('deprecated siteId alias still targets project routes', async () => {
  const { mock, calls } = createFetchMock(() => jsonResponse({
    success: true,
    data: {
      events: [],
      pagination: {
        page: 1,
        pageSize: 20,
        pageCount: 0,
        total: 0,
      },
    },
  }));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    const client = createClient({
      apiUrl: 'https://cms.example.com',
      siteId: 'legacy-project-id',
      mode: 'management',
      token: 'token-123',
    });

    assert.equal(client.projectId, 'legacy-project-id');
    assert.equal(client.siteId, 'legacy-project-id');
    await client.plugins.listEvents();

    assert.equal(
      calls[0].url,
      'https://cms.example.com/api/v1/projects/legacy-project-id/plugins/events'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('projectId wins when deprecated siteId is also provided', async () => {
  const { mock, calls } = createFetchMock(() => jsonResponse({
    success: true,
    data: {
      events: [],
      pagination: {
        page: 1,
        pageSize: 20,
        pageCount: 0,
        total: 0,
      },
    },
  }));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    const client = createClient({
      apiUrl: 'https://cms.example.com',
      projectId: 'project-123',
      siteId: 'legacy-project-id',
      mode: 'management',
      token: 'token-123',
    });

    assert.equal(client.projectId, 'project-123');
    assert.equal(client.siteId, 'project-123');
    await client.plugins.listEvents();

    assert.equal(
      calls[0].url,
      'https://cms.example.com/api/v1/projects/project-123/plugins/events'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
