import { Stack } from '@mantine/core';
import type { Asset } from '@ori/shared';
import { WorkspaceMetricBadge, WorkspaceSection } from '../../ui/WorkspacePrimitives';
import { MediaBrowserControls, MediaBrowserResults, MediaSelectionToolbar } from './media-browser-support';

interface MediaBrowserProps {
  assets: Asset[];
  totalAssets: number;
  selectedAssetPath: string | null;
  search: string;
  activeSearch: string;
  onSearchChange: (value: string) => void;
  selectedType: 'all' | 'images' | 'documents';
  onTypeChange: (value: 'all' | 'images' | 'documents') => void;
  selectedTag: string;
  tagOptions: Array<{ value: string; label: string }>;
  tagFacets: Array<{ value: string; label: string; count: number }>;
  onTagChange: (value: string) => void;
  selectedUsage: 'all' | 'used' | 'unused';
  usageFacets: { used: number; unused: number };
  onUsageChange: (value: 'all' | 'used' | 'unused') => void;
  selectedSort: 'newest' | 'oldest' | 'name' | 'size';
  onSortChange: (value: 'newest' | 'oldest' | 'name' | 'size') => void;
  selectedViewMode: 'list' | 'grid';
  onViewModeChange: (value: 'list' | 'grid') => void;
  onClearFilters: () => void;
  selectionMode: boolean;
  selectedAssetPaths: string[];
  bulkTagDraft: string;
  onBulkTagDraftChange: (value: string) => void;
  onToggleSelectionMode: () => void;
  onToggleAssetSelection: (path: string) => void;
  onSelectAllLoaded: () => void;
  onClearSelection: () => void;
  onApplyBulkTag: () => void;
  onClearBulkTags: () => void;
  onDeleteSelected: () => void;
  bulkFolderApplying: boolean;
  bulkDeletePending: boolean;
  loading: boolean;
  error: boolean;
  canCreateAssets: boolean;
  onOpenUpload: () => void;
  onSelectAsset: (path: string) => void;
  canLoadMore: boolean;
  onLoadMore: () => void;
  onRetry?: () => void;
}

export function MediaBrowser({
  assets,
  totalAssets,
  selectedAssetPath,
  search,
  activeSearch,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedTag,
  tagOptions,
  tagFacets,
  onTagChange,
  selectedUsage,
  usageFacets,
  onUsageChange,
  selectedSort,
  onSortChange,
  selectedViewMode,
  onViewModeChange,
  onClearFilters,
  selectionMode,
  selectedAssetPaths,
  bulkTagDraft,
  onBulkTagDraftChange,
  onToggleSelectionMode,
  onToggleAssetSelection,
  onSelectAllLoaded,
  onClearSelection,
  onApplyBulkTag,
  onClearBulkTags,
  onDeleteSelected,
  bulkFolderApplying,
  bulkDeletePending,
  loading,
  error,
  canCreateAssets,
  onOpenUpload,
  onSelectAsset,
  canLoadMore,
  onLoadMore,
  onRetry,
}: MediaBrowserProps) {
  const hasTagFacet = tagOptions.length > 1;
  const quickTagFacets = tagFacets.slice(0, 6);
  const selectedCount = selectedAssetPaths.length;

  return (
    <WorkspaceSection
      title="Library"
      description="Search and inspect assets by type, tag, and metadata."
      badge={<WorkspaceMetricBadge>{`${assets.length} of ${totalAssets} shown`}</WorkspaceMetricBadge>}
    >
      <Stack gap="sm">
        <MediaBrowserControls
          activeSearch={activeSearch}
          canCreateAssets={canCreateAssets}
          hasTagFacet={hasTagFacet}
          onClearFilters={onClearFilters}
          onOpenUpload={onOpenUpload}
          onSearchChange={onSearchChange}
          onSortChange={onSortChange}
          onTagChange={onTagChange}
          onToggleSelectionMode={onToggleSelectionMode}
          onTypeChange={onTypeChange}
          onUsageChange={onUsageChange}
          onViewModeChange={onViewModeChange}
          quickTagFacets={quickTagFacets}
          search={search}
          selectedSort={selectedSort}
          selectedTag={selectedTag}
          selectedType={selectedType}
          selectedUsage={selectedUsage}
          selectedViewMode={selectedViewMode}
          selectionMode={selectionMode}
          tagFacets={tagFacets}
          tagOptions={tagOptions}
          totalAssets={totalAssets}
          usageFacets={usageFacets}
          visibleAssetCount={assets.length}
        />

        {selectionMode ? (
          <MediaSelectionToolbar
            bulkDeletePending={bulkDeletePending}
            bulkFolderApplying={bulkFolderApplying}
            bulkTagDraft={bulkTagDraft}
            onApplyBulkTag={onApplyBulkTag}
            onBulkTagDraftChange={onBulkTagDraftChange}
            onClearBulkTags={onClearBulkTags}
            onClearSelection={onClearSelection}
            onDeleteSelected={onDeleteSelected}
            onSelectAllLoaded={onSelectAllLoaded}
            selectedCount={selectedCount}
          />
        ) : null}
        <MediaBrowserResults
          assets={assets}
          canLoadMore={canLoadMore}
          error={error}
          loading={loading}
          onLoadMore={onLoadMore}
          onRetry={onRetry}
          onSelectAsset={onSelectAsset}
          onToggleAssetSelection={onToggleAssetSelection}
          selectedAssetPath={selectedAssetPath}
          selectedAssetPaths={selectedAssetPaths}
          selectedViewMode={selectedViewMode}
          selectionMode={selectionMode}
        />
      </Stack>
    </WorkspaceSection>
  );
}
