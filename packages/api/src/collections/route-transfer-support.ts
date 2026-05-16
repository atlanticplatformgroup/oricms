import type { Request, Response } from 'express';
import { ensureResourceNotLocked } from '../locks/middleware';
import { getEntryBranchTransferServiceForProject } from './route-bootstrap';
import { getRequestActor, type EntryBranchTransferApplyPayload } from './route-common';

export async function previewEntryBranchTransferOrRespond(
  projectId: string,
  collectionId: string,
  id: string,
  sourceBranch: string,
  targetBranch: string,
  res: Response,
) {
  const initialized = await getEntryBranchTransferServiceForProject(projectId, res);
  if (!initialized) {
    return null;
  }

  return initialized.service.preview(collectionId, id, sourceBranch, targetBranch);
}

export async function applyEntryBranchTransferOrRespond(
  req: Request,
  res: Response,
  projectId: string,
  collectionId: string,
  id: string,
  payload: EntryBranchTransferApplyPayload,
) {
  const initialized = await getEntryBranchTransferServiceForProject(projectId, res);
  if (!initialized) {
    return null;
  }

  if (!(await ensureResourceNotLocked(req, res, {
    projectId,
    branch: payload.targetBranch,
    resourceType: 'bulkMutation',
    resourceId: `${collectionId}/${id}`,
  }))) {
    return null;
  }

  const actor = getRequestActor(req);

  return initialized.service.apply(collectionId, id, payload, {
    name: actor.name || 'OriCMS User',
    email: actor.email || 'system@oricms.local',
  });
}
