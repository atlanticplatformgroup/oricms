import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Select, SegmentedControl, Stack } from '@mantine/core';
import { getAssetTags, type AssetMetadata } from '@ori/shared';
import { globalAssetsApi, type GlobalAssetDetail, type GlobalAssetListItem } from '../../../lib/api/assets';
import { useAssetBrowseState } from '../../../hooks/useAssetBrowseState';
import { WorkspaceEmptyState, WorkspaceErrorState, WorkspaceFieldGrid, WorkspaceLoadingState, WorkspaceMain, WorkspaceMetricBadge, WorkspaceSection, WorkspaceSplitMain, WorkspaceToolbar } from '../../ui/WorkspacePrimitives';
import { WorkspaceSearchField } from '../../ui/WorkspaceSearchField';
import { AssetGridItem, AssetListItem } from '../media/AssetListItem';
import { MediaInspector } from '../media/MediaInspector';
import { UploadAssetModal } from '../media/UploadAssetModal';

interface GlobalMediaSettingsViewProps {
  projectId: string;
  canCreateAssets: boolean;
  canUpdateAssets: boolean;
  canDeleteAssets: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', options?: { duration?: number }) => void;
}

export function GlobalMediaSettingsView({
  projectId,
  canCreateAssets,
  canUpdateAssets,
  canDeleteAssets,
  showToast,
}: GlobalMediaSettingsViewProps) {
  const queryClient = useQueryClient();
  const [uploadOpened, setUploadOpened] = useState(false);
  const [metadataDraft, setMetadataDraft] = useState({ altText: '', caption: '', tags: [] as string[] });

  const globalAssetsQuery = useQuery({
    queryKey: ['global-assets', projectId],
    queryFn: () => globalAssetsApi.list(projectId),
    enabled: Boolean(projectId),
  });

  const {
    search,
    setSearch,
    selectedTag,
    setSelectedTag,
    selectedType,
    setSelectedType,
    selectedSort,
    setSelectedSort,
    viewMode,
    setViewMode,
    selectedAssetId,
    setSelectedAssetId,
    filteredAssets,
    tagOptions,
  } = useAssetBrowseState({
    assets: globalAssetsQuery.data?.assets ?? [],
    getAssetId: (asset) => asset.assetId,
  });

  const selectedListAsset = useMemo(
    () => filteredAssets.find((asset) => asset.assetId === selectedAssetId) ?? null,
    [filteredAssets, selectedAssetId],
  );

  const selectedAssetQuery = useQuery({
    queryKey: ['global-assets', projectId, selectedAssetId],
    queryFn: () => globalAssetsApi.get(projectId, selectedAssetId!),
    enabled: Boolean(projectId && selectedAssetId),
  });

  const selectedAsset = (selectedAssetQuery.data?.asset ?? selectedListAsset) as GlobalAssetDetail | GlobalAssetListItem | null;

  useEffect(() => {
    if (!selectedAsset) return;
    setMetadataDraft({
      altText: String(selectedAsset.metadata?.altText || ''),
      caption: String(selectedAsset.metadata?.caption || ''),
      tags: getAssetTags(selectedAsset.metadata),
    });
  }, [selectedAsset]);

  const hasUnsavedMetadata = Boolean(
    selectedAsset && (
      metadataDraft.altText !== String(selectedAsset.metadata?.altText || '') ||
      metadataDraft.caption !== String(selectedAsset.metadata?.caption || '') ||
      metadataDraft.tags.join('|') !== getAssetTags(selectedAsset.metadata).join('|')
    ),
  );

  const uploadMutation = useMutation({
    mutationFn: async (input: { filename: string; content: string; libraryFolder: 'images' | 'documents'; tags: string[] }) =>
      globalAssetsApi.upload(projectId, input.filename, input.content, input.libraryFolder, input.tags),
    onSuccess: async (result) => {
      setSelectedAssetId(result.asset.assetId);
      await queryClient.invalidateQueries({ queryKey: ['global-assets', projectId] });
      showToast('Asset uploaded to global library', 'success');
    },
    onError: () => showToast('Failed to upload global asset', 'error'),
  });

  const updateMetadataMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAssetId) throw new Error('No asset selected');
      const metadata: AssetMetadata = {};
      if (metadataDraft.altText.trim()) metadata.altText = metadataDraft.altText.trim();
      if (metadataDraft.caption.trim()) metadata.caption = metadataDraft.caption.trim();
      if (metadataDraft.tags.length > 0) metadata.tags = metadataDraft.tags;
      return globalAssetsApi.updateMetadata(projectId, selectedAssetId, metadata);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['global-assets', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['global-assets', projectId, selectedAssetId] });
      setMetadataDraft({
        altText: String(result.metadata.altText || ''),
        caption: String(result.metadata.caption || ''),
        tags: getAssetTags(result.metadata),
      });
      showToast('Global asset metadata saved', 'success');
    },
    onError: () => showToast('Failed to save global asset metadata', 'error'),
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAssetId) throw new Error('No asset selected');
      await globalAssetsApi.delete(projectId, selectedAssetId);
      return selectedAssetId;
    },
    onSuccess: async (deletedAssetId) => {
      await queryClient.invalidateQueries({ queryKey: ['global-assets', projectId] });
      await queryClient.removeQueries({ queryKey: ['global-assets', projectId, deletedAssetId] });
      setSelectedAssetId((current) => (current === deletedAssetId ? null : current));
      showToast('Global asset deleted', 'success');
    },
    onError: () => showToast('Failed to delete global asset', 'error'),
  });

  if (globalAssetsQuery.isLoading) {
    return <WorkspaceLoadingState label="Loading global media…" />;
  }

  if (globalAssetsQuery.isError) {
    return (
      <WorkspaceErrorState
        title="Failed to load global media"
        message="The shared global media library is unavailable right now."
        onRetry={() => void globalAssetsQuery.refetch()}
      />
    );
  }

  return (
    <WorkspaceMain>
      <WorkspaceSection
        title="Global Media Library"
        description="Curate brand assets and reusable files that editors can select across projects."
        badge={<WorkspaceMetricBadge>{`${filteredAssets.length} of ${globalAssetsQuery.data?.assets.length ?? 0} shown`}</WorkspaceMetricBadge>}
        actions={canCreateAssets ? <Button onClick={() => setUploadOpened(true)}>Upload global asset</Button> : undefined}
      >
        <Stack gap="sm">
          <WorkspaceToolbar
            controls={(
              <WorkspaceFieldGrid cols={{ base: 1, md: 4 }}>
                <WorkspaceSearchField
                  ariaLabel="Search global assets"
                  placeholder="Search name, alt text, caption, or tag"
                  value={search}
                  onChange={setSearch}
                />
                <Select
                  aria-label="Global media tag"
                  data={tagOptions}
                  value={selectedTag}
                  onChange={(value) => setSelectedTag(value || 'all')}
                />
                <SegmentedControl
                  aria-label="Global media type"
                  data={[
                    { value: 'all', label: 'All' },
                    { value: 'images', label: 'Images' },
                    { value: 'documents', label: 'Documents' },
                  ]}
                  value={selectedType}
                  onChange={(value) => setSelectedType((value as 'all' | 'images' | 'documents') || 'all')}
                  fullWidth
                  style={{ minWidth: 280 }}
                />
                <Select
                  aria-label="Global media sort"
                  data={[
                    { value: 'newest', label: 'Newest first' },
                    { value: 'oldest', label: 'Oldest first' },
                    { value: 'name', label: 'Name' },
                    { value: 'size', label: 'Size' },
                  ]}
                  value={selectedSort}
                  onChange={(value) => setSelectedSort((value as 'newest' | 'oldest' | 'name' | 'size') || 'newest')}
                />
              </WorkspaceFieldGrid>
            )}
            actions={(
              <SegmentedControl
                aria-label="Global media view"
                data={[
                  { value: 'list', label: 'List' },
                  { value: 'grid', label: 'Grid' },
                ]}
                value={viewMode}
                onChange={(value) => setViewMode((value as 'list' | 'grid') || 'list')}
              />
            )}
          />

          <WorkspaceSplitMain
            primary={filteredAssets.length ? (
              viewMode === 'grid' ? (
                <WorkspaceFieldGrid cols={{ base: 1, sm: 2, md: 2, xl: 3 }}>
                  {filteredAssets.map((asset) => (
                    <AssetGridItem
                      key={asset.assetId}
                      asset={asset}
                      selected={asset.assetId === selectedAssetId}
                      onClick={() => setSelectedAssetId(asset.assetId)}
                    />
                  ))}
                </WorkspaceFieldGrid>
              ) : (
                <Stack gap="sm">
                  {filteredAssets.map((asset) => (
                    <AssetListItem
                      key={asset.assetId}
                      asset={asset}
                      selected={asset.assetId === selectedAssetId}
                      density="compact"
                      action={<Badge variant="outline" color="teal">Global</Badge>}
                      onClick={() => setSelectedAssetId(asset.assetId)}
                    />
                  ))}
                </Stack>
              )
            ) : (
              <WorkspaceEmptyState
                title="No global assets match"
                message="Adjust the filters or upload a shared asset to start curating the global library."
              />
            )}
            secondary={(
              <MediaInspector
                selectedAsset={selectedAsset}
                usageDetailLoading={selectedAssetQuery.isLoading}
                usageTitle="Global usage"
                usageDescription="Cross-project usage reporting for global assets will appear here."
                emptyUsageMessage="Cross-project usage reporting is not available for this global asset yet."
                metadataDraft={metadataDraft}
                onMetadataDraftChange={setMetadataDraft}
                hasUnsavedMetadata={hasUnsavedMetadata}
                canUpdateAssets={canUpdateAssets}
                canDeleteAssets={canDeleteAssets}
                metadataSaving={updateMetadataMutation.isPending}
                deletePending={deleteAssetMutation.isPending}
                onSaveMetadata={() => updateMetadataMutation.mutate()}
                onDeleteAsset={() => deleteAssetMutation.mutate()}
                onCopyPath={() => {
                  if (!selectedAsset) return;
                  void navigator.clipboard.writeText(selectedAsset.assetId);
                  showToast('Global asset identifier copied', 'success');
                }}
                onOpenAsset={() => {
                  if (!selectedAsset) return;
                  window.open(selectedAsset.url, '_blank', 'noopener,noreferrer');
                }}
              />
            )}
          />

          <Alert color="teal" title="Shared across projects">
            Editors can select these assets from supported media pickers. Changes here affect the shared global library rather than a single project branch.
          </Alert>
        </Stack>
      </WorkspaceSection>

      <UploadAssetModal
        opened={uploadOpened}
        onClose={() => setUploadOpened(false)}
        loading={uploadMutation.isPending}
        defaultLibraryFolder="images"
        defaultTag={selectedTag !== 'all' && selectedTag !== '__untagged__' ? selectedTag : ''}
        defaultScope="global"
        allowedScopes={['global']}
        onUpload={async (input) => {
          await uploadMutation.mutateAsync({
            filename: input.filename,
            content: input.content,
            libraryFolder: input.libraryFolder,
            tags: input.tags,
          });
        }}
      />
    </WorkspaceMain>
  );
}
