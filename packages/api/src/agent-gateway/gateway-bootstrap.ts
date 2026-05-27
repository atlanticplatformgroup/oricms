import type {
  AgentAccessConfig,
  CollectionConfig,
  ProjectRole,
} from '@ori/shared';
import { prisma } from '../lib/prisma';
import { CollectionService } from '../collections/service';
import { isCollectionAllowed } from './filter';
import { canReadAgentSchemas } from './roles';

export async function createGatewayCollectionService(
  projectId: string,
  branch: string,
): Promise<CollectionService> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      repoUrl: true,
    },
  });
  if (!project) {
    throw new Error('Project not found');
  }

  const service = new CollectionService({
    projectId: project.id,
    repoUrl: project.repoUrl ?? '',
    branch,
  });
  await service.init();
  return service;
}

export async function loadGatewaySessionBootstrapInputs(input: {
  projectId: string;
  selectedBranch: string;
  projectRole: ProjectRole;
  config: AgentAccessConfig;
  hasPermission: (
    resource: 'schemas' | 'assets' | 'settings' | 'members' | 'agents' | 'contentTypes' | 'collections',
    action: 'create' | 'read' | 'update' | 'delete' | 'publish',
  ) => boolean;
  getCollectionService: (branch: string) => Promise<CollectionService>;
}): Promise<{
  project: { id: string; name: string };
  allowedCollectionConfigs: CollectionConfig[];
  writeConfigs: Array<{
    collectionName: string;
    mode: string;
    targetBranch: string | null;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    updatedAt: Date;
  }>;
}> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, name: true },
  });
  if (!project) {
    throw new Error('Project not found');
  }

  const canReadSchemas = canReadAgentSchemas(input.projectRole);
  const canReadCollections = input.hasPermission('collections', 'read');
  const collectionConfigs = canReadSchemas || canReadCollections
    ? await (async () => {
        const service = await input.getCollectionService(input.selectedBranch);
        return service.listCollections();
      })()
    : [];

  const allowedCollectionConfigs = collectionConfigs.filter((collection) =>
    isCollectionAllowed(collection.id, input.config),
  );

  const writeConfigs = await prisma.agentWriteConfig.findMany({
    where: {
      projectId: input.projectId,
      collectionName: { in: allowedCollectionConfigs.map((collection) => collection.id) },
    },
    orderBy: { collectionName: 'asc' },
  });

  return {
    project,
    allowedCollectionConfigs,
    writeConfigs,
  };
}
