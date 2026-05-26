import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAssetBrowseState } from '../useAssetBrowseState';

function createAsset(overrides: Partial<{
  name: string;
  path: string;
  type: string;
  size: number;
  lastModified: string;
  metadata: { tags?: string[]; altText?: string; caption?: string };
}> = {}) {
  return {
    name: 'asset.png',
    path: 'content/asset.png',
    type: 'image',
    size: 1024,
    lastModified: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

describe('useAssetBrowseState', () => {
  it('returns all assets initially', () => {
    const assets = [
      createAsset({ name: 'a.png', path: 'a.png' }),
      createAsset({ name: 'b.png', path: 'b.png' }),
    ];
    const { result } = renderHook(() => useAssetBrowseState({ assets, getAssetId: (a) => a.path }));

    expect(result.current.filteredAssets).toHaveLength(2);
    expect(result.current.selectedAssetId).toBe('a.png');
  });

  it('filters assets by type', () => {
    const assets = [
      createAsset({ name: 'photo.jpg', path: 'photo.jpg', type: 'image' }),
      createAsset({ name: 'doc.pdf', path: 'doc.pdf', type: 'document' }),
    ];
    const { result } = renderHook(() => useAssetBrowseState({ assets, getAssetId: (a) => a.path }));

    act(() => {
      result.current.setSelectedType('documents');
    });

    expect(result.current.filteredAssets).toHaveLength(1);
    expect(result.current.filteredAssets[0].name).toBe('doc.pdf');
  });

  it('filters assets by search query', () => {
    const assets = [
      createAsset({ name: 'cat.png', path: 'cat.png' }),
      createAsset({ name: 'dog.png', path: 'dog.png' }),
    ];
    const { result } = renderHook(() => useAssetBrowseState({ assets, getAssetId: (a) => a.path }));

    act(() => {
      result.current.setSearch('cat');
    });

    expect(result.current.filteredAssets).toHaveLength(1);
    expect(result.current.filteredAssets[0].name).toBe('cat.png');
  });

  it('sorts assets by name', () => {
    const assets = [
      createAsset({ name: 'zebra.png', path: 'z.png' }),
      createAsset({ name: 'alpha.png', path: 'a.png' }),
    ];
    const { result } = renderHook(() => useAssetBrowseState({ assets, getAssetId: (a) => a.path }));

    act(() => {
      result.current.setSelectedSort('name');
    });

    expect(result.current.filteredAssets[0].name).toBe('alpha.png');
    expect(result.current.filteredAssets[1].name).toBe('zebra.png');
  });

  it('clears selection when filter removes selected asset', () => {
    const assets = [
      createAsset({ name: 'a.png', path: 'a.png' }),
      createAsset({ name: 'b.png', path: 'b.png' }),
    ];
    const { result } = renderHook(() => useAssetBrowseState({ assets, getAssetId: (a) => a.path }));

    expect(result.current.selectedAssetId).toBe('a.png');

    act(() => {
      result.current.setSearch('b');
    });

    expect(result.current.filteredAssets).toHaveLength(1);
    expect(result.current.selectedAssetId).toBe('b.png');
  });

  it('provides tag options and facets', () => {
    const assets = [
      createAsset({ name: 'a.png', path: 'a.png', metadata: { tags: ['nature'] } }),
      createAsset({ name: 'b.png', path: 'b.png', metadata: { tags: ['nature'] } }),
      createAsset({ name: 'c.png', path: 'c.png', metadata: { tags: ['city'] } }),
    ];
    const { result } = renderHook(() => useAssetBrowseState({ assets, getAssetId: (a) => a.path }));

    const tagValues = result.current.tagOptions.map((t) => t.value);
    expect(tagValues).toContain('all');
    expect(tagValues).toContain('nature');
    expect(tagValues).toContain('city');

    const natureFacet = result.current.tagFacets.find((f) => f.value === 'nature');
    expect(natureFacet?.count).toBe(2);
  });

  it('filters by tag', () => {
    const assets = [
      createAsset({ name: 'a.png', path: 'a.png', metadata: { tags: ['nature'] } }),
      createAsset({ name: 'b.png', path: 'b.png', metadata: { tags: ['city'] } }),
    ];
    const { result } = renderHook(() => useAssetBrowseState({ assets, getAssetId: (a) => a.path }));

    act(() => {
      result.current.setSelectedTag('nature');
    });

    expect(result.current.filteredAssets).toHaveLength(1);
    expect(result.current.filteredAssets[0].name).toBe('a.png');
  });

  it('allows manual selection override', () => {
    const assets = [
      createAsset({ name: 'a.png', path: 'a.png' }),
      createAsset({ name: 'b.png', path: 'b.png' }),
    ];
    const { result } = renderHook(() => useAssetBrowseState({ assets, getAssetId: (a) => a.path }));

    act(() => {
      result.current.setSelectedAssetId('b.png');
    });

    expect(result.current.selectedAssetId).toBe('b.png');
  });
});
