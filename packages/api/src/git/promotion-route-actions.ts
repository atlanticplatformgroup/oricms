import crypto from 'crypto';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ensureResourceNotLocked } from '../locks/middleware';
import { badRequest, conflict, forbidden, notFound } from '../lib/responses';
import { formatGitError } from './helpers';
import {
  getPromotionRequest,
  hasInvalidPromotionResolution,
  listPromotionRequests,
  promotionResourceId,
  type PromotionResolution,
  type PromotionStatus,
} from './promotion-route-support';
import type { GitService } from './service';

type PromotionActor = {
  id: string;
  name: string;
  email: string;
};

export async function listPromotionRequestsForQuery(
  projectId: string,
  query: Request['query'],
) {
  const sourceBranch = query.sourceBranch ? String(query.sourceBranch) : undefined;
  const targetBranch = query.targetBranch ? String(query.targetBranch) : undefined;
  const status = query.status ? (String(query.status) as PromotionStatus) : undefined;
  const limit = query.limit ? Number.parseInt(String(query.limit), 10) : 20;

  return {
    requests: await listPromotionRequests(projectId, {
      sourceBranch,
      targetBranch,
      status,
      limit,
    }),
  };
}

export async function createPromotionRequestOrRespond(
  req: Request,
  res: Response,
  projectId: string,
  actor: PromotionActor,
  payload: { sourceBranch: string; targetBranch: string; reason?: string },
) {
  if (!(await ensureResourceNotLocked(req, res, {
    projectId,
    resourceType: 'branchPromotion',
    resourceId: promotionResourceId(payload.sourceBranch, payload.targetBranch),
  }))) {
    return null;
  }

  const requestId = crypto.randomUUID();
  await prisma.auditLog.create({
    data: {
      projectId,
      userId: actor.id,
      action: 'promotion.requested',
      resourceType: 'promotion',
      resourceId: requestId,
      newValue: {
        sourceBranch: payload.sourceBranch,
        targetBranch: payload.targetBranch,
        reason: payload.reason || null,
        requestedBy: actor.id,
        requestedByName: actor.name,
      },
    },
  });

  return getPromotionRequest(projectId, requestId);
}

export async function approvePromotionRequestOrRespond(
  req: Request,
  res: Response,
  projectId: string,
  requestId: string,
  actor: PromotionActor,
) {
  const requestRecord = await getPromotionRequest(projectId, requestId);
  if (!requestRecord) {
    notFound(res, 'Promotion request not found');
    return null;
  }
  if (requestRecord.status !== 'pending') {
    conflict(res, `Cannot approve request in status "${requestRecord.status}"`, 'INVALID_STATE');
    return null;
  }
  if (!(await ensureResourceNotLocked(req, res, {
    projectId,
    resourceType: 'branchPromotion',
    resourceId: promotionResourceId(requestRecord.sourceBranch, requestRecord.targetBranch),
  }))) {
    return null;
  }

  await prisma.auditLog.create({
    data: {
      projectId,
      userId: actor.id,
      action: 'promotion.approved',
      resourceType: 'promotion',
      resourceId: requestId,
      newValue: {
        sourceBranch: requestRecord.sourceBranch,
        targetBranch: requestRecord.targetBranch,
        approvedBy: actor.id,
        approvedByName: actor.name,
      },
    },
  });

  return getPromotionRequest(projectId, requestId);
}

export async function rejectPromotionRequestOrRespond(
  req: Request,
  res: Response,
  projectId: string,
  requestId: string,
  actor: PromotionActor,
  reason?: string,
) {
  const requestRecord = await getPromotionRequest(projectId, requestId);
  if (!requestRecord) {
    notFound(res, 'Promotion request not found');
    return null;
  }
  if (requestRecord.status !== 'pending') {
    conflict(res, `Cannot reject request in status "${requestRecord.status}"`, 'INVALID_STATE');
    return null;
  }
  if (!(await ensureResourceNotLocked(req, res, {
    projectId,
    resourceType: 'branchPromotion',
    resourceId: promotionResourceId(requestRecord.sourceBranch, requestRecord.targetBranch),
  }))) {
    return null;
  }

  await prisma.auditLog.create({
    data: {
      projectId,
      userId: actor.id,
      action: 'promotion.rejected',
      resourceType: 'promotion',
      resourceId: requestId,
      newValue: {
        sourceBranch: requestRecord.sourceBranch,
        targetBranch: requestRecord.targetBranch,
        rejectedBy: actor.id,
        rejectedByName: actor.name,
        reason: reason || null,
      },
    },
  });

  return getPromotionRequest(projectId, requestId);
}

export async function getPromotionConflictFile(
  gitService: GitService,
  projectId: string,
  sourceBranch: string,
  targetBranch: string,
  filePath: string,
) {
  const [sourceContent, targetContent] = await Promise.all([
    gitService.getFileAtBranch(projectId, sourceBranch, filePath),
    gitService.getFileAtBranch(projectId, targetBranch, filePath),
  ]);

  return {
    path: filePath,
    sourceBranch,
    targetBranch,
    sourceContent: sourceContent ?? '',
    targetContent: targetContent ?? '',
  };
}

export async function resolvePromotionConflictsOrRespond(
  req: Request,
  res: Response,
  gitService: GitService,
  projectId: string,
  actor: PromotionActor,
  payload: {
    sourceBranch: string;
    targetBranch: string;
    resolutions: PromotionResolution[];
  },
) {
  if (!(await ensureResourceNotLocked(req, res, {
    projectId,
    resourceType: 'branchPromotion',
    resourceId: promotionResourceId(payload.sourceBranch, payload.targetBranch),
  }))) {
    return null;
  }

  if (hasInvalidPromotionResolution(payload.resolutions)) {
    badRequest(res, 'Invalid conflict resolution entry');
    return null;
  }

  return gitService.applyConflictResolutions(
    projectId,
    payload.sourceBranch,
    payload.targetBranch,
    payload.resolutions,
    {
      message: `Resolve promotion conflicts ${payload.sourceBranch} -> ${payload.targetBranch}`,
      author: { name: actor.name, email: actor.email },
    },
  );
}

export async function promoteBranchesOrRespond(
  req: Request,
  res: Response,
  gitService: GitService,
  projectId: string,
  actor: PromotionActor,
  payload: { sourceBranch: string; targetBranch: string; approvalId: string; message?: string },
) {
  if (!(await ensureResourceNotLocked(req, res, {
    projectId,
    resourceType: 'branchPromotion',
    resourceId: promotionResourceId(payload.sourceBranch, payload.targetBranch),
  }))) {
    return null;
  }

  const approval = await getPromotionRequest(projectId, payload.approvalId);
  if (!approval) {
    notFound(res, 'Promotion approval request not found', 'APPROVAL_NOT_FOUND');
    return null;
  }
  if (approval.status !== 'approved') {
    forbidden(res, 'Promotion requires an approved request', 'APPROVAL_REQUIRED');
    return null;
  }
  if (approval.sourceBranch !== payload.sourceBranch || approval.targetBranch !== payload.targetBranch) {
    badRequest(res, 'Approval request does not match source/target branches', 'APPROVAL_BRANCH_MISMATCH');
    return null;
  }

  try {
    const mergeCommit = await gitService.promoteBranch(projectId, payload.sourceBranch, payload.targetBranch, {
      message: payload.message || `Promote ${payload.sourceBranch} -> ${payload.targetBranch}`,
      author: { name: actor.name, email: actor.email },
    });
    const comparison = await gitService.compareBranches(projectId, payload.targetBranch, payload.sourceBranch);
    await prisma.auditLog.create({
      data: {
        projectId,
        userId: actor.id,
        action: 'promotion.consumed',
        resourceType: 'promotion',
        resourceId: payload.approvalId,
        newValue: {
          sourceBranch: payload.sourceBranch,
          targetBranch: payload.targetBranch,
          mergeCommit: mergeCommit.hash,
          consumedBy: actor.id,
          consumedByName: actor.name,
        },
      },
    });

    return {
      sourceBranch: payload.sourceBranch,
      targetBranch: payload.targetBranch,
      approvalId: payload.approvalId,
      mergeCommit,
      comparison,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('MERGE_CONFLICT')) {
      const [, rawFiles] = message.split(':', 2);
      const conflictedFiles = rawFiles ? rawFiles.split(',').map((file) => file.trim()).filter(Boolean) : [];
      conflict(res, 'Merge conflict detected while promoting branches', 'MERGE_CONFLICT', { conflictedFiles });
      return null;
    }

    throw Object.assign(error instanceof Error ? error : new Error('Git promotion failed'), {
      formattedGitError: formatGitError(error),
    });
  }
}
