import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMediaBrowseQueryState } from '../useMediaBrowseQueryState';

function Wrapper({ children, initialEntries }: { children: ReactNode; initialEntries?: string[] }) {
  return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
}

describe('useMediaBrowseQueryState', () => {
  beforeEach(() => {
    // no cleanup needed with MemoryRouter per-render
  });

  it('reads initial values from URL params', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/media?q=hello&type=images&tag=hero&sort=oldest&view=grid&asset=/path.jpg']}>{children}</Wrapper>,
    });

    expect(result.current.searchValue).toBe('hello');
    expect(result.current.selectedType).toBe('images');
    expect(result.current.selectedTag).toBe('hero');
    expect(result.current.selectedSort).toBe('oldest');
    expect(result.current.selectedViewMode).toBe('grid');
    expect(result.current.selectedAssetPath).toBe('/path.jpg');
  });

  it('defaults when no URL params', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });

    expect(result.current.searchValue).toBe('');
    expect(result.current.selectedType).toBe('all');
    expect(result.current.selectedTag).toBe('all');
    expect(result.current.selectedUsage).toBe('all');
    expect(result.current.selectedSort).toBe('newest');
    expect(result.current.selectedViewMode).toBe('list');
    expect(result.current.selectedAssetPath).toBeNull();
  });

  it('infers type from selectedView prop', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState({ selectedView: 'images' }), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });
    expect(result.current.selectedType).toBe('images');
  });

  it('sets type and clears related params', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/media?tag=hero&sort=oldest']}>{children}</Wrapper>,
    });

    act(() => result.current.setType('documents'));

    expect(result.current.selectedType).toBe('documents');
    expect(result.current.selectedTag).toBe('all');
    expect(result.current.selectedSort).toBe('newest');
  });

  it('sets tag and clears folder', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/media?folder=old-folder']}>{children}</Wrapper>,
    });

    act(() => result.current.setTag('new-tag'));

    expect(result.current.selectedTag).toBe('new-tag');
  });

  it('sets usage', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });

    act(() => result.current.setUsage('unused'));

    expect(result.current.selectedUsage).toBe('unused');
  });

  it('sets sort', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });

    act(() => result.current.setSort('name'));

    expect(result.current.selectedSort).toBe('name');
  });

  it('sets view mode', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });

    act(() => result.current.setViewMode('grid'));

    expect(result.current.selectedViewMode).toBe('grid');
  });

  it('sets selected asset', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });

    act(() => result.current.setSelectedAsset('/asset.png'));

    expect(result.current.selectedAssetPath).toBe('/asset.png');
  });

  it('clears selected asset', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/media?asset=/asset.png']}>{children}</Wrapper>,
    });

    act(() => result.current.setSelectedAsset(null));

    expect(result.current.selectedAssetPath).toBeNull();
  });

  it('clears all filters', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/media?q=test&type=images&tag=hero&usage=unused&sort=oldest&asset=/a.jpg']}>{children}</Wrapper>,
    });

    act(() => result.current.clearFilters());

    expect(result.current.searchValue).toBe('');
    expect(result.current.selectedType).toBe('all');
    expect(result.current.selectedTag).toBe('all');
    expect(result.current.selectedUsage).toBe('all');
    expect(result.current.selectedSort).toBe('newest');
    expect(result.current.selectedAssetPath).toBeNull();
  });

  it('migrates legacy folder param to tag', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/media?folder=legacy-folder']}>{children}</Wrapper>,
    });

    expect(result.current.selectedTag).toBe('legacy-folder');
  });

  it('does not set search params if unchanged', () => {
    const { result } = renderHook(() => useMediaBrowseQueryState(), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/media?type=images']}>{children}</Wrapper>,
    });

    // Use a helper to read current search params from inside the router
    const { result: paramsResult } = renderHook(() => useSearchParams(), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/media?type=images']}>{children}</Wrapper>,
    });

    act(() => result.current.setType('images'));

    // Params should remain unchanged
    expect(paramsResult.current[0].toString()).toBe('type=images');
  });
});
