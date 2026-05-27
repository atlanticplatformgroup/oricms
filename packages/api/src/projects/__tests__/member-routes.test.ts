import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  projectMemberFindManyMock,
  projectMemberFindUniqueMock,
  projectMemberCreateMock,
  projectMemberUpdateMock,
  projectMemberDeleteMock,
  userCreateMock,
  userFindUniqueMock,
  userDeleteMock,
  agentTokenCreateMock,
  agentTokenDeleteManyMock,
  projectInviteCreateMock,
  transactionMock,
  sendEmailMock,
  bootstrapAgentProjectDefaultsMock,
  ensureResourceNotLockedMock,
} = vi.hoisted(() => ({
  projectMemberFindManyMock: vi.fn(),
  projectMemberFindUniqueMock: vi.fn(),
  projectMemberCreateMock: vi.fn(),
  projectMemberUpdateMock: vi.fn(),
  projectMemberDeleteMock: vi.fn(),
  userCreateMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userDeleteMock: vi.fn(),
  agentTokenCreateMock: vi.fn(),
  agentTokenDeleteManyMock: vi.fn(),
  projectInviteCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  sendEmailMock: vi.fn(),
  bootstrapAgentProjectDefaultsMock: vi.fn(),
  ensureResourceNotLockedMock: vi.fn(),
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../locks/middleware', () => ({
  ensureResourceNotLocked: (...args: unknown[]) => ensureResourceNotLockedMock(...args),
}));

vi.mock('../../lib/email', () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

vi.mock('../agent-defaults', () => ({
  bootstrapAgentProjectDefaults: (...args: unknown[]) => bootstrapAgentProjectDefaultsMock(...args),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    projectMember: {
      findMany: projectMemberFindManyMock,
      findUnique: projectMemberFindUniqueMock,
      create: projectMemberCreateMock,
      update: projectMemberUpdateMock,
      delete: projectMemberDeleteMock,
    },
    user: {
      create: userCreateMock,
      findUnique: userFindUniqueMock,
      delete: userDeleteMock,
    },
    agentToken: {
      create: agentTokenCreateMock,
      deleteMany: agentTokenDeleteManyMock,
    },
    projectInvite: {
      create: projectInviteCreateMock,
    },
    $transaction: transactionMock,
  },
}));

import router from '../member-routes';

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
app.use('/api/v1/projects', router);

describe('Project member routes', () => {
  const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    ensureResourceNotLockedMock.mockResolvedValue(true);
    projectMemberFindManyMock.mockResolvedValue([
      {
        id: 'member-1',
        projectId: PROJECT_ID,
        userId: 'user-2',
        role: 'editor',
        user: {
          id: 'user-2',
          name: 'Editor',
          email: 'editor@example.com',
          type: 'USER',
          avatarUrl: null,
        },
      },
    ]);
    projectMemberFindUniqueMock.mockResolvedValue({ role: 'owner' });
    projectMemberCreateMock.mockResolvedValue({
      id: 'member-2',
      projectId: PROJECT_ID,
      userId: 'user-2',
      role: 'editor',
      user: {
        id: 'user-2',
        name: 'Editor',
        email: 'editor@example.com',
        type: 'USER',
        avatarUrl: null,
      },
    });
    projectMemberUpdateMock.mockResolvedValue({
      id: 'member-2',
      projectId: PROJECT_ID,
      userId: 'user-2',
      role: 'admin',
      user: {
        id: 'user-2',
        name: 'Editor',
        email: 'editor@example.com',
        avatarUrl: null,
      },
    });
    projectMemberDeleteMock.mockResolvedValue({});
    userCreateMock.mockResolvedValue({
      id: 'agent-user-1',
      email: 'agent-test@oricms.local',
      name: 'Agent',
      type: 'AGENT',
    });
    userFindUniqueMock.mockResolvedValue(null);
    userDeleteMock.mockResolvedValue({});
    agentTokenCreateMock.mockResolvedValue({});
    agentTokenDeleteManyMock.mockResolvedValue({});
    projectInviteCreateMock.mockResolvedValue({
      id: 'invite-1',
      projectId: PROJECT_ID,
      email: 'invitee@example.com',
      role: 'editor',
      invitedById: 'user-1',
    });
    transactionMock.mockResolvedValue([]);
    sendEmailMock.mockResolvedValue({ delivered: true, mode: 'smtp' });
    bootstrapAgentProjectDefaultsMock.mockResolvedValue(undefined);
  });

  it('lists project members with the members resource collection id', async () => {
    const response = await request(app).get(`/api/v1/projects/${PROJECT_ID}/members`);

    expect(response.status).toBe(200);
    expect(response.body.data.resourceCollectionId).toBe('members.project');
    expect(response.body.data.members[0]).toMatchObject({
      projectId: PROJECT_ID,
      resourceCollectionId: 'members.project',
    });
  });

  it('creates an agent member and bootstraps project defaults', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/members/agent`)
      .send({ name: 'Agent', role: 'editor', expiresInDays: 3 });

    expect(response.status).toBe(201);
    expect(bootstrapAgentProjectDefaultsMock).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      role: 'editor',
      createdBy: 'user-1',
    });
    expect(agentTokenCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: PROJECT_ID,
        userId: 'agent-user-1',
        name: 'Agent',
        token: expect.stringMatching(/^agt_/),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('returns a conflict when inviting an existing project member', async () => {
    userFindUniqueMock.mockResolvedValueOnce({ id: 'user-2', email: 'editor@example.com' });
    projectMemberFindUniqueMock.mockResolvedValueOnce({ id: 'member-2' });

    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/members`)
      .send({ email: 'editor@example.com', role: 'editor' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ALREADY_MEMBER');
  });

  it('creates an invite and email for a new member', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/members`)
      .send({ email: 'invitee@example.com', role: 'editor' });

    expect(response.status).toBe(201);
    expect(projectInviteCreateMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitee@example.com',
        metadata: { projectId: PROJECT_ID, role: 'editor', invitedById: 'user-1' },
      }),
    );
    expect(response.body.data.invite.inviteLink).toContain('/invite/');
  });

  it('rejects changing your own role', async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${PROJECT_ID}/members/user-1`)
      .send({ role: 'admin' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CANT_CHANGE_SELF');
  });

  it('rejects ownership transfer when the actor is not an owner', async () => {
    projectMemberFindUniqueMock.mockResolvedValueOnce({ role: 'admin' });

    const response = await request(app)
      .patch(`/api/v1/projects/${PROJECT_ID}/members/user-2`)
      .send({ role: 'owner' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects deleting yourself through the member delete endpoint', async () => {
    const response = await request(app).delete(`/api/v1/projects/${PROJECT_ID}/members/user-1`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CANT_REMOVE_SELF');
  });
});
