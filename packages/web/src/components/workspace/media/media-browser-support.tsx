import { memo, useCallback } from 'react';
import { Badge, Button, Group, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import type { Asset } from '@ori/shared';
import { WorkspaceSearchField } from '../../ui/WorkspaceSearchField';
import { WorkspaceEmptyState, WorkspaceErrorState, WorkspaceLoadingState, WorkspaceToolbar } from '../../ui/WorkspacePrimitives';
import { AssetGridItem, AssetListItem, AssetSelectionCheckbox } from './AssetListItem';

interface SharedMediaBrowserProps {
  assets: Asset[];
  selectedAssetPath: string | null;
  selectionMode: boolean;
  selectedAssetPaths: string[];
  onSelectAsset: (path: string) => void;
  onToggleAssetSelection: (path: string) => void;
}

export function MediaBrowserControls(props: {
  activeSearch: string;
  canCreateAssets: boolean;
  hasTagFacet: boolean;
  onClearFilters: () => void;
  onOpenUpload: () => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: 'newest' | 'oldest' | 'name' | 'size') => void;
  onTagChange: (value: string) => void;
  onToggleSelectionMode: () => void;
  onTypeChange: (value: 'all' | 'images' | 'documents') => void;
  onUsageChange: (value: 'all' | 'used' | 'unused') => void;
  onViewModeChange: (value: 'list' | 'grid') => void;
  quickTagFacets: Array<{ value: string; label: string; count: number }>;
  search: string;
  selectedSort: 'newest' | 'oldest' | 'name' | 'size';
  selectedTag: string;
  selectedType: 'all' | 'images' | 'documents';
  selectedUsage: 'all' | 'used' | 'unused';
  selectedViewMode: 'list' | 'grid';
  selectionMode: boolean;
  tagFacets: Array<{ value: string; label: string; count: number }>;
  tagOptions: Array<{ value: string; label: string }>;
  totalAssets: number;
  usageFacets: { used: number; unused: number };
  visibleAssetCount: number;
}) {
  const hasActiveFilters = Boolean(
    props.activeSearch.trim() ||
    props.selectedType !== 'all' ||
    props.selectedTag !== 'all' ||
    props.selectedUsage !== 'all' ||
    props.selectedSort !== 'newest',
  );
  const activeFilterChips: Array<{ key: string; label: string }> = [
    ...(props.selectedType !== 'all' ? [{ key: 'type', label: props.selectedType === 'images' ? 'Images' : 'Documents' }] : []),
    ...(props.selectedTag !== 'all' ? [{ key: 'tag', label: `Tag: ${props.selectedTag}` }] : []),
    ...(props.selectedUsage !== 'all'
      ? [{ key: 'usage', label: props.selectedUsage === 'used' ? 'Used in entries' : 'Unused' }]
      : []),
    ...(props.selectedSort !== 'newest'
      ? [{ key: 'sort', label: `Sort: ${props.selectedSort === 'oldest' ? 'Oldest first' : props.selectedSort === 'name' ? 'Name' : 'Size'}` }]
      : []),
  ];

  return (
    <>
      <Stack gap="xs">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <div style={{ minWidth: 280, flex: '0 1 320px' }}>
            <SegmentedControl
              aria-label="Asset type"
              data={[
                { value: 'all', label: 'All' },
                { value: 'images', label: 'Images' },
                { value: 'documents', label: 'Documents' },
              ]}
              value={props.selectedType}
              onChange={(value) => props.onTypeChange((value as 'all' | 'images' | 'documents') || 'all')}
              fullWidth
            />
          </div>
          <div style={{ minWidth: 280, flex: '1 1 360px' }}>
            <WorkspaceSearchField
              ariaLabel="Search assets"
              placeholder="Search filename, alt text, caption, or tag"
              value={props.search}
              onChange={props.onSearchChange}
            />
          </div>
          <Group gap="xs" wrap="wrap" style={{ marginLeft: 'auto' }}>
            {props.canCreateAssets && !props.selectionMode ? <Button size="xs" onClick={props.onOpenUpload}>Upload asset</Button> : null}
          </Group>
        </Group>

        <Group align="flex-end" gap="sm" wrap="wrap">
          {props.hasTagFacet ? (
            <Select
              aria-label="Asset tag"
              data={props.tagOptions}
              value={props.selectedTag}
              onChange={(value) => props.onTagChange(value || 'all')}
              nothingFoundMessage="No matching tags"
              style={{ width: 220 }}
            />
          ) : null}
          <Select
            aria-label="Usage status"
            data={[
              { value: 'all', label: 'All usage states' },
              { value: 'used', label: `Used (${props.usageFacets.used})` },
              { value: 'unused', label: `Unused (${props.usageFacets.unused})` },
            ]}
            value={props.selectedUsage}
            onChange={(value) => props.onUsageChange((value as 'all' | 'used' | 'unused') || 'all')}
            style={{ width: 190 }}
          />
          <Select
            aria-label="Sort assets"
            data={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'name', label: 'Name' },
              { value: 'size', label: 'Size' },
            ]}
            value={props.selectedSort}
            onChange={(value) => props.onSortChange((value as 'newest' | 'oldest' | 'name' | 'size') || 'newest')}
            style={{ width: 190 }}
          />
          <div style={{ minWidth: 140 }}>
            <SegmentedControl
              aria-label="Asset view"
              data={[
                { value: 'list', label: 'List' },
                { value: 'grid', label: 'Grid' },
              ]}
              value={props.selectedViewMode}
              onChange={(value) => props.onViewModeChange((value as 'list' | 'grid') || 'list')}
              fullWidth
            />
          </div>
          <Group gap="xs" wrap="wrap" style={{ marginLeft: 'auto' }}>
            <Button size="xs" variant={props.selectionMode ? 'filled' : 'default'} color={props.selectionMode ? 'teal' : 'gray'} onClick={props.onToggleSelectionMode}>
              {props.selectionMode ? 'Done' : 'Select'}
            </Button>
          </Group>
        </Group>
      </Stack>

      {props.hasTagFacet ? (
        <Group align="center" gap="xs" wrap="wrap">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">
            Tags
          </Text>
          <Button
            size="xs"
            variant={props.selectedTag === 'all' ? 'filled' : 'default'}
            color={props.selectedTag === 'all' ? 'teal' : 'gray'}
            onClick={() => props.onTagChange('all')}
          >
            All tags
          </Button>
          {props.quickTagFacets.map((tag) => (
            <Button
              key={tag.value}
              size="xs"
              variant={props.selectedTag === tag.value ? 'filled' : 'default'}
              color={props.selectedTag === tag.value ? 'teal' : 'gray'}
              onClick={() => props.onTagChange(tag.value)}
            >
              {`${tag.label} (${tag.count})`}
            </Button>
          ))}
        </Group>
      ) : null}

      {hasActiveFilters ? (
        <Group justify="space-between" align="center" wrap="wrap" style={{ rowGap: 'var(--mantine-spacing-xs)' }}>
          <Group gap="xs" wrap="wrap">
            {activeFilterChips.map((chip) => (
              <Badge key={chip.key} variant="light" color="gray">
                {chip.label}
              </Badge>
            ))}
          </Group>
          <Button size="xs" variant="subtle" color="gray" onClick={props.onClearFilters}>
            Clear filters
          </Button>
        </Group>
      ) : (
        <Text size="sm" c="dimmed">
          {props.selectedViewMode === 'grid'
            ? 'Browsing in grid view for faster visual scanning.'
            : 'Browsing in list view for denser file metadata and path scanning.'}
        </Text>
      )}
    </>
  );
}

export function MediaSelectionToolbar(props: {
  bulkDeletePending: boolean;
  bulkFolderApplying: boolean;
  bulkTagDraft: string;
  onApplyBulkTag: () => void;
  onBulkTagDraftChange: (value: string) => void;
  onClearBulkTags: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onSelectAllLoaded: () => void;
  selectedCount: number;
}) {
  return (
    <WorkspaceToolbar
      controls={(
        <Group gap="xs" wrap="wrap">
          <Badge variant="light" color="teal">{`${props.selectedCount} selected`}</Badge>
          <Button size="xs" variant="default" color="gray" onClick={props.onSelectAllLoaded}>
            Select all loaded
          </Button>
          <Button size="xs" variant="subtle" color="gray" onClick={props.onClearSelection} disabled={props.selectedCount === 0}>
            Clear selection
          </Button>
        </Group>
      )}
      actions={(
        <Group gap="xs" wrap="wrap">
          <TextInput
            aria-label="Bulk tag"
            placeholder="Tag"
            value={props.bulkTagDraft}
            onChange={(event) => props.onBulkTagDraftChange(event.currentTarget.value)}
            size="xs"
            style={{ width: 160 }}
          />
          <Button
            size="xs"
            variant="default"
            onClick={props.onApplyBulkTag}
            disabled={props.selectedCount === 0}
            loading={props.bulkFolderApplying}
          >
            Apply tag
          </Button>
          <Button
            size="xs"
            variant="default"
            color="gray"
            onClick={props.onClearBulkTags}
            disabled={props.selectedCount === 0}
            loading={props.bulkFolderApplying}
          >
            Clear tags
          </Button>
          <Button
            size="xs"
            color="red"
            onClick={props.onDeleteSelected}
            disabled={props.selectedCount === 0}
            loading={props.bulkDeletePending}
          >
            Delete selected
          </Button>
        </Group>
      )}
    />
  );
}

interface MediaAssetGridItemProps {
  asset: Asset;
  selectionMode: boolean;
  isSelected: boolean;
  isChecked: boolean;
  onSelectAsset: (path: string) => void;
  onToggleAssetSelection: (path: string) => void;
}

const MemoAssetGridItem = memo(function MemoAssetGridItem({ asset, selectionMode, isSelected, isChecked, onSelectAsset, onToggleAssetSelection }: MediaAssetGridItemProps) {
  const handleClick = useCallback(() => {
    if (selectionMode) onToggleAssetSelection(asset.path);
    else onSelectAsset(asset.path);
  }, [selectionMode, asset.path, onSelectAsset, onToggleAssetSelection]);

  const handleToggle = useCallback(() => {
    onToggleAssetSelection(asset.path);
  }, [asset.path, onToggleAssetSelection]);

  return (
    <AssetGridItem
      asset={asset}
      selected={isSelected}
      selectionControl={selectionMode ? (
        <AssetSelectionCheckbox assetName={asset.name} checked={isChecked} onChange={handleToggle} />
      ) : undefined}
      onClick={handleClick}
    />
  );
});

interface MediaAssetListItemProps extends MediaAssetGridItemProps {
  density?: 'compact' | 'default';
}

const MemoAssetListItem = memo(function MemoAssetListItem({ asset, selectionMode, isSelected, isChecked, onSelectAsset, onToggleAssetSelection, density }: MediaAssetListItemProps) {
  const handleClick = useCallback(() => {
    if (selectionMode) onToggleAssetSelection(asset.path);
    else onSelectAsset(asset.path);
  }, [selectionMode, asset.path, onSelectAsset, onToggleAssetSelection]);

  const handleToggle = useCallback(() => {
    onToggleAssetSelection(asset.path);
  }, [asset.path, onToggleAssetSelection]);

  return (
    <AssetListItem
      asset={asset}
      selected={isSelected}
      selectionControl={selectionMode ? (
        <AssetSelectionCheckbox assetName={asset.name} checked={isChecked} onChange={handleToggle} />
      ) : undefined}
      onClick={handleClick}
      density={density}
    />
  );
});

export function MediaBrowserResults(props: SharedMediaBrowserProps & {
  canLoadMore: boolean;
  error: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onRetry?: () => void;
  selectedViewMode: 'list' | 'grid';
}) {
  if (props.loading) {
    return <WorkspaceLoadingState label="Loading assets…" />;
  }
  if (props.error) {
    return <WorkspaceErrorState title="Failed to load assets" message="Asset browsing is unavailable right now. Reload and try again." onRetry={props.onRetry} />;
  }
  if (props.assets.length === 0) {
    return <WorkspaceEmptyState title="No assets found" message="Adjust the search or tag filter to inspect a different set of files." />;
  }

  return (
    <Stack gap="sm">
      <ScrollArea h={560} type="never">
        {props.selectedViewMode === 'grid' ? (
          <SimpleGrid cols={{ base: 2, md: 4, xl: 5 }} spacing="sm" verticalSpacing="sm">
            {props.assets.map((asset) => (
              <MemoAssetGridItem
                key={asset.path}
                asset={asset}
                selectionMode={props.selectionMode}
                isSelected={props.selectionMode ? props.selectedAssetPaths.includes(asset.path) : asset.path === props.selectedAssetPath}
                isChecked={props.selectedAssetPaths.includes(asset.path)}
                onSelectAsset={props.onSelectAsset}
                onToggleAssetSelection={props.onToggleAssetSelection}
              />
            ))}
          </SimpleGrid>
        ) : (
          <Stack gap="xs">
            {props.assets.map((asset) => (
              <MemoAssetListItem
                key={asset.path}
                asset={asset}
                selectionMode={props.selectionMode}
                isSelected={props.selectionMode ? props.selectedAssetPaths.includes(asset.path) : asset.path === props.selectedAssetPath}
                isChecked={props.selectedAssetPaths.includes(asset.path)}
                onSelectAsset={props.onSelectAsset}
                onToggleAssetSelection={props.onToggleAssetSelection}
                density="compact"
              />
            ))}
          </Stack>
        )}
      </ScrollArea>

      {props.canLoadMore ? (
        <WorkspaceToolbar
          controls={<Text size="sm" c="dimmed">Load more to continue browsing this result set.</Text>}
          actions={<Button size="xs" variant="default" onClick={props.onLoadMore}>Show more</Button>}
        />
      ) : null}
    </Stack>
  );
}
