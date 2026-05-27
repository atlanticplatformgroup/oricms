import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Asset, CollectionConfig, CollectionEntry, ContentType } from '@ori/shared';
import { resolveRegisteredFieldCapability } from '../lib/fields/capabilities';
import { resolveBrowseRelationLabelsByField } from '../lib/entries/display-resolver';
import { getCollectionTableColumns } from '../lib/entries/resolution';
import { useBrowseSearch } from './useBrowseSearch';
import { useCollectionEntries } from './queries/useCollectionQueries';

interface UseCollectionBrowseModelOptions {
  projectId: string | null;
  branchName: string | null;
  activeSecondaryId: string | null;
  selectedCollection: CollectionConfig | null;
  selectedContentType: ContentType | null;
  collections: CollectionConfig[];
  contentTypes: ContentType[];
  tableAssetMap: Map<string, Asset>;
}

export function useCollectionBrowseModel({
  projectId,
  branchName,
  activeSecondaryId,
  selectedCollection,
  selectedContentType,
  collections,
  contentTypes,
  tableAssetMap,
}: UseCollectionBrowseModelOptions) {
  const search = useBrowseSearch();
  const [entryPage, setEntryPage] = useState(1);
  const [entryPageSize] = useState(25);
  const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: '$updatedAt',
    direction: 'desc',
  });

  const tableColumns = useMemo(
    () => getCollectionTableColumns(selectedContentType),
    [selectedContentType],
  );

  useEffect(() => {
    setEntryPage(1);
  }, [activeSecondaryId, search.debouncedValue]);

  const entriesQuery = useCollectionEntries(projectId ?? undefined, selectedCollection?.id, {
    page: entryPage,
    limit: entryPageSize,
    search: search.debouncedValue.trim() || undefined,
  }, branchName);

  const collectionEntryCountQuery = useCollectionEntries(projectId ?? undefined, selectedCollection?.id, {
    page: 1,
    limit: 1,
  }, branchName);

  const entries = useMemo(
    () => (entriesQuery.data?.data ?? []) as CollectionEntry[],
    [entriesQuery.data?.data],
  );

  const entriesPagination = entriesQuery.data?.meta?.pagination
    ? {
        page: entriesQuery.data.meta.pagination.page,
        pageSize: entriesQuery.data.meta.pagination.pageSize,
        pageCount: entriesQuery.data.meta.pagination.pageCount,
        total: entriesQuery.data.meta.pagination.total,
      }
    : {
        page: entryPage,
        pageSize: entryPageSize,
        pageCount: 1,
        total: entries.length,
      };

  const selectedCollectionEntryCount = collectionEntryCountQuery.data?.meta?.pagination?.total ?? entriesPagination.total;

  const tableRelationLabelsQuery = useQuery({
    queryKey: ['collections', 'table-relation-labels', projectId, branchName, selectedCollection?.id, selectedContentType?.$id, entries.map((entry) => entry.$id).join('|')],
    queryFn: () => resolveBrowseRelationLabelsByField({
      projectId: projectId!,
      fields: tableColumns.map((column) => column.field).filter((field): field is NonNullable<typeof field> => Boolean(field)),
      entries,
      collections,
      contentTypes,
    }),
    enabled: Boolean(projectId && selectedCollection && selectedContentType && entries.length && tableColumns.some((column) => column.field?.type === 'relation' || column.field?.type === 'reference')),
  });

  const tableRelationLabelsByField = useMemo(
    () => tableRelationLabelsQuery.data ?? {},
    [tableRelationLabelsQuery.data],
  );

  const sortedEntries = useMemo(() => {
    const directionFactor = sortState.direction === 'asc' ? 1 : -1;
    return [...entries].sort((left, right) => {
      if (sortState.key === '$updatedAt') {
        return (new Date(left.$updatedAt).getTime() - new Date(right.$updatedAt).getTime()) * directionFactor;
      }

      if (sortState.key === '$status') {
        return String(left.$status).localeCompare(String(right.$status), undefined, { sensitivity: 'base' }) * directionFactor;
      }

      const sortColumn = tableColumns.find((column) => column.key === sortState.key);
      const leftValue = sortState.key === '$id' ? left.$id : left[sortState.key];
      const rightValue = sortState.key === '$id' ? right.$id : right[sortState.key];
      const leftToken = resolveRegisteredFieldCapability({
        field: sortColumn?.field,
        fieldType: sortColumn?.fieldType || '$id',
        value: leftValue,
        context: {
          assetMap: tableAssetMap,
          relationLabels: sortColumn ? tableRelationLabelsByField[sortColumn.key] : undefined,
        },
      }).sortToken;
      const rightToken = resolveRegisteredFieldCapability({
        field: sortColumn?.field,
        fieldType: sortColumn?.fieldType || '$id',
        value: rightValue,
        context: {
          assetMap: tableAssetMap,
          relationLabels: sortColumn ? tableRelationLabelsByField[sortColumn.key] : undefined,
        },
      }).sortToken;

      return leftToken.localeCompare(rightToken, undefined, {
        numeric: true,
        sensitivity: 'base',
      }) * directionFactor;
    });
  }, [entries, sortState, tableColumns, tableAssetMap, tableRelationLabelsByField]);

  const shownStart = entries.length === 0 ? 0 : ((entriesPagination.page - 1) * entriesPagination.pageSize) + 1;
  const shownEnd = entries.length === 0 ? 0 : shownStart + entries.length - 1;
  const shownMetric = entriesPagination.total > 0 ? `${shownStart}\u2013${shownEnd} of ${entriesPagination.total}` : '0 shown';
  const hasActiveSearch = search.value.trim().length > 0;

  const emptyState = hasActiveSearch && selectedCollectionEntryCount > 0
    ? {
        title: 'No matching entries',
        message: `No entries match "${search.value.trim()}". Clear the search to browse all entries in this collection.`,
      }
    : {
        title: 'No entries',
        message: 'This collection does not have any entries yet.',
      };

  return {
    search: search.value,
    setSearch: search.setValue,
    entries: sortedEntries,
    entriesQuery,
    entriesLoading: entriesQuery.isLoading,
    entriesError: entriesQuery.isError,
    retryEntries: () => void entriesQuery.refetch(),
    entriesPagination,
    entryPage,
    setEntryPage,
    selectedCollectionEntryCount,
    tableColumns,
    tableAssetMap,
    tableRelationLabelsByField,
    sortState,
    toggleSort: (key: string) => {
      setSortState((current) => {
        if (current.key === key) {
          return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
        }
        return { key, direction: key === '$updatedAt' ? 'desc' : 'asc' };
      });
    },
    setSort: (key: string, direction: 'asc' | 'desc') => {
      setSortState({ key, direction });
    },
    shownMetric,
    hasActiveSearch,
    emptyState,
  };
}
