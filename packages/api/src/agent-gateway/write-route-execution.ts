import type { Request } from 'express';
import { prisma } from '../lib/prisma';
import { tryAutoPublishChange } from '../application/agent-publish/auto-publish-change';
import {
  AGENT_CONFIRMATION_HEADER,
  assertConfirmationToken,
  buildAgentMutationResult,
  resolveIdempotentReplay,
  storeAgentMutationResult,
  type PreparedAgentMutation,
} from './mutations';
import type { AgentMutationResult } from '@ori/shared';
import { getIdempotencyKey } from './write-route-common';

async function enforceWriteRateLimit(agentTokenId: string, maxWritesPerHour: number): Promise<boolean> {
  const recentWrites = await prisma.agentChangeRequest.count({
    where: {
      agentTokenId,
      requestedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  return recentWrites < maxWritesPerHour;
}

export async function executePreparedMutation(
  req: Request,
  prepared: PreparedAgentMutation,
  idempotencyKey?: string,
): Promise<AgentMutationResult> {
  const projectId = req.projectId!;
  const agentTokenId = req.agentTokenId!;
  const principalId = req.userId!;
  const gateway = req.agentGateway!;

  const replay = await resolveIdempotentReplay({
    projectId,
    agentTokenId,
    action: prepared.internalAction,
    idempotencyKey,
    payloadFingerprint: prepared.payloadFingerprint,
  });

  if (replay.kind === 'replay') {
    return replay.result;
  }
  if (replay.kind === 'conflict') {
    throw new Error(`IDEMPOTENCY_CONFLICT:${replay.message}`);
  }

  if (!(await enforceWriteRateLimit(agentTokenId, prepared.writeConfig.maxWritesPerHour))) {
    throw new Error('RATE_LIMIT_EXCEEDED');
  }

  const confirmation = assertConfirmationToken({
    token: getIdempotencyKey(req.headers[AGENT_CONFIRMATION_HEADER]),
    principalId,
    prepared,
  });
  if (!confirmation.ok) {
    throw new Error(`CONFIRMATION_REQUIRED:${confirmation.message}`);
  }

  const changeRequest = await prisma.agentChangeRequest.create({
    data: {
      projectId,
      agentTokenId,
      collectionName: prepared.collectionName,
      entryId: prepared.entryId,
      action: prepared.internalAction,
      before: prepared.currentEntry as object | undefined,
      after: prepared.filteredData as object,
      baseCommitSha: (await gateway.getGitService().getCurrentCommit(projectId)).hash,
      sourceBranch: prepared.targetBranch,
      targetBranch: prepared.targetBranch,
      status: 'PENDING',
      idempotencyKey,
      payloadFingerprint: prepared.payloadFingerprint,
      confirmationRequired: prepared.requiresConfirmation,
      confirmationExpiresAt: prepared.confirmationExpiresAt ? new Date(prepared.confirmationExpiresAt) : undefined,
      confirmedAt: prepared.requiresConfirmation ? new Date() : undefined,
      confirmedByPrincipalId: prepared.requiresConfirmation ? principalId : undefined,
    },
    select: { id: true, status: true, commitSha: true },
  });

  const publishResult = prepared.autoPublish
    ? await tryAutoPublishChange({
        projectId,
        targetBranch: prepared.targetBranch,
        collectionName: prepared.collectionName,
        action: prepared.internalAction,
        changeRequestId: changeRequest.id,
        entryId: prepared.entryId,
        after: prepared.filteredData,
        agentTokenId,
        gateway,
      })
    : {
        status: 'PENDING' as const,
        message: prepared.action === 'delete'
          ? 'Delete request submitted for review'
          : prepared.action === 'transition'
            ? 'Status change submitted for review'
            : 'Change submitted for review',
        entryId: prepared.entryId,
      };

  const changeRequestWithResult = await prisma.agentChangeRequest.update({
    where: { id: changeRequest.id },
    data: {
      status: publishResult.status,
      commitSha: publishResult.commitSha ?? null,
      ...(publishResult.entryId ? { entryId: publishResult.entryId } : {}),
    },
    select: { id: true, status: true, commitSha: true },
  });

  const result = buildAgentMutationResult({
    prepared,
    changeRequest: changeRequestWithResult,
    message: publishResult.message,
    persistedEntry: publishResult.entry ?? null,
    persistedEntryId: publishResult.entryId,
  });

  await storeAgentMutationResult(changeRequest.id, result);
  return result;
}
