import { prisma } from '../lib/prisma';

export type PromotionStatus = 'pending' | 'approved' | 'consumed' | 'rejected';

export interface PromotionRequestRecord {
  id: string;
  sourceBranch: string;
  targetBranch: string;
  requestedBy?: string;
  requestedByName?: string;
  requestedAt: string;
  status: PromotionStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  consumedAt?: string;
  mergeCommit?: string;
}

export type PromotionResolution = {
  path: string;
  strategy: 'source' | 'target' | 'manual';
  content?: string;
};

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function promotionResourceId(sourceBranch: string, targetBranch: string): string {
  return `${sourceBranch}->${targetBranch}`;
}

export async function getPromotionRequest(projectId: string, requestId: string): Promise<PromotionRequestRecord | null> {
  const logs = await prisma.auditLog.findMany({
    where: {
      projectId,
      resourceType: 'promotion',
      resourceId: requestId,
      action: { in: ['promotion.requested', 'promotion.approved', 'promotion.rejected', 'promotion.consumed'] },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (logs.length === 0) return null;

  let request: PromotionRequestRecord | null = null;
  for (const log of logs) {
    const payload = toRecord(log.newValue);
    if (log.action === 'promotion.requested') {
      request = {
        id: requestId,
        sourceBranch: String(payload.sourceBranch || ''),
        targetBranch: String(payload.targetBranch || ''),
        requestedBy: typeof payload.requestedBy === 'string' ? payload.requestedBy : undefined,
        requestedByName: typeof payload.requestedByName === 'string' ? payload.requestedByName : undefined,
        requestedAt: log.createdAt.toISOString(),
        status: 'pending',
      };
      continue;
    }

    if (!request) continue;
    if (log.action === 'promotion.approved') {
      request.status = 'approved';
      request.approvedBy = typeof payload.approvedBy === 'string' ? payload.approvedBy : undefined;
      request.approvedByName = typeof payload.approvedByName === 'string' ? payload.approvedByName : undefined;
      request.approvedAt = log.createdAt.toISOString();
    } else if (log.action === 'promotion.rejected') {
      request.status = 'rejected';
      request.rejectedBy = typeof payload.rejectedBy === 'string' ? payload.rejectedBy : undefined;
      request.rejectedByName = typeof payload.rejectedByName === 'string' ? payload.rejectedByName : undefined;
      request.rejectedAt = log.createdAt.toISOString();
    } else if (log.action === 'promotion.consumed') {
      request.status = 'consumed';
      request.consumedAt = log.createdAt.toISOString();
      request.mergeCommit = typeof payload.mergeCommit === 'string' ? payload.mergeCommit : undefined;
    }
  }

  return request;
}

export async function listPromotionRequests(
  projectId: string,
  options: {
    sourceBranch?: string;
    targetBranch?: string;
    status?: PromotionStatus;
    limit: number;
  },
): Promise<PromotionRequestRecord[]> {
  const requestedLogs = await prisma.auditLog.findMany({
    where: { projectId, resourceType: 'promotion', action: 'promotion.requested' },
    orderBy: { createdAt: 'desc' },
    take: options.limit,
  });

  const requests = await Promise.all(
    requestedLogs.map(async (log) => {
      if (!log.resourceId) return null;
      return getPromotionRequest(projectId, log.resourceId);
    }),
  );

  return requests
    .filter((requestRecord): requestRecord is PromotionRequestRecord => Boolean(requestRecord))
    .filter((requestRecord) => !options.sourceBranch || requestRecord.sourceBranch === options.sourceBranch)
    .filter((requestRecord) => !options.targetBranch || requestRecord.targetBranch === options.targetBranch)
    .filter((requestRecord) => !options.status || requestRecord.status === options.status);
}

export function hasInvalidPromotionResolution(resolutions: PromotionResolution[]): boolean {
  return resolutions.some((resolution) => (
    !resolution.path
    || !['source', 'target', 'manual'].includes(resolution.strategy)
    || (resolution.strategy === 'manual' && typeof resolution.content !== 'string')
  ));
}
