import type { PrismaClient } from '@prisma/client';
import type { ProjectRole } from '@ori/shared';
import { CollectionService } from '../collections/service';
import { prisma } from '../lib/prisma';
import { seedAgentWriteConfigsForRoles } from './agent-write-configs';

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

  const writeConfigsCreated = await seedAgentWriteConfigsForRoles({
    projectId,
    collectionNames: collectionIds,
    roles: [role],
    targetBranch: defaultBranch,
    prismaClient,
  });

  return {
    defaultBranch,
    allowedCollections,
    writeConfigsCreated,
  };
}
