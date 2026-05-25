import { Badge, Box, Checkbox, Group, Paper, Stack, Text } from '@mantine/core';
import type { Asset } from '@ori/shared';
import type { GlobalAsset } from '../../../lib/assets/references';
import { formatAssetSize, formatAssetUsage, getAssetDisplayTags, getAssetIdentifier, getAssetTypeLabel } from '../../../lib/assets/display';
import { AuthenticatedImage } from '../../ui/AuthenticatedImage';

const selectedBadgeStyles = {
  root: {
    backgroundColor: '#eef4f3',
    border: '1px solid #d6e3e0',
    color: 'var(--ori-selection-text)',
  },
  label: {
    fontWeight: 700,
    letterSpacing: '0.06em',
  },
} as const;

interface AssetListItemProps {
  asset: Asset | GlobalAsset;
  selected?: boolean;
  selectionControl?: React.ReactNode;
  onClick?: () => void;
  action?: React.ReactNode;
  density?: 'default' | 'compact';
}

function renderUsageBadge(asset: Asset) {
  const usage = formatAssetUsage(asset);
  return (
    <Badge variant="light" color={usage.color}>
      {usage.label}
    </Badge>
  );
}

function AssetPreview({
  asset,
  width,
  height,
  radius = 'sm',
}: {
  asset: Asset | GlobalAsset;
  width: number | string;
  height: number;
  radius?: 'sm' | 'md';
}) {
  if (asset.type === 'image') {
    return (
      <AuthenticatedImage
        src={asset.url}
        alt={String(asset.metadata?.altText || asset.name)}
        w={width}
        h={height}
        radius={radius}
        fit="cover"
      />
    );
  }

  const extension = asset.name.includes('.') ? asset.name.split('.').pop()?.toUpperCase() : getAssetTypeLabel(asset.type).toUpperCase();

  return (
    <Paper
      withBorder
      p="md"
      radius={radius}
      w={width}
      mih={height}
      style={{
        display: 'grid',
        placeItems: 'center',
        backgroundColor: 'var(--ori-form-preview-bg)',
        borderColor: 'var(--ori-form-section-border)',
      }}
    >
      <Stack gap={2} align="center">
        <Text size="lg" fw={700} c="dark">
          {extension}
        </Text>
        <Text size="xs" fw={600} c="dimmed">
          {getAssetTypeLabel(asset.type)}
        </Text>
      </Stack>
    </Paper>
  );
}

export function AssetListItem({ asset, selected = false, selectionControl, onClick, action, density = 'default' }: AssetListItemProps) {
  const isCompact = density === 'compact';
  const tags = getAssetDisplayTags(asset);
  const summary = String(asset.metadata?.caption || asset.metadata?.altText || tags.join(', ') || '');
  const identifier = getAssetIdentifier(asset);

  return (
    <Paper
      withBorder
      p={isCompact ? 'xs' : 'sm'}
      radius="md"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: selected ? 'var(--ori-selection-bg)' : undefined,
        borderColor: selected ? 'var(--ori-selection-border)' : undefined,
        boxShadow: selected ? '0 1px 3px rgba(24, 33, 38, 0.05)' : undefined,
      }}
      onClick={onClick}
    >
      <Group align="flex-start" wrap="nowrap">
        {selectionControl}
        <AssetPreview asset={asset} width={isCompact ? 56 : 72} height={isCompact ? 56 : 72} />
        <Stack gap={4} flex={1} miw={0}>
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap={2} flex={1} miw={0}>
              <Text fw={600} truncate="end">{asset.name}</Text>
              {!isCompact ? <Text size="xs" c="dimmed" truncate="end">{identifier}</Text> : null}
            </Stack>
            {action ?? (
              selected
                ? <Badge variant="transparent" styles={selectedBadgeStyles}>Selected</Badge>
                : <Badge variant="outline" color="gray">{getAssetTypeLabel(asset.type)}</Badge>
            )}
          </Group>
          <Group gap="xs" wrap="wrap">
            <Badge variant="light" color="gray">{formatAssetSize(asset.size)}</Badge>
            {tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="light" color="gray">{tag}</Badge>
            ))}
            {renderUsageBadge(asset)}
            <Text size="xs" c="dimmed">Updated {new Date(asset.lastModified).toLocaleDateString()}</Text>
          </Group>
          {summary ? <Text size="xs" c="dimmed" truncate="end">{summary}</Text> : null}
          {isCompact ? <Text size="xs" c="dimmed" ff="monospace" truncate="end">{identifier}</Text> : null}
        </Stack>
      </Group>
    </Paper>
  );
}

export function AssetGridItem({
  asset,
  selected = false,
  selectionControl,
  onClick,
}: {
  asset: Asset | GlobalAsset;
  selected?: boolean;
  selectionControl?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Paper
      withBorder
      p="xs"
      radius="md"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: selected ? 'var(--ori-selection-bg)' : undefined,
        borderColor: selected ? 'var(--ori-selection-border)' : undefined,
        boxShadow: selected ? 'inset 0 0 0 1px var(--ori-selection-border), 0 1px 3px rgba(24, 33, 38, 0.05)' : undefined,
      }}
      onClick={onClick}
    >
      <Stack gap="xs">
        <Group justify="space-between" align="center" wrap="nowrap">
          {selectionControl ?? <div />}
          <Badge variant="light" color="gray">{getAssetTypeLabel(asset.type)}</Badge>
        </Group>
        <Box>
          <AssetPreview asset={asset} width="100%" height={116} radius="md" />
        </Box>
        <Stack gap={2}>
          <Text fw={600} size="sm" lineClamp={1}>{asset.name}</Text>
          <Text size="xs" c="dimmed" ff="monospace" lineClamp={1}>{getAssetIdentifier(asset)}</Text>
        </Stack>
        <Group gap="xs" wrap="wrap">
          <Badge variant="light" color="gray" style={{ width: 'fit-content' }}>{formatAssetSize(asset.size)}</Badge>
          {renderUsageBadge(asset)}
        </Group>
      </Stack>
    </Paper>
  );
}

export function AssetSelectionCheckbox({
  assetName,
  checked,
  onChange,
}: {
  assetName: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <Checkbox
      checked={checked}
      onChange={onChange}
      onClick={(event) => event.stopPropagation()}
      aria-label={`Select ${assetName}`}
    />
  );
}
