import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  normalizeMediaSort,
  normalizeMediaTagFilter,
  normalizeMediaTypeFilter,
  normalizeMediaUsageFilter,
  normalizeMediaViewMode,
  type MediaSort,
  type MediaTypeFilter,
  type MediaUsageFilter,
  type MediaViewMode,
} from '../lib/assets/browse';
import { useBrowseSearch } from './useBrowseSearch';

interface UseMediaBrowseQueryStateOptions {
  selectedView?: string;
}

export function useMediaBrowseQueryState({ selectedView }: UseMediaBrowseQueryStateOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const search = useBrowseSearch(initialQuery);

  const selectedType = normalizeMediaTypeFilter(
    searchParams.get('type') || (selectedView === 'images' || selectedView === 'documents' ? selectedView : 'all'),
  );
  const selectedTag = normalizeMediaTagFilter(searchParams.get('tag') || searchParams.get('folder'));
  const selectedUsage = normalizeMediaUsageFilter(searchParams.get('usage'));
  const selectedSort = normalizeMediaSort(searchParams.get('sort'));
  const selectedViewMode = normalizeMediaViewMode(searchParams.get('view'));
  const selectedAssetPath = searchParams.get('asset');
  const activeSearch = searchParams.get('q') || '';
  const libraryFolder: MediaTypeFilter = selectedType === 'all' ? 'all' : selectedType;
  const { value: searchValue, setValue: setSearchValue, debouncedValue: debouncedSearchValue } = search;

  const updateSearchParams = useCallback((
    update: (next: URLSearchParams) => void,
    options: { replace?: boolean } = { replace: true },
  ) => {
    const next = new URLSearchParams(searchParams);
    update(next);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: options.replace ?? true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const legacyFolder = searchParams.get('folder');
    if (!legacyFolder || searchParams.get('tag')) return;

    updateSearchParams((next) => {
      next.set('tag', legacyFolder);
      next.delete('folder');
    });
  }, [searchParams, updateSearchParams]);

  useEffect(() => {
    const nextQuery = searchParams.get('q') || '';
    if (nextQuery !== searchValue) {
      setSearchValue(nextQuery);
    }
  }, [searchParams, searchValue, setSearchValue]);

  useEffect(() => {
    const normalizedInput = searchValue.trim();
    const normalizedQuery = debouncedSearchValue.trim();
    const currentQuery = searchParams.get('q') || '';
    if (!normalizedInput && !currentQuery) return;
    if (!normalizedQuery && !currentQuery) return;
    if (normalizedQuery === currentQuery) return;

    updateSearchParams((next) => {
      if (normalizedQuery) next.set('q', normalizedQuery);
      else next.delete('q');
      next.delete('asset');
    });
  }, [debouncedSearchValue, searchParams, searchValue, updateSearchParams]);

  return {
    searchParams,
    searchValue,
    setSearchValue,
    activeSearch,
    selectedType,
    selectedTag,
    selectedUsage,
    selectedSort,
    selectedViewMode,
    selectedAssetPath,
    libraryFolder,
    setType(value: MediaTypeFilter) {
      const next = normalizeMediaTypeFilter(value);
      updateSearchParams((params) => {
        if (next === 'all') params.delete('type');
        else params.set('type', next);
        params.delete('tag');
        params.delete('folder');
        params.delete('sort');
        params.delete('view');
        params.delete('asset');
      });
    },
    setTag(value: string) {
      const next = normalizeMediaTagFilter(value);
      updateSearchParams((params) => {
        if (next === 'all') params.delete('tag');
        else params.set('tag', next);
        params.delete('folder');
        params.delete('asset');
      });
    },
    setUsage(value: MediaUsageFilter) {
      const next = normalizeMediaUsageFilter(value);
      updateSearchParams((params) => {
        if (next === 'all') params.delete('usage');
        else params.set('usage', next);
        params.delete('asset');
      });
    },
    setSort(value: MediaSort) {
      const next = normalizeMediaSort(value);
      updateSearchParams((params) => {
        if (next === 'newest') params.delete('sort');
        else params.set('sort', next);
      });
    },
    setViewMode(value: MediaViewMode) {
      const next = normalizeMediaViewMode(value);
      updateSearchParams((params) => {
        if (next === 'list') params.delete('view');
        else params.set('view', next);
      });
    },
    setSelectedAsset(path: string | null) {
      updateSearchParams((params) => {
        if (path) params.set('asset', path);
        else params.delete('asset');
      });
    },
    clearFilters() {
      updateSearchParams((params) => {
        params.delete('type');
        params.delete('tag');
        params.delete('folder');
        params.delete('usage');
        params.delete('sort');
        params.delete('q');
        params.delete('asset');
      });
      setSearchValue('');
    },
  };
}
