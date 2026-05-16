import { describe, expect, it } from 'vitest';
import {
  attachAssetUsage,
  buildAssetTagFacets,
  buildAssetUsageFacets,
  filterAssetsBySearch,
  filterAssetsByTag,
  filterAssetsByUsage,
  mergeAssetFolders,
  paginateAssets,
  sortAssets,
  UNASSIGNED_ASSET_TAG,
} from '../asset-listing';
import type { Asset } from '../types';

const baseAssets: Asset[] = [
  {
    path: 'assets/images/hero.png',
    name: 'hero.png',
    folder: 'images',
    size: 20,
    type: 'image',
    url: '/assets/images/hero.png',
    lastModified: '2026-03-28T00:00:00.000Z',
    metadata: { tags: ['homepage'], altText: 'Hero image' },
  },
  {
    path: 'assets/images/logo.png',
    name: 'logo.png',
    folder: 'images',
    size: 10,
    type: 'image',
    url: '/assets/images/logo.png',
    lastModified: '2026-03-27T00:00:00.000Z',
    metadata: {},
  },
  {
    path: 'assets/documents/guide.pdf',
    name: 'guide.pdf',
    folder: 'documents',
    size: 30,
    type: 'document',
    url: '/assets/documents/guide.pdf',
    lastModified: '2026-03-26T00:00:00.000Z',
    metadata: { tags: ['docs'], caption: 'Setup guide' },
  },
];

describe('asset listing helpers', () => {
  it('merges folder assets by path and attaches usage summaries', () => {
    const merged = mergeAssetFolders([[baseAssets[0]], [baseAssets[1], baseAssets[2]]]);
    const withUsage = attachAssetUsage(
      merged,
      new Map([
        ['assets/images/hero.png', 2],
        ['assets/documents/guide.pdf', 1],
      ])
    );

    expect(withUsage.map((asset) => [asset.path, asset.usage?.status])).toEqual([
      ['assets/images/hero.png', 'used'],
      ['assets/images/logo.png', 'unused'],
      ['assets/documents/guide.pdf', 'used'],
    ]);
  });

  it('filters by search, tag, and usage while building facets', () => {
    const withUsage = attachAssetUsage(
      baseAssets,
      new Map([
        ['assets/images/hero.png', 2],
        ['assets/documents/guide.pdf', 1],
      ])
    );

    expect(filterAssetsBySearch(withUsage, 'guide')).toEqual([withUsage[2]]);
    expect(filterAssetsByTag(withUsage, 'homepage')).toEqual([withUsage[0]]);
    expect(filterAssetsByTag(withUsage, UNASSIGNED_ASSET_TAG)).toEqual([withUsage[1]]);
    expect(filterAssetsByUsage(withUsage, 'used')).toEqual([withUsage[0], withUsage[2]]);

    expect(buildAssetTagFacets(withUsage)).toEqual([
      { value: 'docs', label: 'docs', count: 1 },
      { value: 'homepage', label: 'homepage', count: 1 },
      { value: UNASSIGNED_ASSET_TAG, label: 'Untagged', count: 1 },
    ]);
    expect(buildAssetUsageFacets(withUsage)).toEqual({ used: 2, unused: 1 });
  });

  it('sorts and paginates assets', () => {
    const byName = sortAssets(baseAssets, 'name');
    expect(byName.map((asset) => asset.name)).toEqual(['guide.pdf', 'hero.png', 'logo.png']);

    const paginated = paginateAssets(sortAssets(baseAssets, 'newest'), 2, 1);
    expect(paginated.assets.map((asset) => asset.name)).toEqual(['logo.png', 'guide.pdf']);
    expect(paginated.pagination).toEqual({
      total: 3,
      limit: 2,
      offset: 1,
      hasMore: false,
    });
  });
});
