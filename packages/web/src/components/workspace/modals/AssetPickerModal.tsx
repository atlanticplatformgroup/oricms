import { Alert, Badge, Button, Grid, Group, Loader, Modal, ScrollArea, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { getAssetTags, type Asset } from '@ori/shared';
import { useMediaQuery } from '@mantine/hooks';
import { createGlobalAssetReference, createProjectAssetReference, type AssetReference, type AssetReferenceScope, type GlobalAsset } from '../../../lib/assets/references';
import { WorkspaceFieldGrid, WorkspaceInset } from '../../ui/WorkspacePrimitives';
import { AuthenticatedImage } from '../../ui/AuthenticatedImage';
import { AssetListItem } from '../media/AssetListItem';
import { getAssetIdentifier, getAssetTypeLabel } from '../../../lib/assets/display';

type SelectableAsset = Asset | GlobalAsset;

interface AssetPickerModalProps {
  opened: boolean;
  onClose: () => void;
  activeAssetFieldLabel?: string;
  assetSource: AssetReferenceScope;
  onAssetSourceChange: (value: AssetReferenceScope) => void;
  selectedAssetReference: AssetReference | null;
  selectedAsset: SelectableAsset | null;
  filteredAssets: SelectableAsset[];
  assetSearch: string;
  onAssetSearchChange: (value: string) => void;
  assetTagFilter: string;
  assetTagOptions: Array<{ value: string; label: string }>;
  onAssetTagFilterChange: (value: string) => void;
  onSelectAsset: (reference: AssetReference | null) => void;
  loading: boolean;
}

export function AssetPickerModal({
  opened,
  onClose,
  activeAssetFieldLabel,
  assetSource,
  onAssetSourceChange,
  selectedAssetReference,
  selectedAsset,
  filteredAssets,
  assetSearch,
  onAssetSearchChange,
  assetTagFilter,
  assetTagOptions,
  onAssetTagFilterChange,
  onSelectAsset,
  loading,
}: AssetPickerModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const globalSelectionId = selectedAssetReference?.scope === 'global' ? selectedAssetReference.assetId : null;
  const selectedIdentifier = selectedAsset ? getAssetIdentifier(selectedAsset) : null;

  return (
    <Modal opened={opened} onClose={onClose} title="Browse assets" centered size="xl" fullScreen={isMobile}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap" style={{ rowGap: 'var(--mantine-spacing-xs)' }}>
          <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
            <Text size="sm" fw={500}>{activeAssetFieldLabel || 'Asset selection'}</Text>
            <Text size="xs" c="dimmed">Use the same search, tag, and preview flow as the Media workspace, then select the asset you want to reuse.</Text>
          </Stack>
          <Badge variant="light" color="gray">{`${filteredAssets.length} ${filteredAssets.length === 1 ? 'asset' : 'assets'}`}</Badge>
        </Group>

        <SegmentedControl
          value={assetSource}
          onChange={(value) => onAssetSourceChange(value as AssetReferenceScope)}
          data={[
            { label: 'Project', value: 'project' },
            { label: 'Global', value: 'global' },
          ]}
        />

        <WorkspaceFieldGrid>
          <TextInput placeholder="Search filename, alt text, caption, or tag" value={assetSearch} onChange={(event) => onAssetSearchChange(event.currentTarget.value)} />
          <Select aria-label="Asset tag" data={assetTagOptions} value={assetTagFilter} onChange={(value) => onAssetTagFilterChange(value || 'all')} />
        </WorkspaceFieldGrid>

        <Grid gutter="md" align="start">
          <Grid.Col span={{ base: 12, md: 7 }}>
            {loading ? (
              <Stack align="center" py="xl"><Loader size="sm" /></Stack>
            ) : filteredAssets.length === 0 ? (
              <Alert color="gray" title={assetSource === 'global' ? 'No global assets found' : 'No assets found'}>
                {assetSource === 'global'
                  ? 'Try a different search or tag filter, or upload a shared asset before selecting from the global library.'
                  : 'Try a different search or switch tags in the Media workspace.'}
              </Alert>
            ) : (
              <ScrollArea h={420}>
                <Stack gap="xs">
                  {filteredAssets.map((asset) => (
                    <AssetListItem
                      key={'assetId' in asset ? `global:${asset.assetId}` : asset.path}
                      asset={asset}
                      selected={
                        assetSource === 'global'
                          ? selectedAssetReference?.scope === 'global' && 'assetId' in asset && selectedAssetReference.assetId === asset.assetId
                          : selectedAssetReference?.scope === 'project' && selectedAssetReference.path === asset.path
                      }
                      onClick={() => onSelectAsset('assetId' in asset ? createGlobalAssetReference(asset.assetId) : createProjectAssetReference(asset.path))}
                    />
                  ))}
                </Stack>
              </ScrollArea>
            )}
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            {assetSource === 'global' && !selectedAsset ? (
              globalSelectionId ? (
                <Stack gap="sm">
                  <WorkspaceInset>
                    <Stack gap="xs">
                      <Group justify="space-between" align="flex-start" wrap="wrap" style={{ rowGap: 'var(--mantine-spacing-xs)' }}>
                        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                          <Text fw={600}>{globalSelectionId}</Text>
                          <Text size="xs" c="dimmed">Global asset reference</Text>
                        </Stack>
                        <Badge variant="light" color="gray">Global</Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        This entry already points at a global asset reference. Global asset browsing will appear here once the shared library is available.
                      </Text>
                    </Stack>
                  </WorkspaceInset>
                  <Group justify="space-between" wrap="wrap" style={{ rowGap: 'var(--mantine-spacing-xs)' }}>
                    <Button variant="default" color="red" size="xs" onClick={() => onSelectAsset(null)}>Clear selection</Button>
                    <Button size="xs" onClick={onClose}>Done</Button>
                  </Group>
                </Stack>
              ) : (
                <Alert color="gray" title="No asset selected">Select a shared asset to review its preview and identifier before inserting it.</Alert>
              )
            ) : !selectedAsset ? (
              <Alert color="gray" title="No asset selected">Select an asset to review its preview and metadata before inserting it.</Alert>
            ) : (
              <Stack gap="sm">
                {selectedAsset.type === 'image' ? (
                  <AuthenticatedImage src={selectedAsset.url} alt={String(selectedAsset.metadata?.altText || selectedAsset.name)} radius="md" fit="contain" />
                ) : null}
                <WorkspaceInset>
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start" wrap="wrap" style={{ rowGap: 'var(--mantine-spacing-xs)' }}>
                      <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                        <Text fw={600}>{selectedAsset.name}</Text>
                        <Text size="xs" c="dimmed">{selectedIdentifier}</Text>
                      </Stack>
                      <Badge variant="light" color="gray">
                        {assetSource === 'global' ? 'Global' : getAssetTypeLabel(selectedAsset.type)}
                      </Badge>
                    </Group>
                    {'assetId' in selectedAsset && selectedAsset.path !== selectedAsset.assetId ? (
                      <Text size="xs" c="dimmed">Storage path: {selectedAsset.path}</Text>
                    ) : null}
                    {getAssetTags(selectedAsset.metadata).length ? <Text size="xs" c="dimmed">Tags: {getAssetTags(selectedAsset.metadata).join(', ')}</Text> : null}
                    {selectedAsset.metadata?.altText ? <Text size="xs" c="dimmed">Alt: {String(selectedAsset.metadata.altText)}</Text> : null}
                    {selectedAsset.metadata?.caption ? <Text size="xs" c="dimmed">Caption: {String(selectedAsset.metadata.caption)}</Text> : null}
                  </Stack>
                </WorkspaceInset>
                <Group justify="space-between" wrap="wrap" style={{ rowGap: 'var(--mantine-spacing-xs)' }}>
                  <Button variant="default" color="red" size="xs" onClick={() => onSelectAsset(null)}>Clear selection</Button>
                  <Button size="xs" onClick={onClose}>Done</Button>
                </Group>
              </Stack>
            )}
          </Grid.Col>
        </Grid>
      </Stack>
    </Modal>
  );
}
