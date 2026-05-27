import type { Prisma } from '@prisma/client';
import type { ContentType } from '@ori/shared';
import type { GitService } from '../../git/service';
import type { PluginHookDispatchInput } from '../../plugins/hook-dispatcher';

export interface ContentTypeMutationActor {
  id?: string;
  name?: string;
  email?: string;
}

export interface ContentTypeMutationContext {
  projectId: string;
  actor: ContentTypeMutationActor;
}

export interface ContentTypeMutationAuditConfig {
  userId?: string;
  action: string;
}

export interface ContentTypeMutationOptions {
  deleteRecords?: boolean;
  audit?: ContentTypeMutationAuditConfig;
}

export interface ContentTypeMutationDeps {
  gitService: Pick<GitService, 'writeFile' | 'deleteFile' | 'writeFilesBatch' | 'listFiles'>;
  prismaClient?: {
    auditLog: {
      create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
    };
  };
  dispatchPluginHook?: (input: PluginHookDispatchInput) => Promise<unknown>;
}

export interface ContentTypeMutationResult {
  path: string;
  contentType: ContentType;
}
