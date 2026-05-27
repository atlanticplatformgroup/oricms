import type { Prisma } from '@prisma/client';
import type { CollectionEntry } from '@ori/shared';
import type { PluginHookDispatchInput } from '../../plugins/hook-dispatcher';
import type { PluginEventName } from '@ori/shared';

export interface EntryMutationActor {
  id?: string;
  name?: string;
  email?: string;
  kind?: 'human' | 'agent' | 'system';
}

export interface EntryMutationContext {
  projectId: string;
  collectionId: string;
  repoUrl?: string | null;
  branch: string;
  actor?: EntryMutationActor;
}

export interface EntryMutationAuditConfig {
  userId?: string;
  action: string;
}

export interface EntryMutationPluginConfig {
  event: PluginEventName;
  resourceType?: string;
}

export interface EntryMutationOptions {
  audit?: EntryMutationAuditConfig;
  plugin?: EntryMutationPluginConfig;
}

export interface EntryMutationDeps {
  prismaClient?: {
    auditLog: {
      create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
    };
  };
  dispatchPluginHook?: (input: PluginHookDispatchInput) => Promise<unknown>;
}

export interface EntryMutationResult {
  entry?: CollectionEntry;
  entryId: string;
  revision?: string;
  previousEntry?: CollectionEntry;
  commitHash?: string;
  commitMessage?: string;
  changedFiles?: string[];
}
