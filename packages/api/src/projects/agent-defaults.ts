import type { AgentWriteMode, PrismaClient } from '@prisma/client';
import { ROLE_PERMISSION_MATRIX, type ProjectRole } from '@ori/shared';
import { CollectionService } from '../collections/service';
import { prisma } from '../lib/prisma';

type BootstrapPrismaClient = Pick<PrismaClient, 'project' | 'agentAccess' | 'agentWriteConfig'>;

export interface BootstrapAgentDefaultsResult {
  defaultBranch: string;
  allowedCollections: string[];
  writeConfigsCreated: number;
}

export async function bootstrapAgentProjectDefaults(params: {
  projectId: string;
  role: ProjectRole;
  createdBy?: string | null;
  prismaClient?: BootstrapPrismaClient;
}): Promise<BootstrapAgentDefaultsResult> {
  const {
    projectId,
    role,
    createdBy,
    prismaClient = prisma,
  } = params;

  const project = await prismaClient.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      defaultBranch: true,
      repoUrl: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const defaultBranch = project.defaultBranch || 'main';
  const collectionService = new CollectionService({
    projectId,
    repoUrl: project.repoUrl ?? '',
    branch: defaultBranch,
  });

  await collectionService.init();
  const collections = await collectionService.listCollections();
  const collectionIds = collections.map((collection) => collection.id);

  const existingAccess = await prismaClient.agentAccess.findUnique({
    where: { projectId },
  });

  const allowedBranches = existingAccess?.allowedBranches?.length
    ? existingAccess.allowedBranches
    : [defaultBranch];
  const allowedCollections = existingAccess?.allowedCollections?.length
    ? existingAccess.allowedCollections
    : collectionIds;

  await prismaClient.agentAccess.upsert({
    where: { projectId },
    create: {
      projectId,
      enabled: true,
      allowedBranches,
      allowedCollections,
      historyDepth: 30,
      historyDays: 14,
      deploymentMode: 'cloud',
      ...(createdBy ? { createdBy } : {}),
    },
    update: {
      enabled: true,
      allowedBranches,
      allowedCollections,
    },
  });

  const collectionPermissions = ROLE_PERMISSION_MATRIX[role].collections;
  const canCreate = Boolean(collectionPermissions.create);
  const canUpdate = Boolean(collectionPermissions.update);
  const canDelete = Boolean(collectionPermissions.delete);

  if (!canCreate && !canUpdate && !canDelete) {
    return {
      defaultBranch,
      allowedCollections,
      writeConfigsCreated: 0,
    };
  }

  let writeConfigsCreated = 0;
  for (const collectionId of collectionIds) {
    const existingWriteConfig = await prismaClient.agentWriteConfig.findUnique({
      where: {
        projectId_collectionName: {
          projectId,
          collectionName: collectionId,
        },
      },
    });

    if (existingWriteConfig) {
      continue;
    }

    await prismaClient.agentWriteConfig.create({
      data: {
        projectId,
        collectionName: collectionId,
        mode: 'AUTO_PUBLISH' satisfies AgentWriteMode,
        targetBranch: defaultBranch,
        canCreate,
        canUpdate,
        canDelete,
        allowedFields: [],
        blockedFields: [],
        maxWritesPerHour: 50,
        maxFieldsPerChange: 25,
        requireValidation: true,
      },
    });
    writeConfigsCreated += 1;
  }

  return {
    defaultBranch,
    allowedCollections,
    writeConfigsCreated,
  };
}
