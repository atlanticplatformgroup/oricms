import type { Prisma } from '@prisma/client';
import type { AssetMetadata } from '@ori/shared';
import type { PluginHookDispatchInput } from '../../plugins/hook-dispatcher';
import type { GitAssetService } from '../../assets/service';
import type { Asset } from '../../assets/types';

export interface AssetMutationActor {
  id?: string;
  name?: string;
  email?: string;
}

export interface AssetMutationContext {
  projectId: string;
  actor: AssetMutationActor;
}

export interface AssetMutationAuditConfig {
  userId?: string;
  action: string;
}

export interface AssetMutationOptions {
  audit?: AssetMutationAuditConfig;
}

export interface AssetMutationDeps {
  assetService: Pick<GitAssetService, 'uploadAsset' | 'updateMetadata' | 'deleteAsset'>;
  prismaClient?: {
    auditLog: {
      create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
    };
  };
  dispatchPluginHook?: (input: PluginHookDispatchInput) => Promise<unknown>;
}

export interface AssetMutationResult {
  asset?: Asset;
  metadata?: AssetMetadata;
  assetPath: string;
}
