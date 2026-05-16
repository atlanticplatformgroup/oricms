import type { AgentChangeRequest } from '@prisma/client';
import type { AgentMutationResult, CollectionEntry } from '@ori/shared';
import { apiServices } from '../lib/api-services';
import type { PreparedAgentMutation, InternalAction } from './mutation-types';
import { computeEntryRevision, toEntryStatus } from './mutation-utils';

export async function resolveIdempotentReplay(params: {
  projectId: string;
  agentTokenId: string;
  action: InternalAction;
  idempotencyKey?: string;
  payloadFingerprint: string;
}): Promise<
  | { kind: 'none' }
  | { kind: 'replay'; result: AgentMutationResult }
  | { kind: 'conflict'; message: string }
> {
  const { projectId, agentTokenId, action, idempotencyKey, payloadFingerprint } = params;
  if (!idempotencyKey) {
    return { kind: 'none' };
  }

  const existing = await apiServices.prisma.agentChangeRequest.findFirst({
    where: {
      projectId,
      agentTokenId,
      action,
      idempotencyKey,
    },
    orderBy: { requestedAt: 'desc' },
  });

  if (!existing) {
    return { kind: 'none' };
  }

  if (existing.payloadFingerprint && existing.payloadFingerprint !== payloadFingerprint) {
    return { kind: 'conflict', message: 'Idempotency key was already used for a different mutation payload' };
  }

  if (!existing.resultData) {
    return { kind: 'conflict', message: 'A matching idempotent mutation is still being processed' };
  }

  return { kind: 'replay', result: existing.resultData as unknown as AgentMutationResult };
}

export function buildAgentMutationResult(params: {
  prepared: PreparedAgentMutation;
  changeRequest: Pick<AgentChangeRequest, 'id' | 'status' | 'commitSha'>;
  message: string;
  persistedEntry?: CollectionEntry | null;
  persistedEntryId?: string;
}): AgentMutationResult {
  const { prepared, changeRequest, message, persistedEntry, persistedEntryId } = params;
  const resolvedEntryId = persistedEntryId
    ?? prepared.entryId
    ?? (persistedEntry?.$id ? String(persistedEntry.$id) : undefined);
  const persisted = changeRequest.status === 'AUTO_PUBLISHED';

  return {
    ...prepared.freshness,
    action: prepared.action,
    collectionName: prepared.collectionName,
    ...(resolvedEntryId ? { entryId: resolvedEntryId } : {}),
    branch: prepared.targetBranch,
    resultingStatus: persisted
      ? toEntryStatus(persistedEntry?.$status)
      : (prepared.resultingStatus ?? null),
    changeRequest: {
      id: changeRequest.id,
      status: changeRequest.status,
      message,
    },
    persistence: {
      persisted,
      commitSha: changeRequest.commitSha ?? null,
      revision: persistedEntry ? computeEntryRevision(persistedEntry) : null,
    },
    ...(persisted ? { entry: persistedEntry ?? null } : {}),
    ...(!persisted && prepared.proposedEntry ? { proposedEntry: prepared.proposedEntry } : {}),
    ...(prepared.deletedEntry
      ? {
          deletedEntry: {
            entryId: prepared.entryId ?? String(prepared.deletedEntry.$id ?? ''),
            previousStatus: toEntryStatus(prepared.deletedEntry.$status),
            previousEntry: prepared.deletedEntry,
          },
        }
      : {}),
  };
}

export async function storeAgentMutationResult(changeRequestId: string, result: AgentMutationResult): Promise<void> {
  await apiServices.prisma.agentChangeRequest.update({
    where: { id: changeRequestId },
    data: {
      resultData: result as unknown as object,
    },
  });
}
