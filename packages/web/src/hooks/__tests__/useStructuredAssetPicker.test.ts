import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Asset, CollectionEntry, GlobalAsset, SchemaField } from '@ori/shared';
import { useStructuredAssetPicker } from '../useStructuredAssetPicker';

describe('useStructuredAssetPicker', () => {
  const activeFields: SchemaField[] = [
    { key: 'heroImage', type: 'media', label: 'Hero Image' },
    { key: 'thumbnail', type: 'media', label: 'Thumbnail' },
  ];

  const assetRecords: Asset[] = [
    { name: 'logo.png', path: 'logo.png', folder: 'content', type: 'image', size: 100, url: '/logo.png', lastModified: '2024-01-01' },
    { name: 'banner.jpg', path: 'banner.jpg', folder: 'content', type: 'image', size: 200, url: '/banner.jpg', lastModified: '2024-01-02' },
  ];

  const globalAssetRecords: GlobalAsset[] = [
    { name: 'global-logo.png', path: 'global-logo.png', folder: 'global', type: 'image', size: 50, url: '/global-logo.png', lastModified: '2024-01-01', assetId: 'global-1', scope: 'global' },
  ];

  const assetMap = new Map<string, Asset>([
    ['logo.png', assetRecords[0]],
    ['banner.jpg', assetRecords[1]],
  ]);

  function renderPicker(draftEntry: CollectionEntry | null = null) {
    return renderHook(() =>
      useStructuredAssetPicker({
        activeFields,
        assetMap,
        assetRecords,
        draftEntry,
        globalAssetRecords,
        handleFieldChange: vi.fn(),
      }),
    );
  }

  it('initializes with closed picker', () => {
    const { result } = renderPicker();
    expect(result.current.assetPickerOpened).toBe(false);
    expect(result.current.activeAssetFieldKey).toBeNull();
  });

  it('opens picker for a field', () => {
    const { result } = renderPicker();

    act(() => {
      result.current.handleOpenAssetPicker('heroImage');
    });

    expect(result.current.assetPickerOpened).toBe(true);
    expect(result.current.activeAssetFieldKey).toBe('heroImage');
    expect(result.current.activeAssetField?.label).toBe('Hero Image');
  });

  it('shows all project assets by default', () => {
    const { result } = renderPicker();
    expect(result.current.filteredAssets).toHaveLength(2);
  });

  it('switches to global assets', () => {
    const { result } = renderPicker();

    act(() => {
      result.current.setAssetPickerScope('global');
    });

    expect(result.current.filteredAssets).toHaveLength(1);
    expect(result.current.filteredAssets[0].name).toBe('global-logo.png');
  });

  it('filters assets by search', () => {
    const { result } = renderPicker();

    act(() => {
      result.current.setAssetSearch('logo');
    });

    expect(result.current.filteredAssets).toHaveLength(1);
    expect(result.current.filteredAssets[0].name).toBe('logo.png');
  });

  it('selects an asset and calls handleFieldChange', () => {
    const handleFieldChange = vi.fn();
    const { result } = renderHook(() =>
      useStructuredAssetPicker({
        activeFields,
        assetMap,
        assetRecords,
        draftEntry: null,
        globalAssetRecords,
        handleFieldChange,
      }),
    );

    act(() => {
      result.current.handleOpenAssetPicker('heroImage');
    });

    act(() => {
      result.current.handleSelectAsset({ $ref: 'asset', scope: 'project', path: 'logo.png' });
    });

    expect(handleFieldChange).toHaveBeenCalledWith('heroImage', { $ref: 'asset', scope: 'project', path: 'logo.png' });
    expect(result.current.assetPickerOpened).toBe(false);
  });

  it('closes picker when selecting null', () => {
    const handleFieldChange = vi.fn();
    const { result } = renderHook(() =>
      useStructuredAssetPicker({
        activeFields,
        assetMap,
        assetRecords,
        draftEntry: null,
        globalAssetRecords,
        handleFieldChange,
      }),
    );

    act(() => {
      result.current.handleOpenAssetPicker('heroImage');
    });

    act(() => {
      result.current.handleSelectAsset(null);
    });

    expect(handleFieldChange).toHaveBeenCalledWith('heroImage', '');
    expect(result.current.assetPickerOpened).toBe(false);
  });
});
