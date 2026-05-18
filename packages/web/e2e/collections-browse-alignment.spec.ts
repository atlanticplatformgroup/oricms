import { test, expect, type Page, type Route } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173';
const PROJECT_ID = 'project-alignment-e2e';
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
  slug: string;
  subtitle?: string;
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

async function setupMockApi(page: Page, entries: Entry[]) {
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
            name: 'Alignment E2E Project',
            slug: 'alignment-e2e-project',
            role: 'owner',
            defaultBranch: 'main',
            repoUrl: 'https://example.com/repo.git',
            settings: {
              environments: [{ id: 'preview', name: 'Preview', type: 'preview' }],
              defaultEnvironmentId: 'preview',
            },
          },
        ],
      }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/git/status`) {
      await fulfill(route, success({
        status: { ahead: 0, behind: 0, modified: [], staged: [] },
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

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/branch-mappings`) {
      await fulfill(route, success({ mappings: [], defaults: [] }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/workspace-catalog`) {
      await fulfill(route, success({
        catalog: {
          navigation: {
            systemSurfaces: [],
            uiGroups: [],
            ungroupedCollectionIds: ['blog-posts'],
          },
          collections: [
            { collection: { id: 'blog-posts', label: 'Blog Posts', singularLabel: 'Blog Post', contentType: 'blog-post', path: 'content/blog-posts' }, recordCount: entries.length },
          ],
          schemas: [],
        },
      }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/schemas`) {
      await fulfill(route, success({
        collections: [
          {
            id: 'blog-posts',
            label: 'Blog Posts',
            singularLabel: 'Blog Post',
            contentType: 'blog-post',
            path: 'content/blog-posts',
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
            $id: 'blog-post',
            name: 'blog-post',
            plural: 'blog-posts',
            label: 'Blog Post',
            labelPlural: 'Blog Posts',
            fields: [
              { key: 'title', label: 'Title', type: 'string', required: true },
              { key: 'slug', label: 'Slug', type: 'uid', required: false },
              { key: 'subtitle', label: 'Subtitle', type: 'text', required: false },
            ],
            display: { primary: 'title', secondary: 'subtitle' },
          },
        ],
      }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/git/schemas/types`) {
      await fulfill(route, success({
        schemas: [
          {
            $schema: 'schema-document-v1',
            id: 'blog-post',
            kind: 'type',
            path: 'schemas/types/blog-post.json',
            schema: {
              $schema: 'content-type-v1',
              $id: 'blog-post',
              name: 'blog-post',
              plural: 'blog-posts',
              label: 'Blog Post',
              labelPlural: 'Blog Posts',
              fields: [
                { key: 'title', label: 'Title', type: 'string', required: true },
                { key: 'slug', label: 'Slug', type: 'uid', required: false },
                { key: 'subtitle', label: 'Subtitle', type: 'text', required: false },
              ],
              display: { primary: 'title', secondary: 'subtitle' },
            },
          },
        ],
      }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/git/schemas/components`) {
      await fulfill(route, success({ schemas: [] }));
      return;
    }

    if (method === 'GET' && path.startsWith(`/api/v1/projects/${PROJECT_ID}/git/schemas/`)) {
      const schemaPath = decodeURIComponent(path.replace(`/api/v1/projects/${PROJECT_ID}/git/schemas/`, ''));
      await fulfill(route, success({
        path: schemaPath,
        content: JSON.stringify({
          $schema: 'content-type-v1',
          $id: 'blog-post',
          name: 'blog-post',
          plural: 'blog-posts',
          label: 'Blog Post',
          labelPlural: 'Blog Posts',
          fields: [
            { key: 'title', label: 'Title', type: 'string', required: true },
            { key: 'slug', label: 'Slug', type: 'uid', required: false },
            { key: 'subtitle', label: 'Subtitle', type: 'text', required: false },
          ],
          display: { primary: 'title', secondary: 'subtitle' },
        }),
      }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/assets/images`) {
      await fulfill(route, success({ assets: [] }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/assets/documents`) {
      await fulfill(route, success({ assets: [] }));
      return;
    }

    if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}/schemas/blog-posts/entries`) {
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

    await fulfill(route, {
      success: false,
      error: { code: 'NOT_MOCKED', message: `${method} ${path} not mocked` },
    }, 404);
  });
}

test.describe('Collections browse alignment', () => {
  test('keeps page header, toolbar, and table on the same rails', async ({ page }) => {
    await setupMockApi(page, [
      {
        $id: 'entry-1',
        $type: 'blog-post',
        $status: 'draft',
        $createdAt: new Date().toISOString(),
        $updatedAt: new Date().toISOString(),
        title: 'Field Guide',
        slug: 'field-guide',
        subtitle: 'Supporting entry used as a relation target.',
      },
      {
        $id: 'entry-2',
        $type: 'blog-post',
        $status: 'published',
        $createdAt: new Date().toISOString(),
        $updatedAt: new Date().toISOString(),
        $publishedAt: new Date().toISOString(),
        title: 'Hello World',
        slug: 'hello-world',
        subtitle: 'A complete field lab for validating the Mantine dashboard.',
      },
    ]);

    await page.goto(`${BASE_URL}/alignment-e2e-project/b/main/content/blog-posts`);
    await expect(page).toHaveURL(/\/content\/blog-posts$/);

    const title = page.getByRole('heading', { name: 'Blog Posts' });
    const search = page.getByLabel('Search entries');
    const table = page.getByRole('table').first();
    const newEntry = page.getByRole('button', { name: 'New entry' });
    const count = page.getByText('1–2 of 2');

    const [titleBox, searchBox, tableBox, newEntryBox, countBox] = await Promise.all([
      title.boundingBox(),
      search.boundingBox(),
      table.boundingBox(),
      newEntry.boundingBox(),
      count.boundingBox(),
    ]);

    expect(titleBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(tableBox).not.toBeNull();
    expect(newEntryBox).not.toBeNull();
    expect(countBox).not.toBeNull();

    const leftTolerance = 1;
    const rightTolerance = 12;

    expect(Math.abs(titleBox!.x - searchBox!.x)).toBeLessThanOrEqual(leftTolerance);
    expect(Math.abs(searchBox!.x - tableBox!.x)).toBeLessThanOrEqual(leftTolerance);
    expect(Math.abs((newEntryBox!.x + newEntryBox!.width) - (countBox!.x + countBox!.width))).toBeLessThanOrEqual(rightTolerance);
  });
});
