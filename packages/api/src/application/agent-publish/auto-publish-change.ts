import { prisma } from '../../lib/prisma';
import { logger } from '../../middleware/logger';
import type { AgentGatewayService } from '../../agent-gateway/service';
import { createEntry } from '../entries/create-entry';
import { updateEntry } from '../entries/update-entry';
import { deleteEntry } from '../entries/delete-entry';
import type { CollectionEntry } from '@ori/shared';

export interface AutoPublishAuthor {
  name: string;
  email: string;
}

export interface AutoPublishGateway {
  gitService: { getCurrentCommit: (projectId: string) => Promise<{ hash: string }> };
}

export async function tryAutoPublishChange(params: {
  projectId: string;
  targetBranch: string;
  collectionName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSITION';
  changeRequestId: string;
  entryId?: string;
  after: Record<string, unknown>;
  agentTokenId: string;
  gateway: AgentGatewayService | AutoPublishGateway;
}): Promise<{
  status: 'AUTO_PUBLISHED' | 'PENDING';
  message: string;
  entryId?: string;
  entry?: CollectionEntry;
  commitSha?: string;
}> {
  const {
    projectId,
    targetBranch,
    collectionName,
    action,
    changeRequestId,
    entryId,
    after,
    agentTokenId,
    gateway,
  } = params;

  try {
    const author = {
      name: `Agent Token ${agentTokenId.slice(0, 8)}`,
      email: 'agent@oricms.local',
    };

    const mutationContext = {
      projectId,
      collectionId: collectionName,
      repoUrl: '',
      branch: targetBranch,
      actor: {
        id: agentTokenId,
        name: author.name,
        email: author.email,
        kind: 'agent' as const,
      },
    };

    let createdEntryId: string | undefined = entryId;
    let persistedEntry: CollectionEntry | undefined;
    if (action === 'CREATE') {
      const createResult = await createEntry(mutationContext, after);
      const { entryId: nextEntryId } = createResult;
      createdEntryId = nextEntryId;
      persistedEntry = createResult.entry;
    } else if (action === 'UPDATE' || action === 'TRANSITION') {
      if (!entryId) throw new Error('Entry id is required for UPDATE');
      const updateResult = await updateEntry(mutationContext, entryId, after);
      persistedEntry = updateResult.entry;
    } else {
      if (!entryId) throw new Error('Entry id is required for DELETE');
      await deleteEntry(mutationContext, entryId);
    }

    const gitService = gateway instanceof Object && 'getGitService' in gateway
      ? gateway.getGitService()
      : gateway.gitService;
    const commit = await gitService.getCurrentCommit(projectId);

    await prisma.agentChangeRequest.update({
      where: { id: changeRequestId },
      data: {
        status: 'AUTO_PUBLISHED',
        commitSha: commit.hash,
        ...(createdEntryId ? { entryId: createdEntryId } : {}),
      },
    });

    return {
      status: 'AUTO_PUBLISHED',
      entryId: createdEntryId,
      entry: persistedEntry,
      commitSha: commit.hash,
      message:
        action === 'CREATE'
          ? 'Entry created and auto-published'
          : action === 'UPDATE'
            ? 'Entry updated and auto-published'
            : action === 'TRANSITION'
              ? 'Entry status updated and auto-published'
            : 'Entry deleted and auto-published',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown auto-publish error';
    logger.error({
      msg: 'Agent auto-publish failed',
      projectId,
      collectionName,
      action,
      changeRequestId,
      error: message,
    });

    await prisma.agentChangeRequest.update({
      where: { id: changeRequestId },
      data: {
        reviewComment: `Auto-publish failed: ${message}`,
      },
    }).catch(() => {});

    return {
      status: 'PENDING',
      message:
        action === 'DELETE'
          ? 'Delete request submitted for review (auto-publish failed)'
          : action === 'TRANSITION'
            ? 'Status change submitted for review (auto-publish failed)'
          : 'Change submitted for review (auto-publish failed)',
    };
  }
}
