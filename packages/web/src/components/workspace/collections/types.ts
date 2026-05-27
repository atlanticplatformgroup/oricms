import type { Asset, CollectionEntry } from '@ori/shared';
import type { CollectionEntriesPagination, CollectionTableColumn } from '../../../lib/entries/types';

export interface CollectionBrowseController {
  search: string;
  setSearch: (value: string) => void;
  entriesLoading: boolean;
  entriesError: boolean;
  retryEntries: () => void;
  entries: CollectionEntry[];
  entriesPagination: CollectionEntriesPagination;
  entryPage: number;
  setEntryPage: (page: number) => void;
  selectedCollectionEntryCount: number;
  tableColumns: CollectionTableColumn[];
  tableAssetMap: Map<string, Asset>;
  tableRelationLabelsByField: Record<string, Record<string, string>>;
  sortState: { key: string; direction: 'asc' | 'desc' };
  toggleSort: (key: string) => void;
  setSort: (key: string, direction: 'asc' | 'desc') => void;
  shownMetric: string;
  hasActiveSearch: boolean;
  emptyState: {
    title: string;
    message: string;
  };
}
