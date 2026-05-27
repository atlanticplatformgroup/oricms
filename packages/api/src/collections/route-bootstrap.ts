import { prisma } from '../lib/prisma';
import { CollectionService } from './service';
import { EntryBranchTransferService } from './entry-branch-transfer';
import type { CollectionMutationContext } from '../application/collections/types';
import type { EntryMutationContext } from '../application/entries/types';
import { getRequestActor, respondProjectNotFound, type ProjectRecord } from './route-common';

export async function getProjectOrRespond(projectId: string, res: Parameters<typeof respondProjectNotFound>[0]): Promise<ProjectRecord | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, repoUrl: true, defaultBranch: true },
  });

  if (!project) {
    respondProjectNotFound(res);
    return null;
  }

  return project;
}

export async function getCollectionServiceForProject(
  projectId: string,
  res: Parameters<typeof respondProjectNotFound>[0],
  branch?: string,
): Promise<{ project: ProjectRecord; service: CollectionService } | null> {
  const project = await getProjectOrRespond(projectId, res);
  if (!project) {
    return null;
  }

  const service = new CollectionService({
    projectId,
    repoUrl: project.repoUrl ?? '',
    branch: branch || project.defaultBranch,
  });
  await service.init();

  return { project, service };
}

export async function getEntryBranchTransferServiceForProject(
  projectId: string,
  res: Parameters<typeof respondProjectNotFound>[0],
): Promise<{ project: ProjectRecord; service: EntryBranchTransferService } | null> {
  const project = await getProjectOrRespond(projectId, res);
  if (!project) {
    return null;
  }

  return {
    project,
    service: new EntryBranchTransferService(projectId),
  };
}

export function buildCollectionMutationContext(
  req: Parameters<typeof getRequestActor>[0],
  projectId: string,
  project: ProjectRecord,
): CollectionMutationContext {
  return {
    projectId,
    repoUrl: project.repoUrl ?? '',
    branch: project.defaultBranch,
    actor: getRequestActor(req),
  };
}

export function buildEntryMutationContext(
  req: Parameters<typeof getRequestActor>[0],
  projectId: string,
  collectionId: string,
  project: ProjectRecord,
): EntryMutationContext {
  return {
    ...buildCollectionMutationContext(req, projectId, project),
    collectionId,
  };
}

export async function getEntryMutationContextForProject(
  req: Parameters<typeof getRequestActor>[0],
  projectId: string,
  collectionId: string,
  res: Parameters<typeof respondProjectNotFound>[0],
): Promise<EntryMutationContext | null> {
  const project = await getProjectOrRespond(projectId, res);
  if (!project) {
    return null;
  }

  return buildEntryMutationContext(req, projectId, collectionId, project);
}
