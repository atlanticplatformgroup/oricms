export type {
  GlobalAsset,
  AssetReference,
  AssetReferenceScope,
  GlobalAssetReference,
  ProjectAssetReference,
} from '@ori/shared';

export {
  createGlobalAssetReference,
  createProjectAssetReference,
  getAssetReferenceIdentifier,
  getAssetReferenceKey,
  getProjectAssetPath,
  isAssetReference,
  isGlobalAssetReference,
  isProjectAssetReference,
  normalizeAssetReference,
} from '@ori/shared';
