import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findManyBuildsMock,
  countBuildsMock,
  findFirstBuildMock,
  findManyMembersMock,
  findUniqueMemberMock,
} = vi.hoisted(() => ({
  findManyBuildsMock: vi.fn(),
  countBuildsMock: vi.fn(),
  findFirstBuildMock: vi.fn(),
  findManyMembersMock: vi.fn(),
  findUniqueMemberMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    build: {
      findMany: (...args: unknown[]) => findManyBuildsMock(...args),
      count: (...args: unknown[]) => countBuildsMock(...args),
      findFirst: (...args: unknown[]) => findFirstBuildMock(...args),
    },
    projectMember: {
      findMany: (...args: unknown[]) => findManyMembersMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMemberMock(...args),
    },
  },
}));

import type { SystemResourceContext } from '../system-resources';
import { RESOURCE_COLLECTION_IDS } from '../system-resources';
import { getSystemRecord, listSystemRecords } from '../system-resource-records';
import { getSystemResourceSchema } from '../system-resource-schemas';

function createContext(overrides: Partial<SystemResourceContext> = {}): SystemResourceContext {
  return {
    projectId: 'project-1',
    role: 'owner',
    project: {
      id: 'project-1',
      name: 'Project One',
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: {
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    },
    workspacePath: '/tmp/oricms-workspace',
    assetService: {
      listAssets: vi.fn(),
      getAsset: vi.fn(),
    } as unknown as SystemResourceContext['assetService'],
    ...overrides,
  };
}

describe('system resource support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns schema documents for schema-backed collections', async () => {
    const context = createContext();

    await expect(getSystemResourceSchema(context, RESOURCE_COLLECTION_IDS.settings)).resolves.toEqual({
      id: 'project.settings',
      label: 'Project Settings',
      kind: 'settings',
      document: { type: 'project.settings', schemaId: 'project.settings' },
    });

    await expect(getSystemResourceSchema(context, RESOURCE_COLLECTION_IDS.schemaTypes)).resolves.toEqual({
      id: 'content-type-v1',
      label: 'Content Type Schema',
      kind: 'content-type',
      document: { path: '/tmp/oricms-workspace/schemas/types' },
    });
  });

  it('lists project settings as a singleton record', async () => {
    const result = await listSystemRecords(createContext(), RESOURCE_COLLECTION_IDS.settings);

    expect(result).toEqual({
      records: [
        {
          id: 'project-settings',
          label: 'Project Settings',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      total: 1,
    });
  });

  it('lists build records with pagination and build metadata', async () => {
    findManyBuildsMock.mockResolvedValue([
      {
        id: 'build-2',
        branch: 'release',
        commitMessage: null,
        status: 'success',
        createdAt: new Date('2026-03-03T00:00:00.000Z'),
        updatedAt: new Date('2026-03-03T01:00:00.000Z'),
      },
    ]);
    countBuildsMock.mockResolvedValue(7);

    const result = await listSystemRecords(createContext(), RESOURCE_COLLECTION_IDS.builds, {
      page: 2,
      limit: 1,
    });

    expect(findManyBuildsMock).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      orderBy: { createdAt: 'desc' },
      take: 1,
      skip: 1,
    });
    expect(result).toEqual({
      records: [
        {
          id: 'build-2',
          label: 'release build',
          status: 'success',
          description: 'release',
          createdAt: '2026-03-03T00:00:00.000Z',
          updatedAt: '2026-03-03T01:00:00.000Z',
        },
      ],
      total: 7,
    });
  });

  it('returns project settings detail with project metadata', async () => {
    const result = await getSystemRecord(createContext(), RESOURCE_COLLECTION_IDS.settings, 'project-settings');

    expect(result).toEqual({
      id: 'project-settings',
      label: 'Project Settings',
      data: {
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      meta: {
        projectId: 'project-1',
      },
    });
  });

  it('returns build record detail when the build exists', async () => {
    findFirstBuildMock.mockResolvedValue({
      id: 'build-9',
      branch: 'main',
      commitMessage: 'Ship it',
      status: 'queued',
      createdAt: new Date('2026-03-04T00:00:00.000Z'),
      updatedAt: new Date('2026-03-04T00:05:00.000Z'),
    });

    const result = await getSystemRecord(createContext(), RESOURCE_COLLECTION_IDS.builds, 'build-9');

    expect(findFirstBuildMock).toHaveBeenCalledWith({
      where: {
        id: 'build-9',
        projectId: 'project-1',
      },
    });
    expect(result).toMatchObject({
      id: 'build-9',
      label: 'Ship it',
      status: 'queued',
      createdAt: '2026-03-04T00:00:00.000Z',
      updatedAt: '2026-03-04T00:05:00.000Z',
    });
  });
});
