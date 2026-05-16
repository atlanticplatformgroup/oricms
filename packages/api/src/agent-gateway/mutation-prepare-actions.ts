import type { AgentWriteConfig } from '@prisma/client';
import type {
  AgentEntryStatus,
  AgentMutationAction,
  AgentMutationPreflightResponse,
  CollectionEntry,
  ContentType,
  LockConflictInfo,
} from '@ori/shared';
import type { AgentGatewayService } from './service';
import { deniedPreflight } from './mutation-prepare-common';
import {
  buildCreatePreview,
  buildTransitionPreview,
  buildUpdatePreview,
  computeEntryRevision,
  toEntryStatus,
  validateRequiredFields,
} from './mutation-utils';

interface BasePreparationParams {
  freshness: {
    generatedAt: string;
    configVersion: string;
    configUpdatedAt?: string;
  };
  action: AgentMutationAction;
  collectionName: string;
  entryId?: string;
  targetBranch: string;
  autoPublish: boolean;
  requiresConfirmation: boolean;
}

interface ActionPreparationState {
  currentEntry?: CollectionEntry | null;
  proposedEntry?: CollectionEntry | null;
  deletedEntry?: CollectionEntry | null;
  resultingStatus?: AgentEntryStatus | null;
  currentRevision?: string;
  lockInfo?: LockConflictInfo;
}

type DeniedActionPreparation = { preflight: AgentMutationPreflightResponse };

function tooManyChangedFieldsDenied(params: BasePreparationParams & { maxFieldsPerChange: number }) {
  return deniedPreflight({
    freshness: params.freshness,
    action: params.action,
    collectionName: params.collectionName,
    entryId: params.entryId,
    branch: params.targetBranch,
    details: { _errors: [`Too many fields changed. Max: ${params.maxFieldsPerChange}`] },
    autoPublish: params.autoPublish,
    requiresConfirmation: params.requiresConfirmation,
  });
}

function validationDenied(params: BasePreparationParams & { details: Record<string, string[]> }) {
  return deniedPreflight({
    freshness: params.freshness,
    action: params.action,
    collectionName: params.collectionName,
    entryId: params.entryId,
    branch: params.targetBranch,
    details: params.details,
    autoPublish: params.autoPublish,
    requiresConfirmation: params.requiresConfirmation,
  });
}

export function prepareCreateMutationState(params: BasePreparationParams & {
  filteredData: Record<string, unknown>;
  contentType: ContentType;
}): ActionPreparationState | DeniedActionPreparation {
  const proposedEntry = buildCreatePreview(params.filteredData, params.contentType);
  const validation = validateRequiredFields(proposedEntry, params.contentType, {});
  if (Object.keys(validation).length > 0) {
    return validationDenied({ ...params, details: validation });
  }

  return {
    proposedEntry,
    resultingStatus: toEntryStatus(proposedEntry.$status),
  };
}

export async function loadExistingEntryState(params: BasePreparationParams & {
  gateway: AgentGatewayService;
  baseRevision?: string;
}): Promise<ActionPreparationState | DeniedActionPreparation> {
  const currentEntry = await params.gateway.getCollectionEntry(
    params.collectionName,
    params.entryId ?? '',
    params.targetBranch,
  );

  if (!currentEntry || !params.entryId) {
    return deniedPreflight({
      freshness: params.freshness,
      action: params.action,
      collectionName: params.collectionName,
      entryId: params.entryId,
      branch: params.targetBranch,
      details: { entryId: ['Entry not found'] },
      autoPublish: params.autoPublish,
      requiresConfirmation: params.requiresConfirmation,
    });
  }

  const currentRevision = computeEntryRevision(currentEntry);
  if (params.baseRevision && params.baseRevision !== currentRevision) {
    return deniedPreflight({
      freshness: params.freshness,
      action: params.action,
      collectionName: params.collectionName,
      entryId: params.entryId,
      branch: params.targetBranch,
      details: { baseRevision: ['The entry changed since this revision was read'] },
      autoPublish: params.autoPublish,
      requiresConfirmation: params.requiresConfirmation,
      currentRevision,
    });
  }

  return {
    currentEntry,
    currentRevision,
    lockInfo: {
      required: false,
      mode: 'soft',
      heldByOther: false,
    },
  };
}

export function prepareUpdateMutationState(params: BasePreparationParams & {
  currentEntry: CollectionEntry;
  filteredData: Record<string, unknown>;
  contentType: ContentType;
  writeConfig: Pick<AgentWriteConfig, 'maxFieldsPerChange'>;
}): ActionPreparationState | DeniedActionPreparation {
  if (Object.keys(params.filteredData).length > params.writeConfig.maxFieldsPerChange) {
    return tooManyChangedFieldsDenied({ ...params, maxFieldsPerChange: params.writeConfig.maxFieldsPerChange });
  }

  const proposedEntry = buildUpdatePreview(params.currentEntry, params.filteredData);
  const validation = validateRequiredFields(proposedEntry, params.contentType, {});
  if (Object.keys(validation).length > 0) {
    return validationDenied({ ...params, details: validation });
  }

  return {
    proposedEntry,
    resultingStatus: toEntryStatus(proposedEntry.$status),
  };
}

export function prepareDeleteMutationState(params: {
  currentEntry: CollectionEntry;
}): ActionPreparationState {
  return {
    deletedEntry: params.currentEntry,
    resultingStatus: null,
  };
}

export function prepareTransitionMutationState(params: BasePreparationParams & {
  currentEntry: CollectionEntry;
  targetStatus?: AgentEntryStatus;
}): ActionPreparationState | DeniedActionPreparation {
  if (!params.targetStatus) {
    return deniedPreflight({
      freshness: params.freshness,
      action: params.action,
      collectionName: params.collectionName,
      entryId: params.entryId,
      branch: params.targetBranch,
      details: { targetStatus: ['A target status is required'] },
      autoPublish: params.autoPublish,
      requiresConfirmation: params.requiresConfirmation,
    });
  }

  const currentStatus = toEntryStatus(params.currentEntry.$status);
  if (!currentStatus) {
    return deniedPreflight({
      freshness: params.freshness,
      action: params.action,
      collectionName: params.collectionName,
      entryId: params.entryId,
      branch: params.targetBranch,
      details: { targetStatus: ['Entry has no valid current workflow status'] },
      autoPublish: params.autoPublish,
      requiresConfirmation: params.requiresConfirmation,
    });
  }

  if (currentStatus === params.targetStatus) {
    return deniedPreflight({
      freshness: params.freshness,
      action: params.action,
      collectionName: params.collectionName,
      entryId: params.entryId,
      branch: params.targetBranch,
      details: { targetStatus: [`Entry is already in '${params.targetStatus}'`] },
      autoPublish: params.autoPublish,
      requiresConfirmation: params.requiresConfirmation,
    });
  }

  return {
    proposedEntry: buildTransitionPreview(params.currentEntry, params.targetStatus),
    resultingStatus: params.targetStatus,
  };
}
