import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const {
  listFilesMock,
  listBranchesMock,
  compareBranchesMock,
  getBranchDiffSummaryMock,
  createBranchMock,
  renameBranchMock,
  deleteBranchMock,
  switchBranchMock,
  promoteBranchMock,
  getFileAtBranchMock,
  applyConflictResolutionsMock,
  readFileMock,
  writeFileMock,
  getHistoryMock,
  getCommitDiffMock,
  getFileAtCommitMock,
  auditLogFindManyMock,
  auditLogCreateMock,
  projectFindUniqueMock,
  projectMemberFindUniqueMock,
  branchEnvironmentMappingUpdateManyMock,
  branchEnvironmentMappingDeleteManyMock,
  checkPermissionMock,
  dispatchLifecycleEventMock,
  lifecycleHookErrorClass,
} = vi.hoisted(() => ({
  listFilesMock: vi.fn(),
  listBranchesMock: vi.fn(),
  compareBranchesMock: vi.fn(),
  getBranchDiffSummaryMock: vi.fn(),
  createBranchMock: vi.fn(),
  renameBranchMock: vi.fn(),
  deleteBranchMock: vi.fn(),
  switchBranchMock: vi.fn(),
  promoteBranchMock: vi.fn(),
  getFileAtBranchMock: vi.fn(),
  applyConflictResolutionsMock: vi.fn(),
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
  getHistoryMock: vi.fn(),
  getCommitDiffMock: vi.fn(),
  getFileAtCommitMock: vi.fn(),
  auditLogFindManyMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  projectFindUniqueMock: vi.fn(),
  projectMemberFindUniqueMock: vi.fn(),
  branchEnvironmentMappingUpdateManyMock: vi.fn(),
  branchEnvironmentMappingDeleteManyMock: vi.fn(),
  checkPermissionMock: vi.fn(),
  dispatchLifecycleEventMock: vi.fn(),
  lifecycleHookErrorClass: class LifecycleHookError extends Error {},
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  checkPermission: checkPermissionMock,
}));

vi.mock('../service', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    listFiles: listFilesMock,
    listBranches: listBranchesMock,
    compareBranches: compareBranchesMock,
    getBranchDiffSummary: getBranchDiffSummaryMock,
    createBranch: createBranchMock,
    renameBranch: renameBranchMock,
    deleteBranch: deleteBranchMock,
    switchBranch: switchBranchMock,
    promoteBranch: promoteBranchMock,
    getFileAtBranch: getFileAtBranchMock,
    applyConflictResolutions: applyConflictResolutionsMock,
    readFile: readFileMock,
    writeFile: writeFileMock,
    getHistory: getHistoryMock,
    getCommitDiff: getCommitDiffMock,
    getFileAtCommit: getFileAtCommitMock,
  })),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: projectFindUniqueMock,
    },
    projectMember: {
      findUnique: projectMemberFindUniqueMock,
    },
    branchEnvironmentMapping: {
      updateMany: branchEnvironmentMappingUpdateManyMock,
      deleteMany: branchEnvironmentMappingDeleteManyMock,
    },
    auditLog: {
      findMany: auditLogFindManyMock,
      create: auditLogCreateMock,
    },
  },
}));

vi.mock('../../plugins/dispatcher', () => ({
  dispatchLifecycleEvent: (...args: unknown[]) => dispatchLifecycleEventMock(...args),
  LifecycleHookError: lifecycleHookErrorClass,
}));

vi.mock('../../locks/middleware', () => ({
  ensureResourceNotLocked: vi.fn().mockResolvedValue(true),
}));

import router from '../routes';

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as express.Request & { user?: unknown }).user = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
  };
  next();
});
app.use('/api/v1/projects/:projectId/git', router);

describe('Git routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    listFilesMock.mockResolvedValue([
      { path: 'content/pages/home.md', type: 'file', title: 'Home' },
    ]);
    listBranchesMock.mockResolvedValue([
      { name: 'main', isCurrent: true, isDefault: true, isProtected: true, lastCommit: { hash: '', message: '', author: '', date: '' } },
    ]);
    compareBranchesMock.mockResolvedValue({ ahead: 0, behind: 0 });
    getBranchDiffSummaryMock.mockResolvedValue({ files: ['content/pages/home.md'], total: 1 });
    createBranchMock.mockResolvedValue(undefined);
    renameBranchMock.mockResolvedValue(undefined);
    deleteBranchMock.mockResolvedValue(undefined);
    switchBranchMock.mockResolvedValue(undefined);
    promoteBranchMock.mockResolvedValue({ hash: 'abc123', message: 'Promote staging -> main' });
    getFileAtBranchMock.mockResolvedValue('content');
    applyConflictResolutionsMock.mockResolvedValue({ committedFiles: ['content/pages/home.md'] });
    readFileMock.mockResolvedValue('---\n_workflow:\n  state: draft\n  updatedAt: "2026-01-01T00:00:00.000Z"\n---\n# Home');
    writeFileMock.mockResolvedValue(undefined);
    getHistoryMock.mockResolvedValue([
      {
        hash: 'abc1234',
        date: '2026-01-01T00:00:00.000Z',
        message: 'Update home schema',
        author: 'Test User',
      },
    ]);
    getCommitDiffMock.mockResolvedValue('diff --git a/schemas/components/home.json b/schemas/components/home.json\n+{"fields": []}\n');
    getFileAtCommitMock.mockResolvedValue('{"fields":[{"key":"title","label":"Title","type":"text"}]}');
    auditLogFindManyMock.mockResolvedValue([
      {
        resourceId: 'req-1',
        action: 'promotion.requested',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        newValue: { sourceBranch: 'staging', targetBranch: 'main', requestedBy: 'user-2', requestedByName: 'Editor' },
      },
      {
        resourceId: 'req-1',
        action: 'promotion.approved',
        createdAt: new Date('2026-01-01T01:00:00.000Z'),
        newValue: { sourceBranch: 'staging', targetBranch: 'main', approvedBy: 'user-3', approvedByName: 'Admin' },
      },
    ]);
    auditLogCreateMock.mockResolvedValue({});
    branchEnvironmentMappingUpdateManyMock.mockResolvedValue({ count: 2 });
    branchEnvironmentMappingDeleteManyMock.mockResolvedValue({ count: 1 });
    dispatchLifecycleEventMock.mockResolvedValue(undefined);
    projectFindUniqueMock.mockResolvedValue({
      name: 'Test Project',
      settings: {},
    });
    projectMemberFindUniqueMock.mockResolvedValue({
      role: 'admin',
    });
    checkPermissionMock.mockResolvedValue(true);
  });

  it('compares branches', async () => {
    const response = await request(app)
      .get('/api/v1/projects/project-1/git/branches/compare?base=main&head=staging');

    expect(response.status).toBe(200);
    expect(response.body.data.base).toBe('main');
    expect(response.body.data.head).toBe('staging');
    expect(compareBranchesMock).toHaveBeenCalledWith('project-1', 'main', 'staging');
  });

  it('creates a branch', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/git/branches')
      .send({ name: 'draft/home', fromBranch: 'main' });

    expect(response.status).toBe(200);
    expect(createBranchMock).toHaveBeenCalledWith('project-1', 'draft/home', 'main');
    expect(response.body.success).toBe(true);
  });

  it('renames a branch and updates exact branch mappings', async () => {
    const response = await request(app)
      .patch('/api/v1/projects/project-1/git/branches/staging')
      .send({ newName: 'release' });

    expect(response.status).toBe(200);
    expect(renameBranchMock).toHaveBeenCalledWith('project-1', 'staging', 'release');
    expect(branchEnvironmentMappingUpdateManyMock).toHaveBeenCalledWith({
      where: { projectId: 'project-1', branchPattern: 'staging' },
      data: { branchPattern: 'release' },
    });
    expect(response.body.data.updatedMappings).toBe(2);
  });

  it('deletes a branch and removes exact branch mappings', async () => {
    const response = await request(app)
      .delete('/api/v1/projects/project-1/git/branches/release%2Fpreview');

    expect(response.status).toBe(200);
    expect(deleteBranchMock).toHaveBeenCalledWith('project-1', 'release/preview');
    expect(branchEnvironmentMappingDeleteManyMock).toHaveBeenCalledWith({
      where: { projectId: 'project-1', branchPattern: 'release/preview' },
    });
    expect(response.body.data.removedMappings).toBe(1);
  });

  it('returns a conflict when renaming the current branch is blocked', async () => {
    renameBranchMock.mockRejectedValueOnce(new Error('You cannot rename the current branch'));

    const response = await request(app)
      .patch('/api/v1/projects/project-1/git/branches/main')
      .send({ newName: 'production' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CURRENT_BRANCH_LOCKED');
  });

  it('returns branch diff summary', async () => {
    const response = await request(app)
      .get('/api/v1/projects/project-1/git/branches/diff-summary?base=main&head=staging');

    expect(response.status).toBe(200);
    expect(response.body.data.files).toContain('content/pages/home.md');
    expect(getBranchDiffSummaryMock).toHaveBeenCalledWith('project-1', 'main', 'staging', 200);
  });

  it('creates promotion request', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/git/promotions/request')
      .send({ sourceBranch: 'staging', targetBranch: 'main', reason: 'Ready to ship' });

    expect(response.status).toBe(200);
    expect(auditLogCreateMock).toHaveBeenCalled();
  });

  it('lists promotion requests with filters applied', async () => {
    auditLogFindManyMock.mockResolvedValueOnce([
      {
        resourceId: 'req-1',
        action: 'promotion.requested',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        newValue: { sourceBranch: 'staging', targetBranch: 'main', requestedBy: 'user-2', requestedByName: 'Editor' },
      },
    ]);

    const response = await request(app)
      .get('/api/v1/projects/project-1/git/promotions')
      .query({ sourceBranch: 'staging', status: 'approved', limit: '10' });

    expect(response.status).toBe(200);
    expect(response.body.data.requests).toHaveLength(1);
    expect(response.body.data.requests[0]).toMatchObject({
      sourceBranch: 'staging',
      targetBranch: 'main',
      status: 'approved',
    });
    expect(auditLogFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: 'project-1', resourceType: 'promotion', action: 'promotion.requested' },
      take: 10,
    }));
  });

  it('approves promotion request', async () => {
    auditLogFindManyMock.mockResolvedValueOnce([
      {
        resourceId: 'req-1',
        action: 'promotion.requested',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        newValue: { sourceBranch: 'staging', targetBranch: 'main', requestedBy: 'user-2', requestedByName: 'Editor' },
      },
    ]);
    auditLogFindManyMock.mockResolvedValueOnce([
      {
        resourceId: 'req-1',
        action: 'promotion.requested',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        newValue: { sourceBranch: 'staging', targetBranch: 'main', requestedBy: 'user-2', requestedByName: 'Editor' },
      },
      {
        resourceId: 'req-1',
        action: 'promotion.approved',
        createdAt: new Date('2026-01-01T01:00:00.000Z'),
        newValue: { sourceBranch: 'staging', targetBranch: 'main', approvedBy: 'user-3', approvedByName: 'Admin' },
      },
    ]);

    const response = await request(app)
      .post('/api/v1/projects/project-1/git/promotions/req-1/approve')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data.request.status).toBe('approved');
  });

  it('rejects promotion request', async () => {
    auditLogFindManyMock.mockResolvedValueOnce([
      {
        resourceId: 'req-1',
        action: 'promotion.requested',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        newValue: { sourceBranch: 'staging', targetBranch: 'main', requestedBy: 'user-2', requestedByName: 'Editor' },
      },
    ]);
    auditLogFindManyMock.mockResolvedValueOnce([
      {
        resourceId: 'req-1',
        action: 'promotion.requested',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        newValue: { sourceBranch: 'staging', targetBranch: 'main', requestedBy: 'user-2', requestedByName: 'Editor' },
      },
      {
        resourceId: 'req-1',
        action: 'promotion.rejected',
        createdAt: new Date('2026-01-01T01:00:00.000Z'),
        newValue: { sourceBranch: 'staging', targetBranch: 'main', rejectedBy: 'user-3', rejectedByName: 'Admin' },
      },
    ]);

    const response = await request(app)
      .post('/api/v1/projects/project-1/git/promotions/req-1/reject')
      .send({ reason: 'Needs more review' });

    expect(response.status).toBe(200);
    expect(response.body.data.request.status).toBe('rejected');
    expect(auditLogCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'promotion.rejected',
        resourceId: 'req-1',
      }),
    }));
  });

  it('switches branches', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/git/branches/switch')
      .send({ name: 'staging' });

    expect(response.status).toBe(200);
    expect(switchBranchMock).toHaveBeenCalledWith('project-1', 'staging');
    expect(response.body.success).toBe(true);
  });

  it('returns conflict on promote merge conflict', async () => {
    promoteBranchMock.mockRejectedValue(new Error('MERGE_CONFLICT:content/pages/home.md,content/pages/about.md'));

    const response = await request(app)
      .post('/api/v1/projects/project-1/git/promote')
      .send({ sourceBranch: 'staging', targetBranch: 'main', approvalId: 'req-1' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('MERGE_CONFLICT');
    expect(response.body.error.details.conflictedFiles).toContain('content/pages/home.md');
  });

  it('promotes an approved request and records it as consumed', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/git/promote')
      .send({ sourceBranch: 'staging', targetBranch: 'main', approvalId: 'req-1' });

    expect(response.status).toBe(200);
    expect(promoteBranchMock).toHaveBeenCalledWith('project-1', 'staging', 'main', expect.objectContaining({
      message: 'Promote staging -> main',
    }));
    expect(compareBranchesMock).toHaveBeenCalledWith('project-1', 'main', 'staging');
    expect(auditLogCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'promotion.consumed',
        resourceId: 'req-1',
      }),
    }));
  });

  it('returns source and target content for a conflicted file', async () => {
    getFileAtBranchMock
      .mockResolvedValueOnce('source version')
      .mockResolvedValueOnce('target version');

    const response = await request(app)
      .get('/api/v1/projects/project-1/git/promotions/conflicts/file')
      .query({ sourceBranch: 'staging', targetBranch: 'main', path: 'content/pages/home.md' });

    expect(response.status).toBe(200);
    expect(response.body.data.sourceContent).toBe('source version');
    expect(response.body.data.targetContent).toBe('target version');
    expect(getFileAtBranchMock).toHaveBeenNthCalledWith(1, 'project-1', 'staging', 'content/pages/home.md');
    expect(getFileAtBranchMock).toHaveBeenNthCalledWith(2, 'project-1', 'main', 'content/pages/home.md');
  });

  it('applies conflict resolutions', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/git/promotions/resolve')
      .send({
        sourceBranch: 'staging',
        targetBranch: 'main',
        resolutions: [
          {
            path: 'content/pages/home.md',
            strategy: 'manual',
            content: 'merged content',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(applyConflictResolutionsMock).toHaveBeenCalledWith(
      'project-1',
      'staging',
      'main',
      [
        {
          path: 'content/pages/home.md',
          strategy: 'manual',
          content: 'merged content',
        },
      ],
      expect.objectContaining({
        message: 'Resolve promotion conflicts staging -> main',
      })
    );
  });

  it('returns schema file content', async () => {
    readFileMock.mockResolvedValueOnce('{\n  "fields": [\n    { "key": "title", "label": "Title", "type": "string" }\n  ]\n}\n');

    const response = await request(app)
      .get('/api/v1/projects/project-1/git/schemas/home.json');

    expect(response.status).toBe(200);
    expect(response.body.data.path).toBe('schemas/components/home.json');
    expect(response.body.data.content).toContain('\"fields\"');
  });

  it('returns git history with optional scoped path', async () => {
    const response = await request(app)
      .get('/api/v1/projects/project-1/git/history')
      .query({ limit: '50', path: 'schemas/components/home.json' });

    expect(response.status).toBe(200);
    expect(response.body.data.history).toHaveLength(1);
    expect(getHistoryMock).toHaveBeenCalledWith('project-1', 50, 'schemas/components/home.json');
  });

  it('returns git history diff for commit and path', async () => {
    const response = await request(app)
      .get('/api/v1/projects/project-1/git/history/diff')
      .query({ hash: 'abc1234', path: 'schemas/components/home.json' });

    expect(response.status).toBe(200);
    expect(response.body.data.hash).toBe('abc1234');
    expect(response.body.data.path).toBe('schemas/components/home.json');
    expect(response.body.data.diff).toContain('diff --git');
    expect(getCommitDiffMock).toHaveBeenCalledWith('project-1', 'abc1234', 'schemas/components/home.json');
  });

  it('returns git history file content for commit and path', async () => {
    const response = await request(app)
      .get('/api/v1/projects/project-1/git/history/file')
      .query({ hash: 'abc1234', path: 'schemas/components/home.json' });

    expect(response.status).toBe(200);
    expect(response.body.data.hash).toBe('abc1234');
    expect(response.body.data.path).toBe('schemas/components/home.json');
    expect(response.body.data.content).toContain('"fields"');
    expect(getFileAtCommitMock).toHaveBeenCalledWith('project-1', 'abc1234', 'schemas/components/home.json');
  });

  it('returns not found when history file is missing in selected commit', async () => {
    getFileAtCommitMock.mockResolvedValueOnce(null);

    const response = await request(app)
      .get('/api/v1/projects/project-1/git/history/file')
      .query({ hash: 'deadbeef', path: 'schemas/components/home.json' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
