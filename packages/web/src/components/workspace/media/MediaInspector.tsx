import { Alert, Badge, Button, Group, Stack, TagsInput, Text, TextInput, Textarea } from '@mantine/core';
import { formatAssetSize, formatAssetUsage, getAssetDisplayTags, getAssetTypeLabel } from '../../../lib/assets/display';
import type { AssetDetail, GlobalAssetDetail } from '../../../lib/api/assets';
import { WorkspaceFieldGrid, WorkspaceInset, WorkspaceSection } from '../../ui/WorkspacePrimitives';
import { AuthenticatedImage } from '../../ui/AuthenticatedImage';

interface MetadataDraft {
  altText: string;
  caption: string;
  tags: string[];
}

interface MediaInspectorProps {
  selectedAsset: AssetDetail | GlobalAssetDetail | null;
  usageDetailLoading?: boolean;
  usageTitle?: string;
  usageDescription?: string;
  emptyUsageMessage?: string;
  selectionMode?: boolean;
  bulkSelectionCount?: number;
  metadataDraft: MetadataDraft;
  onMetadataDraftChange: (next: MetadataDraft) => void;
  hasUnsavedMetadata: boolean;
  canUpdateAssets: boolean;
  canDeleteAssets: boolean;
  metadataSaving: boolean;
  deletePending: boolean;
  onSaveMetadata: () => void;
  onDeleteAsset: () => void;
  onCopyPath: () => void;
  onOpenAsset: () => void;
}

export function MediaInspector({
  selectedAsset,
  usageDetailLoading = false,
  usageTitle = 'Usage',
  usageDescription = 'See which entries currently reference this asset.',
  emptyUsageMessage = 'This asset is not currently referenced by any entry in this project.',
  selectionMode = false,
  bulkSelectionCount = 0,
  metadataDraft,
  onMetadataDraftChange,
  hasUnsavedMetadata,
  canUpdateAssets,
  canDeleteAssets,
  metadataSaving,
  deletePending,
  onSaveMetadata,
  onDeleteAsset,
  onCopyPath,
  onOpenAsset,
}: MediaInspectorProps) {
  const usage = selectedAsset ? formatAssetUsage(selectedAsset) : null;

  return (
    <WorkspaceSection title="Inspector" description="Review the selected asset and maintain the metadata reused across the CMS.">
      {selectionMode ? (
        <Alert color="teal" title="Batch selection">
          {bulkSelectionCount > 0
            ? `${bulkSelectionCount} assets selected. Use the library toolbar to apply tags or delete them in one pass.`
            : 'Select assets from the library to apply bulk actions.'}
        </Alert>
      ) : !selectedAsset ? (
        <Alert color="gray" title="No asset selected">Select an asset from the library to inspect its details.</Alert>
      ) : (
        <Stack gap="sm">
          {selectedAsset.type === 'image' ? (
            <WorkspaceInset>
              <AuthenticatedImage
                src={selectedAsset.url}
                alt={selectedAsset.metadata?.altText || selectedAsset.name}
                radius="md"
                fit="contain"
                mah={280}
              />
            </WorkspaceInset>
          ) : (
            <WorkspaceInset>
              <Group justify="space-between">
                <Text fw={600}>{selectedAsset.name}</Text>
                <Badge variant="outline" color="gray">{getAssetTypeLabel(selectedAsset.type)}</Badge>
              </Group>
            </WorkspaceInset>
          )}

          <WorkspaceInset>
            <Stack gap="xs">
              <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
                <Stack gap={2}>
                  <Text fw={600}>{selectedAsset.name}</Text>
                  <Text size="sm" c="dimmed">{selectedAsset.path}</Text>
                </Stack>
                <Badge variant="light" color="gray">{getAssetTypeLabel(selectedAsset.type)}</Badge>
              </Group>
              <Group gap="xs" wrap="wrap">
                <Badge variant="light" color="gray">{formatAssetSize(selectedAsset.size)}</Badge>
                {getAssetDisplayTags(selectedAsset).map((tag) => (
                  <Badge key={tag} variant="light" color="gray">{tag}</Badge>
                ))}
                {usage ? <Badge variant="light" color={usage.color}>{usage.label}</Badge> : null}
                <Text size="xs" c="dimmed">Modified {new Date(selectedAsset.lastModified).toLocaleDateString()}</Text>
              </Group>
            </Stack>
          </WorkspaceInset>

          <WorkspaceFieldGrid>
            <Button size="xs" variant="default" onClick={onCopyPath}>Copy path</Button>
            <Button size="xs" variant="default" onClick={onOpenAsset}>Open asset</Button>
          </WorkspaceFieldGrid>

          <WorkspaceSection
            title={usageTitle}
            description={usageDescription}
          >
            {usageDetailLoading && selectedAsset.usage?.status === 'used' && !selectedAsset.usageDetail ? (
              <Text size="sm" c="dimmed">Loading usage references…</Text>
            ) : selectedAsset.usageDetail?.references?.length ? (
              <Stack gap="xs">
                {selectedAsset.usageDetail.references.map((reference) => (
                  <WorkspaceInset key={`${reference.collectionId}:${reference.entryId}`}>
                    <Stack gap={4}>
                      <Group gap="xs" wrap="wrap">
                        <Text fw={600}>{reference.entryLabel}</Text>
                        <Badge variant="light" color="gray">{reference.collectionLabel}</Badge>
                      </Group>
                      <Text size="xs" c="dimmed">{reference.entryPath}</Text>
                    </Stack>
                  </WorkspaceInset>
                ))}
              </Stack>
            ) : (
              <Alert color="gray" title="No references">
                {emptyUsageMessage}
              </Alert>
            )}
          </WorkspaceSection>

          <WorkspaceSection
            title="Metadata"
            description="Alt text, caption, and tags stay with the asset."
            badge={hasUnsavedMetadata ? <Badge color="orange" variant="light">Unsaved</Badge> : undefined}
          >
            <Stack gap="sm">
              <TextInput
                label="Alt text"
                value={metadataDraft.altText}
                onChange={(event) => onMetadataDraftChange({ ...metadataDraft, altText: event.currentTarget.value })}
                disabled={!canUpdateAssets}
              />
              <Textarea
                label="Caption"
                minRows={3}
                value={metadataDraft.caption}
                onChange={(event) => onMetadataDraftChange({ ...metadataDraft, caption: event.currentTarget.value })}
                disabled={!canUpdateAssets}
              />
              <TagsInput
                label="Tags"
                value={metadataDraft.tags}
                onChange={(value) => onMetadataDraftChange({ ...metadataDraft, tags: value })}
                disabled={!canUpdateAssets}
                placeholder="Add tags"
              />
              <WorkspaceFieldGrid>
                {canDeleteAssets ? (
                  <Button size="xs" variant="default" color="red" onClick={onDeleteAsset} loading={deletePending}>Delete asset</Button>
                ) : <div />}
                <Button size="xs" onClick={onSaveMetadata} disabled={!canUpdateAssets || !hasUnsavedMetadata} loading={metadataSaving}>Save metadata</Button>
              </WorkspaceFieldGrid>
            </Stack>
          </WorkspaceSection>
        </Stack>
      )}
    </WorkspaceSection>
  );
}
