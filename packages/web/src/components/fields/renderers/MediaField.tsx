import { ActionIcon, Badge, Button, Group, Select, Stack, Text } from '@mantine/core';
import { getAssetTags, type Asset } from '@ori/shared';
import { resolveFieldLabel, type FieldRendererProps } from '../contracts';
import { createProjectAssetReference, getProjectAssetPath, normalizeAssetReference } from '../../../lib/assets/references';
import type { GlobalAsset } from '../../../lib/assets/references';
import { getDisplayText } from '../../../lib/workspace/format';
import { AuthenticatedImage } from '../../ui/AuthenticatedImage';
import { WorkspaceComplexFieldSurface } from '../../ui/WorkspacePrimitives';
import { getAssetIdentifier } from '../../../lib/assets/display';

export function MediaField({ field, value, error, disabled, onChange, context }: FieldRendererProps) {
  const selectedAssetReference = normalizeAssetReference(value);
  const selectedAssetPath = getProjectAssetPath(value);
  const selectedAssetKey = selectedAssetReference?.scope === 'global'
    ? selectedAssetReference.assetId
    : selectedAssetPath;
  const selectedAsset = selectedAssetKey ? (context.assetMap?.get(selectedAssetKey) as Asset | GlobalAsset | undefined) ?? null : null;
  const label = resolveFieldLabel(field);
  const selectedLabel = selectedAsset?.name
    || (selectedAssetReference?.scope === 'global'
      ? selectedAssetReference.assetId
      : selectedAssetReference?.path.split('/').pop() || selectedAssetReference?.path || 'No asset selected');
  const selectedPathLabel = selectedAsset
    ? getAssetIdentifier(selectedAsset)
    : selectedAssetReference?.scope === 'global'
      ? 'Global asset reference'
      : selectedAssetReference?.path || 'Choose an asset from the library or use quick select if you already know it.';
  const hasSelection = Boolean(selectedAssetReference);

  return (
    <WorkspaceComplexFieldSurface>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={4} flex={1} miw={0}>
            <Group gap="xs">
              <Text size="sm" fw={600} lineClamp={1}>{selectedLabel}</Text>
              {selectedAssetReference?.scope === 'global' ? <Badge variant="light" color="gray">Global</Badge> : null}
            </Group>
            <Text size="sm" c="dimmed">{selectedPathLabel}</Text>
          </Stack>
          {hasSelection ? (
            <ActionIcon
              variant="default"
              color="gray"
              onClick={() => onChange('')}
              disabled={disabled}
              aria-label={`Clear ${label}`}
            >
              ×
            </ActionIcon>
          ) : null}
        </Group>

        {selectedAsset?.type === 'image' ? (
          <AuthenticatedImage
            src={selectedAsset.url}
            alt={getDisplayText(selectedAsset.metadata?.altText) || selectedAsset.name}
            h={180}
            radius="md"
            fit="cover"
          />
        ) : null}

        <Stack gap="xs">
          <Group gap="xs" justify="space-between" wrap="wrap">
            <Button
              variant="default"
              disabled={disabled || context.assetsLoading}
              onClick={() => context.onOpenAssetPicker?.(field.key)}
            >
              {hasSelection ? 'Change asset' : 'Browse assets'}
            </Button>
            {hasSelection ? (
              <Text size="xs" c="dimmed">
                {selectedAssetReference?.scope === 'global'
                  ? 'Global asset'
                  : getAssetTags(selectedAsset?.metadata).length
                    ? `Tags: ${getAssetTags(selectedAsset?.metadata).join(', ')}`
                    : selectedAsset?.type === 'image'
                      ? 'Image asset'
                      : 'Media asset'}
              </Text>
            ) : null}
          </Group>
          {!hasSelection ? (
            <Select
              aria-label={label}
              placeholder="Quick select"
              data={context.assetOptions ?? []}
              value={selectedAssetPath}
              error={error}
              clearable
              disabled={disabled || context.assetsLoading}
              onChange={(nextValue) => onChange(nextValue ? createProjectAssetReference(nextValue) : '')}
            />
          ) : null}

          {selectedAsset ? (
            <Stack gap={2}>
              {selectedAsset.metadata?.altText ? <Text size="sm" c="dimmed">Alt text: {getDisplayText(selectedAsset.metadata.altText)}</Text> : null}
              {selectedAsset.metadata?.caption ? <Text size="sm" c="dimmed">Caption: {getDisplayText(selectedAsset.metadata.caption)}</Text> : null}
            </Stack>
          ) : null}
        </Stack>
      </Stack>
    </WorkspaceComplexFieldSurface>
  );
}
