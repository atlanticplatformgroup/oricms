import type { AgentWriteConfig } from '@prisma/client';
import type {
  AgentEntryStatus,
  AgentMutationAction,
  AgentMutationPreflightResponse,
  CollectionEntry,
  LockConflictInfo,
} from '@ori/shared';
import type { ValidationErrorDetails } from '../lib/responses';
import { buildConfirmationState } from './mutation-confirmation';
import type { PreparedAgentMutation } from './mutation-types';

export function deniedPreflight(params: {
  freshness: PreparedAgentMutation['freshness'];
  action: AgentMutationAction;
  collectionName: string;
  entryId?: string;
  branch?: string;
  details: ValidationErrorDetails;
  autoPublish: boolean;
  requiresConfirmation: boolean;
  currentRevision?: string;
}): { preflight: AgentMutationPreflightResponse } {
  return {
    preflight: {
      ...params.freshness,
      allowed: false,
      action: params.action,
      collectionName: params.collectionName,
      ...(params.entryId ? { entryId: params.entryId } : {}),
      ...(params.branch ? { branch: params.branch } : {}),
      details: params.details,
      autoPublish: params.autoPublish,
      requiresConfirmation: params.requiresConfirmation,
      ...(params.currentRevision ? { currentRevision: params.currentRevision } : {}),
    },
  };
}

export function isActionAllowed(params: {
  action: AgentMutationAction;
  writeConfig: AgentWriteConfig;
}): string | null {
  if (params.action === 'create' && !params.writeConfig.canCreate) {
    return 'Create is not allowed for this collection';
  }
  if (params.action === 'delete' && !params.writeConfig.canDelete) {
    return 'Delete is not allowed for this collection';
  }
  if ((params.action === 'update' || params.action === 'transition') && !params.writeConfig.canUpdate) {
    return params.action === 'transition'
      ? 'Status transitions are not allowed for this collection'
      : 'Update is not allowed for this collection';
  }
  return null;
}

export function buildPreparedMutationResponse(params: {
  principalId: string;
  action: AgentMutationAction;
  internalAction: PreparedAgentMutation['internalAction'];
  collectionName: string;
  entryId?: string;
  targetBranch: string;
  writeConfig: AgentWriteConfig;
  currentEntry?: CollectionEntry | null;
  filteredData: Record<string, unknown>;
  proposedEntry?: CollectionEntry | null;
  deletedEntry?: CollectionEntry | null;
  resultingStatus?: AgentEntryStatus | null;
  currentRevision?: string;
  lockInfo?: LockConflictInfo;
  freshness: PreparedAgentMutation['freshness'];
  payloadFingerprint: string;
  requiresConfirmation: boolean;
}): { prepared: PreparedAgentMutation; preflight: AgentMutationPreflightResponse } {
  const confirmation = buildConfirmationState({
    principalId: params.principalId,
    action: params.internalAction,
    collectionName: params.collectionName,
    entryId: params.entryId,
    payloadFingerprint: params.payloadFingerprint,
    requiresConfirmation: params.requiresConfirmation,
  });

  return {
    prepared: {
      action: params.action,
      internalAction: params.internalAction,
      collectionName: params.collectionName,
      ...(params.entryId ? { entryId: params.entryId } : {}),
      targetBranch: params.targetBranch,
      writeConfig: params.writeConfig,
      currentEntry: params.currentEntry,
      filteredData: params.filteredData,
      ...(params.proposedEntry ? { proposedEntry: params.proposedEntry } : {}),
      ...(params.deletedEntry ? { deletedEntry: params.deletedEntry } : {}),
      resultingStatus: params.resultingStatus,
      autoPublish: params.writeConfig.mode === 'AUTO_PUBLISH',
      requiresConfirmation: params.requiresConfirmation,
      ...(confirmation.confirmationToken ? { confirmationToken: confirmation.confirmationToken } : {}),
      ...(confirmation.confirmationExpiresAt ? { confirmationExpiresAt: confirmation.confirmationExpiresAt } : {}),
      payloadFingerprint: params.payloadFingerprint,
      ...(params.currentRevision ? { currentRevision: params.currentRevision } : {}),
      freshness: params.freshness,
    },
    preflight: {
      ...params.freshness,
      allowed: true,
      action: params.action,
      collectionName: params.collectionName,
      ...(params.entryId ? { entryId: params.entryId } : {}),
      branch: params.targetBranch,
      resultingStatus: params.resultingStatus,
      autoPublish: params.writeConfig.mode === 'AUTO_PUBLISH',
      requiresConfirmation: params.requiresConfirmation,
      ...(params.currentRevision ? { currentRevision: params.currentRevision } : {}),
      ...(params.lockInfo ? { lock: params.lockInfo } : {}),
      ...(confirmation.confirmationToken ? { confirmationToken: confirmation.confirmationToken } : {}),
    },
  };
}
