import type { AgentWriteMode, PrismaClient } from '@prisma/client';
import { ROLE_PERMISSION_MATRIX, type ProjectRole } from '@ori/shared';
import { prisma } from '../lib/prisma';

type AgentWriteConfigPrismaClient = Pick<PrismaClient, 'agentAccess' | 'agentWriteConfig' | 'projectMember'>;
type AgentWriteConfigCreateClient = Pick<PrismaClient, 'agentWriteConfig'>;

export interface AgentCollectionWriteDefaults {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function getAgentCollectionWriteDefaultsForRoles(roles: ProjectRole[]): AgentCollectionWriteDefaults | null {
  const defaults = roles.reduce<AgentCollectionWriteDefaults>(
    (acc, role) => {
      const collectionPermissions = ROLE_PERMISSION_MATRIX[role]?.collections ?? {};
      return {
        canCreate: acc.canCreate || Boolean(collectionPermissions.create),
        canUpdate: acc.canUpdate || Boolean(collectionPermissions.update),
        canDelete: acc.canDelete || Boolean(collectionPermissions.delete),
      };
    },
    { canCreate: false, canUpdate: false, canDelete: false },
  );

  if (!defaults.canCreate && !defaults.canUpdate && !defaults.canDelete) {
    return null;
  }

  return defaults;
}

export async function seedAgentWriteConfigsForRoles(params: {
  collectionNames: string[];
  projectId: string;
  roles: ProjectRole[];
  targetBranch: string;
  prismaClient?: AgentWriteConfigCreateClient;
}): Promise<number> {
  const {
    collectionNames,
    projectId,
    roles,
    targetBranch,
    prismaClient = prisma,
  } = params;
  const uniqueCollectionNames = Array.from(new Set(collectionNames)).filter(Boolean);
  const defaults = getAgentCollectionWriteDefaultsForRoles(roles);

  if (!defaults || uniqueCollectionNames.length === 0) {
    return 0;
  }

  let writeConfigsCreated = 0;
  for (const collectionName of uniqueCollectionNames) {
    const existingWriteConfig = await prismaClient.agentWriteConfig.findUnique({
      where: {
        projectId_collectionName: {
          projectId,
          collectionName,
        },
      },
    });

    if (existingWriteConfig) {
      continue;
    }

    await prismaClient.agentWriteConfig.create({
      data: {
        projectId,
        collectionName,
        mode: 'AUTO_PUBLISH' satisfies AgentWriteMode,
        targetBranch,
        canCreate: defaults.canCreate,
        canUpdate: defaults.canUpdate,
        canDelete: defaults.canDelete,
        allowedFields: [],
        blockedFields: [],
        maxWritesPerHour: 50,
        maxFieldsPerChange: 25,
        requireValidation: true,
      },
    });
    writeConfigsCreated += 1;
  }

  return writeConfigsCreated;
}

export async function seedAgentWriteConfigsForProjectAgents(params: {
  collectionNames: string[];
  existingCollectionNames?: string[];
  projectId: string;
  targetBranch: string;
  prismaClient?: AgentWriteConfigPrismaClient;
}): Promise<number> {
  const {
    collectionNames,
    existingCollectionNames = [],
    projectId,
    targetBranch,
    prismaClient = prisma,
  } = params;

  if (collectionNames.length === 0) {
    return 0;
  }

  const agentAccess = await prismaClient.agentAccess.findUnique({
    where: { projectId },
    select: { enabled: true, allowedCollections: true },
  });

  if (!agentAccess?.enabled) {
    return 0;
  }

  const allowedCollections = agentAccess.allowedCollections ?? [];
  const hadAccessToEveryExistingCollection = existingCollectionNames.length > 0
    && existingCollectionNames.every((collectionName) => allowedCollections.includes(collectionName));
  const shouldExtendAllowlist = allowedCollections.length === 0 || hadAccessToEveryExistingCollection;

  if (shouldExtendAllowlist) {
    const nextAllowedCollections = Array.from(new Set([...allowedCollections, ...collectionNames])).filter(Boolean);
    await prismaClient.agentAccess.update({
      where: { projectId },
      data: { allowedCollections: nextAllowedCollections },
    });
  }

  const agentMembers = await prismaClient.projectMember.findMany({
    where: { projectId, userType: 'AGENT' },
    select: { role: true },
  });
  const roles = agentMembers.map((member) => member.role as ProjectRole);

  return seedAgentWriteConfigsForRoles({
    collectionNames,
    projectId,
    roles,
    targetBranch,
    prismaClient,
  });
}
