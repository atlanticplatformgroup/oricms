import type { Request, Response } from 'express';
import { PLUGIN_EVENT_NAMES, type CollectionConfig } from '@ori/shared';
import { saveCollectionsConfig } from '../application/collections/save-collections-config';
import { deleteCollection as deleteCollectionMutation } from '../application/collections/delete-collection';
import { createEntry } from '../application/entries/create-entry';
import { updateEntry } from '../application/entries/update-entry';
import { deleteEntry } from '../application/entries/delete-entry';
import { ensureResourceNotLocked } from '../locks/middleware';
import { buildCollectionMutationContext, getEntryMutationContextForProject, getProjectOrRespond } from './route-bootstrap';

export async function updateCollectionsOrRespond(
  req: Request,
  res: Response,
  projectId: string,
  collections: CollectionConfig[],
): Promise<boolean> {
  const project = await getProjectOrRespond(projectId, res);
  if (!project) {
    return false;
  }

  if (!(await ensureResourceNotLocked(req, res, {
    projectId,
    branch: project.defaultBranch,
    resourceType: 'collectionConfig',
    resourceId: 'collections',
  }))) {
    return false;
  }

  await saveCollectionsConfig(
    buildCollectionMutationContext(req, projectId, project),
    collections,
  );

  return true;
}

export async function deleteCollectionOrRespond(
  req: Request,
  res: Response,
  projectId: string,
  collectionId: string,
): Promise<boolean> {
  const project = await getProjectOrRespond(projectId, res);
  if (!project) {
    return false;
  }

  if (!(await ensureResourceNotLocked(req, res, {
    projectId,
    branch: project.defaultBranch,
    resourceType: 'collectionConfig',
    resourceId: collectionId,
  }))) {
    return false;
  }

  await deleteCollectionMutation(
    buildCollectionMutationContext(req, projectId, project),
    collectionId,
  );

  return true;
}

export async function createCollectionEntryOrRespond(
  req: Request,
  res: Response,
  projectId: string,
  collectionId: string,
  data: Record<string, unknown>,
) {
  const mutationContext = await getEntryMutationContextForProject(req, projectId, collectionId, res);
  if (!mutationContext) {
    return null;
  }

  return createEntry(mutationContext, data, {
    plugin: {
      event: PLUGIN_EVENT_NAMES.COLLECTION_RECORD_CREATED,
    },
  });
}

export async function updateCollectionEntryOrRespond(
  req: Request,
  res: Response,
  projectId: string,
  collectionId: string,
  id: string,
  data: Record<string, unknown>,
  baseRevision?: string,
) {
  const mutationContext = await getEntryMutationContextForProject(req, projectId, collectionId, res);
  if (!mutationContext) {
    return null;
  }

  return updateEntry(
    mutationContext,
    id,
    data,
    {
      plugin: {
        event: PLUGIN_EVENT_NAMES.COLLECTION_RECORD_UPDATED,
      },
    },
    undefined,
    baseRevision,
  );
}

export async function deleteCollectionEntryOrRespond(
  req: Request,
  res: Response,
  projectId: string,
  collectionId: string,
  id: string,
  baseRevision?: string,
) {
  const mutationContext = await getEntryMutationContextForProject(req, projectId, collectionId, res);
  if (!mutationContext) {
    return false;
  }

  await deleteEntry(
    mutationContext,
    id,
    {
      plugin: {
        event: PLUGIN_EVENT_NAMES.COLLECTION_RECORD_DELETED,
      },
    },
    undefined,
    baseRevision,
  );

  return true;
}
