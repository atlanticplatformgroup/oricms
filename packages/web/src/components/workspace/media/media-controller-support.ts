import { getAssetTags, type AssetMetadata } from '@ori/shared';

export const MEDIA_PAGE_SIZE = 24;

export function buildTagOptions(tags: Array<{ value: string; label: string; count: number }>) {
  return [
    { value: 'all', label: 'All tags' },
    ...tags.map((tag) => ({
      value: tag.value,
      label: `${tag.label} (${tag.count})`,
    })),
  ];
}

export function filterSelectedAssetPaths(
  selectedAssetPaths: string[],
  assets: Array<{ path: string }>,
) {
  return selectedAssetPaths.filter((path) => assets.some((asset) => asset.path === path));
}

export function resetMediaSelectionState() {
  return {
    selectionMode: false,
    selectedAssetPaths: [] as string[],
    bulkTagDraft: '',
  };
}

export function getSelectedAsset<T extends { path: string }>(params: {
  assets: T[];
  selectedAssetPath: string | null;
  selectedAssetFromQuery?: T | null;
}) {
  return params.selectedAssetFromQuery
    || params.assets.find((asset) => asset.path === params.selectedAssetPath)
    || null;
}

export function getMetadataDraftFromAsset(selectedAsset: { metadata?: AssetMetadata } | null) {
  if (!selectedAsset) {
    return { altText: '', caption: '', tags: [] as string[] };
  }

  return {
    altText: String(selectedAsset.metadata?.altText || ''),
    caption: String(selectedAsset.metadata?.caption || ''),
    tags: getAssetTags(selectedAsset.metadata),
  };
}

export function hasUnsavedMetadata(params: {
  selectedAsset: { metadata?: AssetMetadata } | null;
  metadataDraft: { altText: string; caption: string; tags: string[] };
}) {
  return Boolean(
    params.selectedAsset && (
      params.metadataDraft.altText !== String(params.selectedAsset.metadata?.altText || '')
      || params.metadataDraft.caption !== String(params.selectedAsset.metadata?.caption || '')
      || params.metadataDraft.tags.join('|') !== getAssetTags(params.selectedAsset.metadata).join('|')
    )
  );
}
