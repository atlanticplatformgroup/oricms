import path from 'path';
import type { ContentType, ResourceRecordDetail, ResourceRecordSummary } from '@ori/shared';
import { prisma } from '../lib/prisma';
import { readJsonFiles } from './system-resource-support';
import { RESOURCE_COLLECTION_IDS, type SystemResourceContext } from './system-resources';

function getSettingsUpdatedAt(settings: unknown): string | undefined {
  if (
    settings &&
    typeof settings === 'object' &&
    !Array.isArray(settings) &&
    typeof (settings as Record<string, unknown>).updatedAt === 'string'
  ) {
    return String((settings as Record<string, unknown>).updatedAt);
  }

  return undefined;
}

function toComponentSchemaSummary(schema: Record<string, unknown>): ResourceRecordSummary {
  return {
    id: typeof schema.$id === 'string' ? schema.$id : String(schema.name || 'component'),
    label: typeof schema.label === 'string' ? schema.label : String(schema.name || schema.$id || 'Component'),
    description: typeof schema.description === 'string' ? schema.description : undefined,
  };
}

export async function listSystemRecords(
  context: SystemResourceContext,
  resourceCollectionId: string,
  options: { page?: number; limit?: number } = {},
): Promise<{ records: ResourceRecordSummary[]; total: number } | null> {
  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.settings) {
    return {
      records: [
        {
          id: 'project-settings',
          label: 'Project Settings',
          updatedAt: getSettingsUpdatedAt(context.project.settings),
        },
      ],
      total: 1,
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.members) {
    const members = await prisma.projectMember.findMany({
      where: { projectId: context.projectId },
      include: {
        user: { select: { id: true, name: true, email: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      records: members.map((member) => ({
        id: member.userId,
        label: member.user.name || member.user.email,
        status: member.userType === 'AGENT' ? 'active' : undefined,
        description: member.role,
        createdAt: member.createdAt.toISOString(),
      })),
      total: members.length,
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.builds) {
    const limit = Math.min(options.limit ?? 20, 100);
    const page = Math.max(options.page ?? 1, 1);
    const skip = (page - 1) * limit;
    const [builds, total] = await Promise.all([
      prisma.build.findMany({
        where: { projectId: context.projectId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.build.count({ where: { projectId: context.projectId } }),
    ]);
    return {
      records: builds.map((build) => ({
        id: build.id,
        label: build.commitMessage || `${build.branch} build`,
        status: build.status,
        description: build.branch,
        createdAt: build.createdAt.toISOString(),
        updatedAt: build.updatedAt.toISOString(),
      })),
      total,
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.assets) {
    const limit = Math.min(options.limit ?? 20, 100);
    const page = Math.max(options.page ?? 1, 1);
    const offset = (page - 1) * limit;
    const result = await context.assetService.listAssets(context.projectId, {
      folder: 'all',
      limit,
      offset,
    });
    return {
      records: result.assets.map((asset) => ({
        id: asset.path,
        label: asset.name,
        description: asset.folder,
        updatedAt: asset.lastModified,
        path: asset.path,
      })),
      total: result.pagination.total,
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.schemaTypes) {
    const records = await readJsonFiles<ContentType>(path.join(context.workspacePath, 'schemas', 'types'));
    return {
      records: records.map((schema) => ({
        id: schema.$id,
        label: schema.label,
        description: schema.description,
      })),
      total: records.length,
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.schemaComponents) {
    const records = await readJsonFiles<Record<string, unknown>>(
      path.join(context.workspacePath, 'schemas', 'components'),
    );
    return {
      records: records.map(toComponentSchemaSummary),
      total: records.length,
    };
  }

  return null;
}

export async function getSystemRecord(
  context: SystemResourceContext,
  resourceCollectionId: string,
  recordId: string,
): Promise<ResourceRecordDetail | null> {
  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.settings) {
    return {
      id: 'project-settings',
      label: 'Project Settings',
      data: (context.project.settings || {}) as Record<string, unknown>,
      meta: {
        projectId: context.project.id,
      },
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.members) {
    const member = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: recordId,
          projectId: context.projectId,
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, type: true, avatarUrl: true } },
      },
    });
    if (!member) {
      return null;
    }
    return {
      id: member.userId,
      label: member.user.name || member.user.email,
      description: member.role,
      createdAt: member.createdAt.toISOString(),
      data: {
        id: member.id,
        userId: member.userId,
        role: member.role,
        userType: member.userType,
        user: member.user,
      },
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.builds) {
    const build = await prisma.build.findFirst({
      where: {
        id: recordId,
        projectId: context.projectId,
      },
    });
    if (!build) {
      return null;
    }
    return {
      id: build.id,
      label: build.commitMessage || `${build.branch} build`,
      status: build.status,
      createdAt: build.createdAt.toISOString(),
      updatedAt: build.updatedAt.toISOString(),
      data: build as unknown as Record<string, unknown>,
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.assets) {
    const asset = await context.assetService.getAsset(context.projectId, recordId);
    if (!asset) {
      return null;
    }
    return {
      id: asset.path,
      label: asset.name,
      description: asset.folder,
      updatedAt: asset.lastModified,
      path: asset.path,
      data: asset as unknown as Record<string, unknown>,
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.schemaTypes) {
    const records = await readJsonFiles<ContentType>(path.join(context.workspacePath, 'schemas', 'types'));
    const schema = records.find((entry) => entry.$id === recordId);
    if (!schema) {
      return null;
    }
    return {
      id: schema.$id,
      label: schema.label,
      description: schema.description,
      data: schema as unknown as Record<string, unknown>,
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.schemaComponents) {
    const records = await readJsonFiles<Record<string, unknown>>(
      path.join(context.workspacePath, 'schemas', 'components'),
    );
    const schema = records.find((entry) => String(entry.$id || entry.name) === recordId);
    if (!schema) {
      return null;
    }
    return {
      id: String(schema.$id || schema.name || recordId),
      label: typeof schema.label === 'string' ? schema.label : String(schema.name || recordId),
      description: typeof schema.description === 'string' ? schema.description : undefined,
      data: schema,
    };
  }

  return null;
}
