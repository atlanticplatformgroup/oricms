import { Text } from '@mantine/core';
import { getAssetRenderUrl } from '../../lib/assets/display';
import {
  WorkspaceHeader,
  WorkspaceMain,
  WorkspaceMetricBadge,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceSplitMain,
} from '../ui/WorkspacePrimitives';
import { MediaBrowser } from './media/MediaBrowser';
import { MediaInspector } from './media/MediaInspector';
import { UploadAssetModal } from './media/UploadAssetModal';
import { useMediaWorkspaceController } from './media/useMediaWorkspaceController';

interface MediaWorkspaceProps {
  projectId: string;
  selectedView: string;
  selectedLabel?: string;
  selectedDescription?: string;
  canCreateAssets: boolean;
  canUpdateAssets: boolean;
  canDeleteAssets: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', options?: { duration?: number }) => void;
}
export function MediaWorkspace({
  projectId,
  selectedView,
  canCreateAssets,
  canUpdateAssets,
  canDeleteAssets,
  showToast,
}: MediaWorkspaceProps) {
  const {
    assets,
    activeSearch,
    bulkDeleteMutation,
    bulkTagDraft,
    bulkTagMutation,
    clearFilters,
    deleteAssetMutation,
    hasUnsavedMetadata,
    isError,
    isLoading,
    mediaQuery,
    metadataDraft,
    searchValue,
    selectedAsset,
    selectedAssetPath,
    selectedAssetPaths,
    selectedAssetQuery,
    selectedLibraryBucket,
    selectedSort,
    selectedTag,
    selectedType,
    selectedUsage,
    selectedViewMode,
    selectionMode,
    setBulkTagDraft,
    setMetadataDraft,
    setSearchValue,
    setSelectedAsset,
    setSelectedAssetPaths,
    setSelectionMode,
    setSort,
    setTag,
    setType,
    setUsage,
    setViewMode,
    tagFacets,
    tagOptions,
    totalAssets,
    updateMetadataMutation,
    uploadAssetMutation,
    uploadOpened,
    setUploadOpened,
    usageFacets,
  } = useMediaWorkspaceController({
    projectId,
    selectedView,
    showToast,
  });

  return (
    <WorkspacePage>
      <WorkspaceHeader
        title="Media Library"
        description="Browse project images and documents, filter by tag and metadata, and maintain reusable asset details."
        meta={<Text size="sm" c="dimmed">{`${totalAssets} matching assets · ${assets.length} loaded`}</Text>}
        actions={<WorkspaceMetricBadge>{`${totalAssets} assets`}</WorkspaceMetricBadge>}
      />

      <WorkspaceMain>
        <WorkspaceSplitMain
          primary={
            <WorkspacePanel>
              <MediaBrowser
                assets={assets}
                totalAssets={totalAssets}
                selectedAssetPath={selectedAssetPath}
                search={searchValue}
                activeSearch={activeSearch}
                onSearchChange={setSearchValue}
                selectedType={selectedType}
                onTypeChange={setType}
                selectedTag={selectedTag}
                tagOptions={tagOptions}
                tagFacets={tagFacets}
                onTagChange={setTag}
                selectedUsage={selectedUsage}
                usageFacets={usageFacets}
                onUsageChange={setUsage}
                selectedSort={selectedSort}
                onSortChange={setSort}
                selectedViewMode={selectedViewMode}
                onViewModeChange={setViewMode}
                onClearFilters={clearFilters}
                selectionMode={selectionMode}
                selectedAssetPaths={selectedAssetPaths}
                bulkTagDraft={bulkTagDraft}
                onBulkTagDraftChange={setBulkTagDraft}
                onToggleSelectionMode={() => {
                  setSelectionMode((current) => {
                    if (current) {
                      setSelectedAssetPaths([]);
                      setBulkTagDraft('');
                    }
                    return !current;
                  });
                }}
                onToggleAssetSelection={(path) => {
                  setSelectedAssetPaths((current) => (
                    current.includes(path)
                      ? current.filter((entry) => entry !== path)
                      : [...current, path]
                  ));
                }}
                onSelectAllLoaded={() => {
                  setSelectedAssetPaths(assets.map((asset) => asset.path));
                }}
                onClearSelection={() => {
                  setSelectedAssetPaths([]);
                }}
                onApplyBulkTag={() => {
                  void bulkTagMutation.mutate({
                    paths: selectedAssetPaths,
                    tag: bulkTagDraft.trim(),
                  });
                }}
                onClearBulkTags={() => {
                  void bulkTagMutation.mutate({
                    paths: selectedAssetPaths,
                    tag: '',
                  });
                }}
                onDeleteSelected={() => {
                  if (selectedAssetPaths.length === 0) return;
                  if (!window.confirm(`Delete ${selectedAssetPaths.length} selected assets?`)) return;
                  void bulkDeleteMutation.mutate(selectedAssetPaths);
                }}
                bulkFolderApplying={bulkTagMutation.isPending}
                bulkDeletePending={bulkDeleteMutation.isPending}
                loading={isLoading}
                error={isError}
                canCreateAssets={canCreateAssets}
                onOpenUpload={() => setUploadOpened(true)}
                onSelectAsset={setSelectedAsset}
                canLoadMore={Boolean(mediaQuery.hasNextPage)}
                onLoadMore={() => {
                  void mediaQuery.fetchNextPage();
                }}
                onRetry={() => {
                  void mediaQuery.refetch();
                }}
              />
            </WorkspacePanel>
          }
          secondary={
            <WorkspacePanel>
              <MediaInspector
                selectedAsset={selectedAsset}
                usageDetailLoading={selectedAssetQuery.isFetching && Boolean(selectedAssetPath)}
                selectionMode={selectionMode}
                bulkSelectionCount={selectedAssetPaths.length}
                metadataDraft={metadataDraft}
                onMetadataDraftChange={setMetadataDraft}
                hasUnsavedMetadata={hasUnsavedMetadata}
                canUpdateAssets={canUpdateAssets}
                canDeleteAssets={canDeleteAssets}
                metadataSaving={updateMetadataMutation.isPending}
                deletePending={deleteAssetMutation.isPending}
                onSaveMetadata={() => {
                  if (!selectedAsset) return;
                  updateMetadataMutation.mutate({
                    path: selectedAsset.path,
                    metadata: {
                      ...selectedAsset.metadata,
                      altText: metadataDraft.altText,
                      caption: metadataDraft.caption,
                      tags: metadataDraft.tags,
                    },
                  });
                }}
                onDeleteAsset={() => {
                  if (!selectedAsset) return;
                  if (!window.confirm(`Delete ${selectedAsset.name}?`)) return;
                  deleteAssetMutation.mutate(selectedAsset.path);
                }}
                onCopyPath={async () => {
                  if (!selectedAsset) return;
                  try {
                    await navigator.clipboard.writeText(selectedAsset.path);
                    showToast('Asset path copied', 'success');
                  } catch {
                    showToast('Failed to copy asset path', 'error');
                  }
                }}
                onOpenAsset={() => {
                  if (!selectedAsset) return;
                  window.open(getAssetRenderUrl(selectedAsset.url), '_blank', 'noopener,noreferrer');
                }}
              />
            </WorkspacePanel>
          }
          primarySpan={{ base: 12, xl: 8 }}
          secondarySpan={{ base: 12, xl: 4 }}
        />
      </WorkspaceMain>

      <UploadAssetModal
        opened={uploadOpened}
        onClose={() => setUploadOpened(false)}
        loading={uploadAssetMutation.isPending}
        defaultLibraryFolder={selectedLibraryBucket}
        defaultTag={selectedTag === 'all' ? '' : selectedTag}
        defaultScope="project"
        onUpload={async ({ filename, content, libraryFolder, tags, scope }) => {
          await uploadAssetMutation.mutateAsync({ filename, content, libraryFolder, tags, scope });
        }}
      />
    </WorkspacePage>
  );
}
