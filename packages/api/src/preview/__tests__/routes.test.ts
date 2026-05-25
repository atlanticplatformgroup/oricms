import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const {
  projectFindUniqueMock,
  cloneOrPullMock,
  checkoutRefMock,
  getWorkspaceDirMock,
  getCurrentCommitMock,
  readFileMock,
  readdirMock,
  statMock,
} = vi.hoisted(() => ({
  projectFindUniqueMock: vi.fn(),
  cloneOrPullMock: vi.fn(),
  checkoutRefMock: vi.fn(),
  getWorkspaceDirMock: vi.fn(),
  getCurrentCommitMock: vi.fn(),
  readFileMock: vi.fn(),
  readdirMock: vi.fn(),
  statMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: projectFindUniqueMock,
    },
  },
}));

vi.mock('../../git/service', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    cloneOrPull: cloneOrPullMock,
    checkoutRef: checkoutRefMock,
    getWorkspaceDir: getWorkspaceDirMock,
    getCurrentCommit: getCurrentCommitMock,
  })),
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: readFileMock,
    readdir: readdirMock,
    stat: statMock,
  },
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import router from '../routes';

const app = express();
app.use(express.json());
app.use('/api/v1/projects/:projectId/preview', router);

const projectId = '550e8400-e29b-41d4-a716-446655440000';
const repoDir = '/tmp/oricms-test-repo';

describe('Preview routes locale integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    projectFindUniqueMock.mockResolvedValue({
      id: projectId,
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
    });

    cloneOrPullMock.mockResolvedValue(undefined);
    checkoutRefMock.mockResolvedValue(undefined);
    getWorkspaceDirMock.mockReturnValue(repoDir);
    getCurrentCommitMock.mockResolvedValue({
      hash: 'abc1234',
      message: 'latest',
      author: 'Test',
      date: '2026-03-01T00:00:00.000Z',
    });
  });

  it('returns locale-specific preview content when requested locale exists', async () => {
    readFileMock.mockResolvedValue(`---
title: Home
_schemaValues:
  hero_title: Default
_localizedContent:
  en:
    body: "Hello world"
    schemaValues:
      hero_title: "Hello EN"
  es:
    body: "Hola mundo"
    schemaValues:
      hero_title: "Hola ES"
---
Default body`);

    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/preview/content`)
      .query({
        path: 'content/pages/home.md',
        locale: 'es',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.meta.locale).toBe('es');
    expect(response.body.data.content.body).toBe('Hola mundo');
    expect(response.body.data.content.frontmatter._schemaValues).toEqual({ hero_title: 'Hola ES' });
    expect(response.body.data.content.frontmatter._resolvedLocaleSource).toBe('requested');
  });

  it('falls back to en when requested locale content is missing', async () => {
    readFileMock.mockResolvedValue(`---
title: Home
_schemaValues:
  hero_title: Default
_localizedContent:
  en:
    body: "Hello world"
    schemaValues:
      hero_title: "Hello EN"
---
Default body`);

    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/preview/content`)
      .query({
        path: 'content/pages/home.md',
        locale: 'es',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.content.body).toBe('Hello world');
    expect(response.body.data.content.frontmatter._schemaValues).toEqual({ hero_title: 'Hello EN' });
    expect(response.body.data.content.frontmatter._resolvedLocaleSource).toBe('en');
  });

  it('returns locale resolution source in preview pages listing', async () => {
    readdirMock.mockResolvedValue(['home.md']);
    statMock.mockResolvedValue({ isFile: () => true });
    readFileMock.mockResolvedValue(`---
title: Home
_localizedContent:
  en:
    body: "Hello world"
---
Default body`);

    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/preview/pages`)
      .query({ locale: 'es' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.meta.locale).toBe('es');
    expect(response.body.data.pages).toHaveLength(1);
    expect(response.body.data.pages[0].localeResolvedFrom).toBe('en');
  });

  it('returns validation error for unsupported locale', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/preview/content`)
      .query({
        path: 'content/pages/home.md',
        locale: 'fr',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
