import { test, expect, type Page, type Route } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173';
const PROJECT_ID = 'project-workspace-e2e';
const TEST_ACCESS_TOKEN = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url'),
  'test-signature',
].join('.');

type Entry = {
  $id: string;
  $type: string;
  $status: 'draft' | 'published';
  $createdAt: string;
  $updatedAt: string;
  $publishedAt?: string;
  title: string;
};

type MockState = {
  entriesByCollection: Record<string, Entry[]>;
  failNextUpdate: boolean;
};

function success(data: unknown) {
  return { success: true, data };
}

async function fulfill(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': '*',
    },
    body: JSON.stringify(payload),
  });
}

async function setupMockApi(page: Page, state: MockState) {
  await page.addInitScript((accessToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', 'test-refresh-token');
  }, TEST_ACCESS_TOKEN);

  await page.context().route('**/*', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    if (!path.startsWith('/api/v1/')) {
      await route.continue();
      return;
    }

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'access-control-allow-headers': '*',
        },
      });
      return;
    }

    if (method === 'GET' && path === '/api/v1/system/status') {
      await fulfill(route, success({ needsSetup: false, hasOwner: true, hasProjects: true }));
      return;
    }

    if (method === 'GET' && path === '/api/v1/auth/me') {
      await fulfill(route, success({
        id: 'user-e2e',
        email: 'owner@example.com',
        name: 'Owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    if (method === 'POST' && path === '/api/v1/auth/refresh') {
      await fulfill(route, success({
        accessToken: TEST_ACCESS_TOKEN,
        refreshToken: 'test-refresh-token',
      }));
      return;
    }

    if (method === 'GET' && path === '/api/v1/auth/me/preferences') {
      await fulfill(route, success({
        theme: 'system',
        editorMode: 'split',
        notifications: { builds: true, invites: true, mentions: true },
        projectDefaults: {},
        lastVisitedProjectId: PROJECT_ID,
      }));
      return;
    }

    if (method === 'PATCH' && path === '/api/v1/auth/me/preferences') {
      await fulfill(route, success({}));
      return;
    }

    if (method === 'GET' && path === '/api/v1/projects') {
      await fulfill(route, success({
        projects: [
          {
            id: PROJECT_ID,
            name: 'Workspace E2E Project',
            slug: 'workspace-e2e-project',
            role: 'owner',
            defaultBranch: 'main',
            repoUrl: 'https://example.com/repo.git',
            settings: {
              environments: [
                { id: 'preview', name: 'Preview', type: 'preview', url: 'https://preview.example.com' },
              ],
              defaultEnvironmentId: 'preview',
            },
          },
        ],
      }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/git/status`) {
      await fulfill(route, success({
        status: {
          ahead: 0,
          behind: 0,
          modified: [],
          staged: [],
        },
      }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/git/branches`) {
      await fulfill(route, success({
        branches: [
          {
            name: 'main',
            isCurrent: true,
            isDefault: true,
            isProtected: true,
            lastCommit: {
              hash: 'abc123',
              message: 'Initial',
              author: 'System',
              date: new Date().toISOString(),
            },
          },
        ],
        current: 'main',
      }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/git/branches/compare`) {
      await fulfill(route, success({
        base: 'main',
        head: 'staging',
        ahead: 0,
        behind: 0,
      }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/branch-mappings`) {
      await fulfill(route, success({ mappings: [], defaults: [] }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/collections`) {
      await fulfill(route, success({
        collections: [
          {
            id: 'posts',
            label: 'Posts',
            contentType: 'post',
            path: 'content/posts',
          },
          {
            id: 'pages',
            label: 'Pages',
            contentType: 'page',
            path: 'content/pages',
          },
        ],
      }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/content-types`) {
      await fulfill(route, success({
        contentTypes: [
          {
            $schema: 'content-type-v1',
            $id: 'post',
            name: 'post',
            plural: 'posts',
            label: 'Post',
            labelPlural: 'Posts',
            fields: [
              { key: 'title', label: 'Title', type: 'string', required: true },
            ],
            display: { primary: 'title' },
          },
          {
            $schema: 'content-type-v1',
            $id: 'page',
            name: 'page',
            plural: 'pages',
            label: 'Page',
            labelPlural: 'Pages',
            fields: [
              { key: 'title', label: 'Title', type: 'string', required: true },
            ],
            display: { primary: 'title' },
          },
        ],
      }));
      return;
    }

    const collectionListMatch = path.match(new RegExp(`^/api/v1/projects/${PROJECT_ID}/collections/([^/]+)$`));
    if (collectionListMatch && method === 'GET') {
      const collectionId = collectionListMatch[1];
      const entries = state.entriesByCollection[collectionId] || [];
      await fulfill(route, success({
        data: entries,
        meta: {
          pagination: {
            page: 1,
            pageSize: 20,
            pageCount: 1,
            total: entries.length,
          },
        },
      }));
      return;
    }

    const entryGetMatch = path.match(new RegExp(`^/api/v1/projects/${PROJECT_ID}/collections/([^/]+)/([^/]+)$`));
    if (entryGetMatch && method === 'GET') {
      const collectionId = entryGetMatch[1];
      const entryId = entryGetMatch[2];
      const entry = (state.entriesByCollection[collectionId] || []).find((item) => item.$id === entryId);
      if (!entry) {
        await fulfill(route, { success: false, error: { code: 'NOT_FOUND', message: 'Entry not found' } }, 404);
        return;
      }

      await fulfill(route, success({ entry }));
      return;
    }

    if (collectionListMatch && method === 'POST') {
      const collectionId = collectionListMatch[1];
      const body = request.postDataJSON() as Partial<Entry>;
      const next: Entry = {
        $id: `entry-${Date.now()}`,
        $type: String(body.$type || collectionId.slice(0, -1)),
        $status: 'draft',
        $createdAt: new Date().toISOString(),
        $updatedAt: new Date().toISOString(),
        title: String(body.title || `Untitled ${Date.now()}`),
      };
      state.entriesByCollection[collectionId] = [next, ...(state.entriesByCollection[collectionId] || [])];
      await fulfill(route, success({ entry: next }), 201);
      return;
    }

    if (entryGetMatch && method === 'PUT') {
      if (state.failNextUpdate) {
        state.failNextUpdate = false;
        await fulfill(route, { success: false, error: { code: 'UPDATE_FAILED', message: 'Unable to save' } }, 500);
        return;
      }

      const collectionId = entryGetMatch[1];
      const entryId = entryGetMatch[2];
      const body = request.postDataJSON() as Partial<Entry>;

      const nextEntries = (state.entriesByCollection[collectionId] || []).map((entry) => {
        if (entry.$id !== entryId) return entry;
        return {
          ...entry,
          ...body,
          $id: entryId,
          $updatedAt: new Date().toISOString(),
        };
      });

      state.entriesByCollection[collectionId] = nextEntries;
      const updated = nextEntries.find((entry) => entry.$id === entryId)!;
      await fulfill(route, success({ entry: updated }));
      return;
    }

    await fulfill(
      route,
      {
        success: false,
        error: { code: 'NOT_MOCKED', message: `${method} ${path} not mocked` },
      },
      404,
    );
  });
}

async function fillEntryTitle(page: Page, value: string) {
  await expect(async () => {
    await expect(page.getByTestId('open-commit-bar')).toBeVisible();
    const titleInput = page.getByLabel('Title');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(value);
    await expect(titleInput).toHaveValue(value);
  }).toPass();
}

test.describe('Workspace dashboard', () => {
  test('bootstraps auth and renders project switcher + branch indicator', async ({ page }) => {
    const state: MockState = {
      entriesByCollection: {
        posts: [
          {
            $id: 'post-1',
            $type: 'post',
            $status: 'draft',
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            title: 'Welcome',
          },
        ],
        pages: [],
      },
      failNextUpdate: false,
    };

    await setupMockApi(page, state);
    await page.goto(BASE_URL);

    await expect(page.getByTestId('project-switcher')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Branch: main' })).toBeVisible();
    await expect(page).toHaveURL(/\/collections\/posts$/);
  });

  test('collections happy path: open entry, edit, commit, and verify update', async ({ page }) => {
    const state: MockState = {
      entriesByCollection: {
        posts: [
          {
            $id: 'post-1',
            $type: 'post',
            $status: 'draft',
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            title: 'Welcome',
          },
        ],
        pages: [],
      },
      failNextUpdate: false,
    };

    await setupMockApi(page, state);
    await page.goto(BASE_URL);

    await page.getByTestId('entry-open-post-1').click();
    await expect(page).toHaveURL(/\/collections\/posts\/entries\/post-1$/);

    await fillEntryTitle(page, 'Welcome Updated');
    await page.getByTestId('open-commit-bar').click();
    await page.getByLabel('Commit message').fill('Update post title');
    await page.getByTestId('commit-entry').click();

    await expect(page.getByText('Entry saved')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome Updated' })).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue('Welcome Updated');
  });

  test('collections failure path: save error does not crash shell', async ({ page }) => {
    const state: MockState = {
      entriesByCollection: {
        posts: [
          {
            $id: 'post-1',
            $type: 'post',
            $status: 'draft',
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            title: 'Welcome',
          },
        ],
        pages: [],
      },
      failNextUpdate: true,
    };

    await setupMockApi(page, state);
    await page.goto(BASE_URL);

    await page.getByTestId('entry-open-post-1').click();
    await fillEntryTitle(page, 'Failed save attempt');
    await page.getByTestId('open-commit-bar').click();
    await page.getByLabel('Commit message').fill('Will fail');
    await page.getByTestId('commit-entry').click();

    await expect(page.getByTestId('commit-message')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Failed save attempt' })).toBeVisible();
  });

  test('workspace smoke: non-collections sections navigate and render primary CTA', async ({ page }) => {
    const state: MockState = {
      entriesByCollection: {
        posts: [
          {
            $id: 'post-1',
            $type: 'post',
            $status: 'draft',
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            title: 'Welcome',
          },
        ],
        pages: [],
      },
      failNextUpdate: false,
    };

    await setupMockApi(page, state);
    await page.goto(BASE_URL);

    await page.getByTestId('section-schemas').click();
    await expect(page.getByRole('heading', { name: 'Schemas', level: 3 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New content type' })).toBeVisible();

    await page.getByTestId('section-media').click();
    await expect(page.getByRole('heading', { name: 'Media', level: 3 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload asset' })).toBeVisible();

    await page.getByTestId('section-builds').click();
    await expect(page.getByRole('heading', { name: 'Builds', level: 3 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trigger build' })).toBeVisible();
  });
});
