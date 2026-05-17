import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAgentCollectionWriteDefaultsForRoles,
  seedAgentWriteConfigsForProjectAgents,
  seedAgentWriteConfigsForRoles,
} from '../agent-write-configs';

describe('agent write config defaults', () => {
  const agentAccessFindUniqueMock = vi.fn();
  const agentAccessUpdateMock = vi.fn();
  const projectMemberFindManyMock = vi.fn();
  const agentWriteConfigFindUniqueMock = vi.fn();
  const agentWriteConfigCreateMock = vi.fn();

  const prismaClient = {
    agentAccess: { findUnique: agentAccessFindUniqueMock, update: agentAccessUpdateMock },
    projectMember: { findMany: projectMemberFindManyMock },
    agentWriteConfig: {
      findUnique: agentWriteConfigFindUniqueMock,
      create: agentWriteConfigCreateMock,
    },
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    agentAccessFindUniqueMock.mockResolvedValue({ enabled: true, allowedCollections: [] });
    agentAccessUpdateMock.mockResolvedValue({});
    projectMemberFindManyMock.mockResolvedValue([{ role: 'editor' }]);
    agentWriteConfigFindUniqueMock.mockResolvedValue(null);
    agentWriteConfigCreateMock.mockResolvedValue({});
  });

  it('derives collection write defaults from member roles', () => {
    expect(getAgentCollectionWriteDefaultsForRoles(['viewer'])).toBeNull();
    expect(getAgentCollectionWriteDefaultsForRoles(['editor'])).toEqual({
      canCreate: true,
      canUpdate: true,
      canDelete: false,
    });
    expect(getAgentCollectionWriteDefaultsForRoles(['editor', 'admin'])).toEqual({
      canCreate: true,
      canUpdate: true,
      canDelete: true,
    });
  });

  it('creates missing write configs for writable project agent roles', async () => {
    const created = await seedAgentWriteConfigsForProjectAgents({
      projectId: 'project-1',
      collectionNames: ['posts', 'posts', 'pages'],
      targetBranch: 'main',
      prismaClient,
    });

    expect(created).toBe(2);
    expect(agentAccessFindUniqueMock).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      select: { enabled: true, allowedCollections: true },
    });
    expect(agentAccessUpdateMock).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      data: { allowedCollections: ['posts', 'pages'] },
    });
    expect(projectMemberFindManyMock).toHaveBeenCalledWith({
      where: { projectId: 'project-1', userType: 'AGENT' },
      select: { role: true },
    });
    expect(agentWriteConfigCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        collectionName: 'posts',
        mode: 'AUTO_PUBLISH',
        targetBranch: 'main',
        canCreate: true,
        canUpdate: true,
        canDelete: false,
        maxWritesPerHour: 50,
        maxFieldsPerChange: 25,
        requireValidation: true,
      }),
    });
    expect(agentWriteConfigCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ collectionName: 'pages' }),
    });
  });

  it('does not seed configs when project agent access is disabled', async () => {
    agentAccessFindUniqueMock.mockResolvedValue({ enabled: false });

    const created = await seedAgentWriteConfigsForProjectAgents({
      projectId: 'project-1',
      collectionNames: ['posts'],
      targetBranch: 'main',
      prismaClient,
    });

    expect(created).toBe(0);
    expect(projectMemberFindManyMock).not.toHaveBeenCalled();
    expect(agentWriteConfigCreateMock).not.toHaveBeenCalled();
  });

  it('does not broaden an explicitly narrowed collection allowlist', async () => {
    agentAccessFindUniqueMock.mockResolvedValue({ enabled: true, allowedCollections: ['posts'] });

    const created = await seedAgentWriteConfigsForProjectAgents({
      projectId: 'project-1',
      collectionNames: ['pages'],
      existingCollectionNames: ['posts', 'case-studies'],
      targetBranch: 'main',
      prismaClient,
    });

    expect(created).toBe(1);
    expect(agentAccessUpdateMock).not.toHaveBeenCalled();
    expect(agentWriteConfigCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ collectionName: 'pages' }),
    });
  });

  it('does not overwrite existing collection write configs', async () => {
    agentWriteConfigFindUniqueMock.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null);

    const created = await seedAgentWriteConfigsForRoles({
      projectId: 'project-1',
      collectionNames: ['posts', 'pages'],
      roles: ['editor'],
      targetBranch: 'main',
      prismaClient,
    });

    expect(created).toBe(1);
    expect(agentWriteConfigCreateMock).toHaveBeenCalledTimes(1);
    expect(agentWriteConfigCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ collectionName: 'pages' }),
    });
  });
});
