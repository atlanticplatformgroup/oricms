import type { AgentWriteConfig } from '@prisma/client';
import type {
  AgentConfigFreshness,
  AgentEntryStatus,
  AgentMutationAction,
  CollectionEntry,
} from '@ori/shared';

export type InternalAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSITION';

export interface PreparedAgentMutation {
  action: AgentMutationAction;
  internalAction: InternalAction;
  collectionName: string;
  entryId?: string;
  targetBranch: string;
  writeConfig: AgentWriteConfig;
  currentEntry?: CollectionEntry | null;
  filteredData: Record<string, unknown>;
  proposedEntry?: CollectionEntry | null;
  deletedEntry?: CollectionEntry | null;
  resultingStatus?: AgentEntryStatus | null;
  autoPublish: boolean;
  requiresConfirmation: boolean;
  confirmationToken?: string;
  confirmationExpiresAt?: string;
  payloadFingerprint: string;
  currentRevision?: string;
  freshness: AgentConfigFreshness;
}
