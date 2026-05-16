import { getAssetTags, type AssetMetadata } from '@ori/shared';

export type MediaTypeFilter = 'all' | 'images' | 'documents';
export type MediaUsageFilter = 'all' | 'used' | 'unused';
export type MediaSort = 'newest' | 'oldest' | 'name' | 'size';
export type MediaViewMode = 'list' | 'grid';

export interface AssetTagFacet {
  value: string;
  label: string;
  count: number;
}

interface BrowseableAssetLike {
  name: string;
  path: string;
  type: string;
  size: number;
  lastModified: string;
  metadata?: AssetMetadata;
}

export function normalizeMediaTypeFilter(value: string | null | undefined): MediaTypeFilter {
  if (value === 'images' || value === 'documents') return value;
  return 'all';
}

export function normalizeMediaUsageFilter(value: string | null | undefined): MediaUsageFilter {
  if (value === 'used' || value === 'unused') return value;
  return 'all';
}

export function normalizeMediaSort(value: string | null | undefined): MediaSort {
  if (value === 'oldest' || value === 'name' || value === 'size') return value;
  return 'newest';
}

export function normalizeMediaViewMode(value: string | null | undefined): MediaViewMode {
  if (value === 'grid') return 'grid';
  return 'list';
}

export function normalizeMediaTagFilter(value: string | null | undefined): string {
  return value?.trim() || 'all';
}

export function buildAssetTagFacets(assets: BrowseableAssetLike[]): AssetTagFacet[] {
  const counts = new Map<string, number>();

  for (const asset of assets) {
    const tags = getAssetTags(asset.metadata);
    if (!tags.length) {
      counts.set('__untagged__', (counts.get('__untagged__') || 0) + 1);
      continue;
    }

    tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      label: value === '__untagged__' ? 'Untagged' : value,
      count,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label);
    });
}

export function buildAssetTagOptions(assets: BrowseableAssetLike[]): Array<{ value: string; label: string }> {
  return [
    { value: 'all', label: 'All tags' },
    ...buildAssetTagFacets(assets).map((tag) => ({
      value: tag.value,
      label: `${tag.label} (${tag.count})`,
    })),
  ];
}

export function sortAssetsByMode<T extends Pick<BrowseableAssetLike, 'name' | 'size' | 'lastModified'>>(
  assets: T[],
  sort: MediaSort,
): T[] {
  const next = [...assets];
  next.sort((left, right) => {
    if (sort === 'name') return left.name.localeCompare(right.name);
    if (sort === 'size') return right.size - left.size;
    const leftTime = new Date(left.lastModified).getTime();
    const rightTime = new Date(right.lastModified).getTime();
    return sort === 'oldest' ? leftTime - rightTime : rightTime - leftTime;
  });
  return next;
}

export function matchesAssetBrowseFilters(
  asset: BrowseableAssetLike,
  options: {
    selectedType: MediaTypeFilter;
    selectedTag: string;
    search: string;
  },
): boolean {
  const query = options.search.trim().toLowerCase();

  if (options.selectedType === 'images' && asset.type !== 'image') return false;
  if (options.selectedType === 'documents' && asset.type === 'image') return false;

  if (options.selectedTag !== 'all') {
    const tags = getAssetTags(asset.metadata);
    if (options.selectedTag === '__untagged__' ? tags.length > 0 : !tags.includes(options.selectedTag)) {
      return false;
    }
  }

  if (!query) return true;

  return [
    asset.name,
    asset.path,
    String(asset.metadata?.altText || ''),
    String(asset.metadata?.caption || ''),
    ...getAssetTags(asset.metadata),
  ].some((value) => value.toLowerCase().includes(query));
}
