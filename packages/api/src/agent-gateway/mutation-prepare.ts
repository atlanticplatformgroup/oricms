import type {
  AgentEntryStatus,
  AgentMutationAction,
  AgentMutationPreflightResponse,
  CollectionEntry,
  LockConflictInfo,
} from '@ori/shared';
import { apiServices } from '../lib/api-services';
import type { AgentGatewayService } from './service';
import {
  loadExistingEntryState,
  prepareCreateMutationState,
  prepareDeleteMutationState,
  prepareTransitionMutationState,
  prepareUpdateMutationState,
} from './mutation-prepare-actions';
import {
  buildPreparedMutationResponse,
  deniedPreflight,
  isActionAllowed,
} from './mutation-prepare-common';
import type { PreparedAgentMutation } from './mutation-types';
import {
  filterWritableData,
  getCollectionContext,
  hashPayload,
  makeFreshness,
  mapAction,
} from './mutation-utils';

export async function prepareAgentMutation(params: {
  gateway: AgentGatewayService;
  projectId: string;
  principalId: string;
  collectionName: string;
  action: AgentMutationAction;
  entryId?: string;
  inputData?: Record<string, unknown>;
  targetStatus?: AgentEntryStatus;
  requestedBranch?: string;
  baseRevision?: string;
}): Promise<{ prepared?: PreparedAgentMutation; preflight: AgentMutationPreflightResponse }> {
  const {
    gateway,
    projectId,
    principalId,
    collectionName,
    action,
    entryId,
    inputData = {},
    targetStatus,
    requestedBranch,
    baseRevision,
  } = params;
  const internalAction = mapAction(action);
  const bootstrap = await gateway.getSessionBootstrap(requestedBranch);
  const freshness = makeFreshness(bootstrap);

  const writeConfig = await apiServices.prisma.agentWriteConfig.findUnique({
    where: { projectId_collectionName: { projectId, collectionName } },
  });

  if (!writeConfig) {
    return deniedPreflight({
      freshness,
      action,
      collectionName,
      entryId,
      details: { collectionName: ['Write access is not configured for this collection'] },
      autoPublish: false,
      requiresConfirmation: action === 'delete',
    });
  }

  const targetBranch = writeConfig.targetBranch;
  const autoPublish = writeConfig.mode === 'AUTO_PUBLISH';
  const requiresConfirmation = action === 'delete';

  if (requestedBranch && requestedBranch !== targetBranch) {
    return deniedPreflight({
      freshness,
      action,
      collectionName,
      entryId,
      branch: targetBranch,
      details: { branch: [`Writes for this collection must target branch '${targetBranch}'`] },
      autoPublish,
      requiresConfirmation,
    });
  }

  const disallowedMessage = isActionAllowed({ action, writeConfig });
  if (disallowedMessage) {
    return deniedPreflight({
      freshness,
      action,
      collectionName,
      entryId,
      branch: targetBranch,
      details: { collectionName: [disallowedMessage] },
      autoPublish,
      requiresConfirmation,
    });
  }

  const { contentType } = await getCollectionContext(projectId, targetBranch, collectionName);
  if (!contentType) {
    return deniedPreflight({
      freshness,
      action,
      collectionName,
      entryId,
      branch: targetBranch,
      details: { collectionName: ['Collection or content type not found'] },
      autoPublish,
      requiresConfirmation,
    });
  }

  const filteredData = filterWritableData(inputData, writeConfig);
  let currentEntry: CollectionEntry | null | undefined;
  let proposedEntry: CollectionEntry | null | undefined;
  let deletedEntry: CollectionEntry | null | undefined;
  let resultingStatus: AgentEntryStatus | null | undefined;
  let currentRevision: string | undefined;
  let lockInfo: LockConflictInfo | undefined;

  if (action === 'create') {
    const createState = prepareCreateMutationState({
      freshness,
      action,
      collectionName,
      targetBranch,
      autoPublish,
      requiresConfirmation,
      filteredData,
      contentType,
    });
    if ('preflight' in createState) {
      return createState;
    }
    proposedEntry = createState.proposedEntry;
    resultingStatus = createState.resultingStatus;
  }

  if (action === 'update' || action === 'delete' || action === 'transition') {
    const existingState = await loadExistingEntryState({
      gateway,
      freshness,
      action,
      collectionName,
      entryId,
      targetBranch,
      autoPublish,
      requiresConfirmation,
      baseRevision,
    });
    if ('preflight' in existingState) {
      return existingState;
    }
    currentEntry = existingState.currentEntry;
    currentRevision = existingState.currentRevision;
    lockInfo = existingState.lockInfo;
  }

  if (action === 'update') {
    const updateState = prepareUpdateMutationState({
      freshness,
      action,
      collectionName,
      entryId,
      targetBranch,
      autoPublish,
      requiresConfirmation,
      currentEntry: currentEntry as CollectionEntry,
      filteredData,
      contentType,
      writeConfig,
    });
    if ('preflight' in updateState) {
      return updateState;
    }
    proposedEntry = updateState.proposedEntry;
    resultingStatus = updateState.resultingStatus;
  }

  if (action === 'delete') {
    ({ deletedEntry, resultingStatus } = prepareDeleteMutationState({
      currentEntry: currentEntry as CollectionEntry,
    }));
  }

  if (action === 'transition') {
    const transitionState = prepareTransitionMutationState({
      freshness,
      action,
      collectionName,
      entryId,
      targetBranch,
      autoPublish,
      requiresConfirmation,
      currentEntry: currentEntry as CollectionEntry,
      targetStatus,
    });
    if ('preflight' in transitionState) {
      return transitionState;
    }
    proposedEntry = transitionState.proposedEntry;
    resultingStatus = transitionState.resultingStatus;
  }

  const payloadFingerprint = hashPayload({
    action,
    collectionName,
    entryId: entryId ?? null,
    branch: targetBranch,
    data: filteredData,
    targetStatus: targetStatus ?? null,
    baseRevision: baseRevision ?? null,
  });

  return buildPreparedMutationResponse({
    principalId,
    action,
    internalAction,
    collectionName,
    entryId,
    targetBranch,
    writeConfig,
    currentEntry,
    filteredData,
    proposedEntry,
    deletedEntry,
    resultingStatus,
    currentRevision,
    lockInfo,
    freshness,
    payloadFingerprint,
    requiresConfirmation,
  });
}
